"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** One row of dropdown filters, synced to the URL so views are shareable. */
export function Filters({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <label key={f.key} className="flex items-center gap-2 text-xs text-ink-2">
          <span className="sr-only">{f.label}</span>
          <select
            aria-label={f.label}
            value={params.get(f.key) ?? "all"}
            onChange={(e) => set(f.key, e.target.value)}
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
