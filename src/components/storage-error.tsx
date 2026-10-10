import { getStore } from "@/lib/store";
import type { CallRecord } from "@/lib/types";
import { Card } from "./ui";

/** Loads calls, turning a storage failure (e.g. Supabase table not created yet) into a message instead of a crash. */
export async function loadCalls(): Promise<{ calls: CallRecord[]; error: string | null }> {
  try {
    return { calls: await getStore().list(), error: null };
  } catch (e) {
    return { calls: [], error: (e as Error).message };
  }
}

export function StorageError({ error }: { error: string }) {
  const missingTable = /PGRST205|could not find the table/i.test(error);
  return (
    <Card title={missingTable ? "Supabase is connected, but the calls table doesn't exist yet" : "Could not load call records"}>
      {missingTable ? (
        <p className="text-sm text-ink-2">
          Open your Supabase project → <strong>SQL Editor</strong> → paste the contents of <code className="break-all rounded bg-surface-2 px-1">supabase/schema.sql</code> → <strong>Run</strong>. Then reload this page and use{" "}
          <strong>Integrations → Reset demo seed data</strong> to load the demo records.
        </p>
      ) : (
        <p className="text-sm text-ink-2">{error}</p>
      )}
    </Card>
  );
}
