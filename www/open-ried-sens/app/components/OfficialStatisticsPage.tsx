import Link from "next/link";
import { readCollected } from "@/lib/collectedBackend";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

type Statistics = {
  publisher?: string; notice?: string; edition: string; publication_month: string; source_url: string;
  tables: { id: string; title: string; records: {
    municipality_id: string; name: string;
    values: { label: string; value: number | null; source_marker: string | null; cell: string }[];
  }[] }[];
};

export default async function OfficialStatisticsPage({ domain, title }: { domain: string; title: string }) {
  let data: Statistics | null = null;
  try { data = await readCollected<Statistics>(`statistics/${domain}`); } catch { /* Missing publication stays unavailable. */ }
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <SiteHeader />
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-slate-400">Zusätzliche Detaildaten sind noch nicht verfügbar. Hier erscheinen die bereits erhobenen amtlichen Statistiken mit ihrem jeweiligen Berichtszeitraum.</p>
      {!data ? <p role="status">Aktuell keine gespeicherte Veröffentlichung verfügbar.</p> : <>
        <p className="text-slate-300">{data.publisher ?? "Hessisches Statistisches Landesamt"}, {data.edition}. Veröffentlichung: {data.publication_month}. Die Zahlen beschreiben den in der Tabelle genannten Zeitraum.</p>
        <a className="text-emerald-400 underline" href={data.source_url}>Originalveröffentlichung</a>
        <p className="text-sm text-slate-400">Nicht veröffentlichte oder gesperrte Werte werden als „–“ angezeigt. {domain === "finance" ? "Ein- und Auszahlungen sind Rechnungsergebnisse, keine aktuellen Haushaltspläne." : ""}</p>
        {data.notice && <p className="text-sm text-slate-400">{data.notice}</p>}
        {data.tables.map(table => <section key={table.id} className="rounded-xl border border-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold">{table.title}</h2>
          {table.records.map(record => <details key={record.municipality_id} className="border-t border-slate-800 py-3">
            <summary className="cursor-pointer font-medium">{record.name}</summary>
            <dl className="mt-3 space-y-2 text-sm">{record.values.map(value => <div key={value.cell} className="grid grid-cols-[1fr_auto] gap-6">
              <dt className="text-slate-400">{value.label}</dt>
              <dd className="tabular-nums">{value.value === null ? "–" : value.value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</dd>
            </div>)}</dl>
          </details>)}
        </section>)}
      </>}
      <Link href="/wahlen" className="mr-6 inline-block text-emerald-400 underline">Wahlergebnisse</Link>
      <Link href="/" className="inline-block text-emerald-400 underline">Zur Karte</Link>
    </main>
    <SiteFooter />
  </div>;
}
