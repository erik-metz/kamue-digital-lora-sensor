import Link from "next/link";

const topics = [
  { href: "/demografie", title: "Demografie & Bildung", detail: "Gemeindestatistik und Pendlerdaten" },
  { href: "/wirtschaft", title: "Wirtschaft", detail: "Unternehmen und Beschäftigung" },
  { href: "/haushalt", title: "Kommunale Haushalte", detail: "Veröffentlichte Haushaltspläne" },
  { href: "/statistik", title: "Regionale Statistik", detail: "Berichtszeiträume und Kennzahlen" },
  { href: "/bauen-wohnen", title: "Bauen & Wohnen", detail: "Wohnungsbestand und regionale Entwicklung" },
  { href: "/karte", title: "Mobilität", detail: "ÖPNV, Verkehr und Infrastruktur" },
];

export default function RegionalCatalog() {
  return (
    <section id="themen-katalog" className="space-y-4">
      <h2 className="text-2xl font-bold">Regionale Datenkataloge</h2>
      <p className="text-sm text-slate-400">Entdecke die Themen und ihre Daten. Die angebundenen Originalquellen und ihren Erfassungsstatus findest du darunter.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map(topic => (
          <Link key={topic.href} href={topic.href} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-emerald-500/40">
            <h3 className="font-semibold text-emerald-300">{topic.title} →</h3>
            <p className="mt-1 text-xs text-slate-400">{topic.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
