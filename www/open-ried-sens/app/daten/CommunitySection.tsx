import Link from "next/link";

export default function CommunitySection() {
  return (
    <section id="community" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Hilf mit, das Projekt voranzubringen</h2>
        <p className="text-sm text-slate-300">Baue einen Sensor, bring eine Idee ein oder entwickle mit uns weiter.</p>
      </div>
      <div className="flex flex-wrap gap-3 shrink-0 text-sm font-semibold">
        <Link href="/sensor-bauen" className="rounded-xl bg-emerald-400 px-4 py-2 text-slate-950 hover:bg-emerald-300">Sensor bauen</Link>
        <a href="https://github.com/erik-metz/kamue-digital-lora-sensor" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-700 px-4 py-2 text-emerald-300 hover:bg-slate-800">Auf GitHub mitmachen ↗</a>
      </div>
    </section>
  );
}
