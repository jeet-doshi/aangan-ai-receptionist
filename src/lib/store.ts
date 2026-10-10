// Persistence: Supabase when configured, otherwise a local JSON file (demo fallback).
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import { buildSeedRecords } from "./seed";
import type { CallRecord } from "./types";

export interface StorageInfo {
  kind: "supabase" | "local_file";
  detail: string;
  persistent: boolean;
}

interface CallStore {
  info(): StorageInfo;
  list(): Promise<CallRecord[]>;
  get(id: string): Promise<CallRecord | null>;
  insert(rec: CallRecord): Promise<void>;
  update(id: string, patch: Partial<CallRecord>): Promise<void>;
  /** Replaces all demo-seed records with a fresh copy. Never touches simulated or real records. */
  reseedDemo(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

class SupabaseStore implements CallStore {
  private db: SupabaseClient;
  constructor() {
    this.db = createClient(config.supabase.url, config.supabase.secretKey, { auth: { persistSession: false } });
  }
  info(): StorageInfo {
    return { kind: "supabase", detail: "Supabase table public.calls", persistent: true };
  }
  async list() {
    const { data, error } = await this.db.from("calls").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    return (data ?? []) as CallRecord[];
  }
  async get(id: string) {
    const { data, error } = await this.db.from("calls").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase get failed: ${error.message}`);
    return (data as CallRecord) ?? null;
  }
  async insert(rec: CallRecord) {
    const { error } = await this.db.from("calls").insert(rec);
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  }
  async update(id: string, patch: Partial<CallRecord>) {
    const { error } = await this.db.from("calls").update(patch).eq("id", id);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
  }
  async reseedDemo() {
    const { error: delErr } = await this.db.from("calls").delete().eq("source", "demo_seed");
    if (delErr) throw new Error(`Supabase delete failed: ${delErr.message}`);
    const seeds = buildSeedRecords();
    const { error } = await this.db.from("calls").insert(seeds);
    if (error) throw new Error(`Supabase seed failed: ${error.message}`);
    return seeds.length;
  }
}

// ---------------------------------------------------------------------------
// Local JSON file (demo fallback)
// ---------------------------------------------------------------------------

class FileStore implements CallStore {
  // Vercel's filesystem is read-only except /tmp, which is wiped between cold starts.
  private file = process.env.VERCEL ? "/tmp/aangan-calls.json" : path.join(process.cwd(), ".data", "calls.json");
  private queue: Promise<unknown> = Promise.resolve();

  info(): StorageInfo {
    return process.env.VERCEL
      ? { kind: "local_file", detail: "Temporary /tmp file on Vercel. Resets on cold start; configure Supabase to persist.", persistent: false }
      : { kind: "local_file", detail: ".data/calls.json on this machine", persistent: true };
  }

  private async read(): Promise<CallRecord[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as CallRecord[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      // First run: start with the labelled demo seed so the dashboard isn't empty.
      const seeds = buildSeedRecords();
      await this.write(seeds);
      return seeds;
    }
  }
  private async write(rows: CallRecord[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(rows, null, 2), "utf8");
  }
  /** Serialises read-modify-write cycles so concurrent requests don't clobber each other. */
  private mutate<T>(fn: (rows: CallRecord[]) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const rows = await this.read();
      const result = await fn(rows);
      await this.write(rows);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list() {
    await this.queue;
    const rows = await this.read();
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async get(id: string) {
    await this.queue;
    return (await this.read()).find((r) => r.id === id) ?? null;
  }
  insert(rec: CallRecord) {
    return this.mutate((rows) => {
      rows.push(rec);
    });
  }
  update(id: string, patch: Partial<CallRecord>) {
    return this.mutate((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error(`Call ${id} not found`);
      rows[i] = { ...rows[i], ...patch };
    });
  }
  reseedDemo() {
    return this.mutate((rows) => {
      const seeds = buildSeedRecords();
      const kept = rows.filter((r) => r.source !== "demo_seed");
      rows.length = 0;
      rows.push(...kept, ...seeds);
      return seeds.length;
    });
  }
}

let store: CallStore | null = null;
export function getStore(): CallStore {
  if (!store) store = config.supabase.enabled ? new SupabaseStore() : new FileStore();
  return store;
}
