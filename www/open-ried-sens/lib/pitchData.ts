export interface SlideBullet {
  title: string;
  description: string;
  iconName?: string;
  tag?: string;
}

export interface SlideStat {
  value: string;
  label: string;
  subtext?: string;
  color?: string;
}

export interface MapEvidence {
  serviceName: string;
  serviceUrl: string;
  imagePath: string;
  headline: string;
  description: string;
  riedStatus: string;
  impactBadge: string;
}

export interface CostComparisonItem {
  feature: string;
  openRiedSens: string;
  commercialSolution: string;
  advantage: string;
}

export interface CompetitiveMatrixPoint {
  name: string;
  x: number; // 0-100 (Datenoffenheit & Souveränität)
  y: number; // 0-100 (Bürgernähe & MINT-Bildung)
  description: string;
  isSelf?: boolean;
}

export interface MarketFunnelData {
  tam: { number: string; title: string; desc: string };
  sam: { number: string; title: string; desc: string };
  som: { number: string; title: string; desc: string };
}

export interface CoveragePlanItem {
  number: string;
  title: string;
  description: string;
  tag: string;
}

export interface TeamMember {
  name: string;
  location: string;
  role: string;
  imageSrc: string;
  bio: string;
  highlights: string[];
}

export interface StemSkillItem {
  category: "handwerk" | "sensorik" | "informatik" | "multiplikator";
  title: string;
  skills: string[];
  targetKids: string;
  targetAdults: string;
}

export interface SpecificAskItem {
  id: string;
  title: string;
  description: string;
  commitmentType: "daten" | "infrastruktur" | "finanzen" | "praesenz" | "schulen";
  tag: string;
  actionText: string;
}

export type SlideLayout =
  | "one-pager-hero"
  | "blindspot-evidence"
  | "value-prop-split"
  | "product-architecture"
  | "tam-sam-som"
  | "coverage-plan"
  | "unit-economics"
  | "competitive-matrix"
  | "civic-alliance"
  | "traction-timeline"
  | "stem-learning-matrix"
  | "team-showcase"
  | "the-ask-commitment"
  | "live-telemetry-bonus";

export interface PitchSlide {
  id: string;
  stepNumber: number; // 1 to 10/11
  stepLabel: string; // e.g. "01 / Hook & One-Pager"
  eyebrow: string;
  title: string;
  lead: string;
  layout: SlideLayout;
  imageVisual?: {
    src: string;
    alt: string;
    caption?: string;
  };
  bullets?: SlideBullet[];
  stats?: SlideStat[];
  mapEvidence?: MapEvidence[];
  marketFunnel?: MarketFunnelData;
  coveragePlan?: CoveragePlanItem[];
  teamMembers?: TeamMember[];
  costComparison?: CostComparisonItem[];
  competitivePoints?: CompetitiveMatrixPoint[];
  stemSkills?: StemSkillItem[];
  specificAsks?: SpecificAskItem[];
  speakerNotes: {
    elevatorPitch: string;
    talkingPoints: string[];
    audienceEngagement: string;
    localHook?: string;
  };
  callToAction?: {
    primaryText: string;
    primaryHref: string;
    secondaryText?: string;
    secondaryHref?: string;
  };
}

export interface PitchDeck {
  slug: string;
  title: string;
  subtitle: string;
  targetAudience: string;
  category: "politik" | "bildung" | "wirtschaft";
  badge: string;
  accentColor: "emerald" | "sky" | "violet" | "amber";
  estimatedMinutes: number;
  summary: string;
  slides: PitchSlide[];
}

export const MAP_EVIDENCE_ITEMS: MapEvidence[] = [
  {
    serviceName: "Sensor.Community (Luftdaten.info)",
    serviceUrl: "https://sensor.community/de/",
    imagePath: "/pitch/sensor-community-ried-map.png",
    headline: "Feinstaub & Luftqualität (PM2.5 / PM10)",
    description:
      "Die weltweit führende Citizen-Science-Plattform für Feinstaub. Während Worms, Bensheim und Lorsch einzelne Stationen besitzen, klafft im gesamten Riedkern (Bürstadt, Biblis, Groß-Rohrheim, Lampertheimer Heide) ein gigantischer Datenblindfleck.",
    riedStatus: "29 sichtbare Sensoren im Radius – fast alle an der Bergstraße oder in Worms. Riedkern nahezu weiß!",
    impactBadge: "0 Sensoren in vielen Ried-Ortsteilen",
  },
  {
    serviceName: "TTN Mapper (The Things Network)",
    serviceUrl: "https://ttnmapper.org/heatmap/",
    imagePath: "/pitch/ttn-mapper-ried-map.png",
    headline: "Öffentliches LoRaWAN-Funknetzwerk",
    description:
      "Das offene Funknetzwerk für Sensoren ohne SIM-Karten. Die Heatmap belegt: LoRaWAN existiert nur punktuell entlang Autobahnen (A67, B47) durch mobile Mapper. Ortskerne, Schulen, Ackerbauflächen und Gewerbegebiete im Ried sind unterversorgt.",
    riedStatus: "Lückenhafte Abdeckung – kein flächendeckender Empfang für Bürger- & Schulsensoren vorhanden.",
    impactBadge: "Kritische Funklöcher im Innenbereich",
  },
  {
    serviceName: "Raspberry Shake (Seismograph für Erschütterungen & Geothermie)",
    serviceUrl: "https://raspberryshake.org/",
    imagePath: "/pitch/raspberry-shake-ried-map.png",
    headline: "Seismik, Erschütterungen, Geothermie & Riedbahn",
    description:
      "Globales Bürgernetzwerk für Seismometer. Im geothermisch sensiblen Oberrheingraben und entlang der hochfrequentierten Riedbahn-Trasse gibt es im gesamten Altkreis nur eine einzige Station (Bürstadt/Lampertheim Grenze).",
    riedStatus: "Praktisch ein Totalausfall für Bürgerwissenschaft im sensiblen Oberrheingraben.",
    impactBadge: "Nur 1 Station im Umkreis von 25 km",
  },
];

// ============================================================================
// 1. POLITIK PITCH DECK (Bürgermeister, Landräte, Fraktionen)
// ============================================================================
export const POLITIK_DECK: PitchDeck = {
  slug: "politik",
  title: "Smarte Daseinsvorsorge & Datenhoheit fürs Hessische Ried",
  subtitle:
    "Kostenlos für die Kommunen: Wie Bürstadt mit Bürger-Sensoren und dem 48h-Hackathon im KAMÜ Daten-Silos bricht",
  targetAudience: "Bürgermeister, Landräte, Beigeordnete, Stadträte, Bauamtsleiter & Fraktionen",
  category: "politik",
  badge: "Kommunale Daseinsvorsorge",
  accentColor: "emerald",
  estimatedMinutes: 12,
  summary:
    "11-teiliger zielgerichteter Pitch für die Kommunalpolitik: 0 € Haushaltsbelastung, Bündelung aller Datenströme im Bürger-Cockpit, Verknüpfung von Sensorbau und KAMÜ-Hackathon, Vorstellung des Core-Teams und glasklarer Ask.",
  slides: [
    {
      id: "folie-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & One-Pager",
      eyebrow: "Smarte Region Bergstraße · Hessen",
      title: "Open Ried Sens: Kostenlos für die Kommunen – Getragen von Bürgern & Fördermitteln",
      lead: "0 € Belastung für den städtischen Haushalt: Wir bündeln alle regionalen Datenströme (Klima, Verkehr, Entsorgung, Parken) an einer zentralen, offenen Stelle im Kulturzentrum KAMÜ Bürstadt. Bürger finanzieren ihre Sensoren selbst, laufende Serverkosten minimal (~50 €/Jahr).",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/kamue-cooperation.jpg",
        alt: "Bürger, Verwaltung und Entwickler im Kulturzentrum KAMÜ",
        caption: "Kooperation auf Augenhöhe: Bürger, Verwaltung & IT-Experten im Kulturzentrum KAMÜ Bürstadt",
      },
      bullets: [
        {
          title: "0 € Kommunalkosten",
          description: "Vollständig finanziert aus Bürgerinitiative, Fördermitteln & Spenden; Serverbetrieb ca. 50 €/Jahr.",
          tag: "Haushaltsneutral",
        },
        {
          title: "Zentrales Regional-Cockpit",
          description: "Zusammenführung aller isolierten Datenströme an einem Ort im Kulturzentrum KAMÜ Bürstadt.",
          tag: "Open Data",
        },
        {
          title: "Bürger finanzieren Sensoren",
          description: "Bürger & Schulen tragen ihre Stationen selbst – die Kommune profitiert von lückenloser Telemetrie.",
          tag: "Bürgerbeteiligung",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Damen und Herren Bürgermeister und Landräte: Wir verlangen keine Steuermillionen für externe Berater. Open Ried Sens ist für Ihre Stadtkasse komplett kostenlos. Bürger, Schulen und Förderungen tragen die Hardware, der Serverbetrieb kostet 50 Euro im Jahr. Wir bringen die Daten ins KAMÜ Bürstadt.",
        talkingPoints: [
          "0 € Haushaltsbelastung: Keine Beschaffungsanträge, kein finanzielles Risiko für den Kämmerer.",
          "Kommunen stehen vor der Pflicht zur Klimafolgenanpassung (§ 12 Hessisches Klimagesetz) – wir liefern die Messwerte frei Haus.",
          "Das Kulturzentrum KAMÜ in Bürstadt dient als offener Innovations- und Begegnungsort.",
        ],
        audienceEngagement:
          "Frage in die Runde: Wie viel kostet Ihre Verwaltung aktuell die jährliche Lizenz für kommerzielle Fachanwendungen im Umweltbereich?",
        localHook: "Kulturzentrum KAMÜ in Bürstadt (Industriestraße 11) als regionale Heimatbasis.",
      },
    },
    {
      id: "folie-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Das Problem & Daten-Silos",
      eyebrow: "Datenlücke · Isolierte Silos",
      title: "Unmengen an Daten existieren – aber isoliert in Silos und ohne zentrale Heimat",
      lead: "Von Parkleitsystemen über Bahnübergänge bis zu Mülltouren: Es gibt unzählige Rohdaten im Ried. Doch sie liegen isoliert in Silos, während engagierte Bürger und Digital Natives bisher keine Plattform hatten, um kostenlos für die Region und digitale Bildung anzupacken.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Das eigentliche Problem im Ried ist nicht das Fehlen von Daten, sondern deren Zersplitterung: Sensoren stehen in geschlossenen Portalen, Bahnübergangsdaten versanden bei der Bahn, und globale Plattformen wie Sensor.Community oder Raspberry Shake zeigen im Ried weiße Flecken. Es fehlt die zentrale Bündelung vor Ort.",
        talkingPoints: [
          "Unmengen an Daten existieren bereits, werden aber nicht für die Bevölkerung nutzbar gemacht.",
          "Engagierte Digital Natives und Bürger wollen ehrenamtlich mit anpacken, brauchen aber die offizielle Unterstützung der Verwaltung.",
          "Gleichzeitig belegen Sensor.Community, TTN Mapper und Raspberry Shake: Ohne Bürgerinitiative bleibt das Ried abgehängt.",
        ],
        audienceEngagement:
          "Zeigen Sie den Entscheidern: 'Wir wollen diese Silos aufbrechen – gemeinsam mit Ihnen!'",
        localHook: "Besonders Bürstadt mit Kernstadt, Bobstadt und Riedrode hat das Potenzial zur Modellstadt.",
      },
    },
    {
      id: "folie-3-solution",
      stepNumber: 3,
      stepLabel: "03 / Die Lösung: Zwei komplementäre Hebel",
      eyebrow: "Ursache & Wirkung · Zwei starke Säulen",
      title: "Mehr lokale Messdaten & Der 48h Ried-Hackathon im KAMÜ",
      lead: "Links: Dichte Messungen von CO2, Feinstaub, Stickoxiden & Hitzeinseln. Rechts: Der Ried-Hackathon als offenes Labor, um mit diesen Daten reale Probleme zu lösen.",
      layout: "value-prop-split",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Ried-Hackathon im KAMÜ Bürstadt",
        caption: "Der 48h Ried-Hackathon im KAMÜ: Aus gesammelten Umweltdaten entstehen greifbare Lösungen",
      },
      stats: [
        { value: "0 €", label: "Lizenzkosten", subtext: "Freie Open-Source Software", color: "emerald" },
        { value: "1 Gateway", label: "Deckt Kernstadt", subtext: "Bis zu 10 km Funkreichweite", color: "sky" },
        { value: "48 Std.", label: "Innovations-Sprint", subtext: "Ried-Hackathon im KAMÜ", color: "violet" },
      ],
      bullets: [
        {
          title: "Links: Feingranulare Messdaten (Sensor-BOM)",
          description: "Wir bauen und verteilen standardisierte Stationen: CO2 (Sensirion SCD41), Feinstaub (SPS30 PM2.5/PM10), Stickoxide (NOx), Ozon, Lärm & Hitzeinseln in Wohnquartieren.",
          tag: "Datengrundlage",
        },
        {
          title: "Rechts: Der 48h Ried-Hackathon im KAMÜ",
          description: "Was machen wir mit den Daten? Schüler, Entwickler, Bürger und Fachämter programmieren an einem Wochenende smarte Anwendungen – von Schulwegsicherheit bis Schrankenwarnung.",
          tag: "Innovationslabor",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Unsere Lösung hat zwei Seiten einer Medaille: Links schaffen wir durch Sensorbau im Ried endlich dichte Rohdaten für CO2, Feinstaub und Hitze. Rechts bringen wir diese Daten in den 48h-Hackathon im KAMÜ, damit kreative Köpfe greifbare Lösungen daraus bauen.",
        talkingPoints: [
          "Bürger bauen die Hardware selbst (siehe /sensor-bauen mit RAK3113 und Sensirion-Sensoren).",
          "Der Hackathon im Kulturzentrum KAMÜ ist der Schmelztiegel, an dem Verwaltung, Jugend und Softwareprofis zusammenkommen.",
          "Ergebnis: Fertige Bürger-Dashboards statt teurer Gutachten im Aktenschrank.",
        ],
        audienceEngagement:
          "Betonen Sie: 'Haben Sie konkrete Fragestellungen aus dem Bauamt? Der Hackathon löst genau Ihre Herausforderungen!'",
        localHook: "Kulturzentrum KAMÜ in Bürstadt bietet Werkstatt, Bühne, Catering und Glasfaseranschluss.",
      },
    },
    {
      id: "folie-4-product",
      stepNumber: 4,
      stepLabel: "04 / Das Produkt: Zentrales Bürger-Cockpit",
      eyebrow: "Souveränität & Transparenz · Kein Vendor Lock-in",
      title: "Zentrales Bürger- & Regional-Cockpit: Alle Datenströme an einem Ort",
      lead: "Ein modernes, interaktives Dashboard für Bürger und Verwaltung: Echtzeit-Karten für Luftqualität, Parkplätze, Bahnübergänge und Hitzeinseln – 100% DSGVO-konform und frei zugänglich.",
      layout: "product-architecture",
      imageVisual: {
        src: "/pitch/ried-smart-cockpit.jpg",
        alt: "Hessen Smart City Network Ried Monitor Dashboard",
        caption: "Das Open-Ried Cockpit: Mobilität, Umwelt, Parken & Solardaten auf einen Blick vereint",
      },
      bullets: [
        {
          title: "Bürgernahe Visualisierung",
          description: "Interaktive Karte mit aktuellen Luftwerten (PM2.5, CO2), Parkplatz-Auslastung und Bahnübergangs-Status für alle Bürger.",
          tag: "Transparenz",
        },
        {
          title: "Offene REST & GeoJSON Schnittstellen",
          description: "Nahtlose Anbindung an städtische Geoinformationssysteme (GIS), Bauamts-Software und TimescaleDB-Langzeitarchive.",
          tag: "Interoperabel",
        },
        {
          title: "0 € Software-Lizenzen",
          description: "Keine 48-Monats-Verträge, keine wiederkehrenden SaaS-Gebühren für die Stadtkasse. Das System gehört der Region.",
          tag: "Unabhängigkeit",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Hier sehen Sie das Herzstück für Verwaltung und Bürger: Ein zentrales Regional-Cockpit. Ob Luftqualität, Parkleitsystem von smartcity-system.de oder Schrankenstatus der Riedbahn – alles fließt in eine transparente, offene Plattform.",
        talkingPoints: [
          "Verwaltung und Bürger schauen auf dieselben verlässlichen Echtzeitdaten.",
          "Ermöglicht faktenbasierte Bürgerdialoge bei Bauvorhaben, Verkehrsberuhigung oder Hitzeaktionsplänen.",
          "Kein Konzern-Monopol: Quelloffen und erweiterbar.",
        ],
        audienceEngagement:
          "Zeigen Sie auf die Karte: 'Genau so sieht moderne, bürgernahe Daseinsvorsorge im 21. Jahrhundert aus.'",
        localHook: "Bereits live erreichbar über open-ried.de.",
      },
    },
    {
      id: "folie-5-market",
      stepNumber: 5,
      stepLabel: "05 / Netzabdeckung: Vom Flickenteppich zur Fläche",
      eyebrow: "Pragmatischer Ausbau · Bürstadt, Bobstadt & Riedrode",
      title: "Vom Flickenteppich zur lückenlosen Abdeckung im Ried",
      lead: "Keine theoretischen Funnels, sondern ein pragmatischer Rollout: 1 zentrales Gateway auf dem Rathaus Bürstadt oder Wasserturm + 30–50 Quartiers-Stationen versorgen Kernstadt, Bobstadt und Riedrode.",
      layout: "coverage-plan",
      coveragePlan: [
        {
          number: "1 Gateway",
          title: "Zentrale LoRaWAN-Funkzelle",
          description: "Standort auf Rathausdach oder Wasserturm Bürstadt: Bis zu 10 km Reichweite decken Bürstadt, Bobstadt und Riedrode zuverlässig ab – ohne monatliche SIM-Karten.",
          tag: "Infrastruktur",
        },
        {
          number: "30–50 Stationen",
          title: "Dezentrale Quartiers-Messpunkte",
          description: "Montiert an Schulen, Kitas, Bürgerhäusern, KAMÜ und privaten Wohnhäusern – finanziert von Bürgern, Fördervereinen und Sponsoren.",
          tag: "Messdichte",
        },
        {
          number: "Faktenbasiert",
          title: "Verlässliche Stadtplanung",
          description: "Objektive Entscheidungsgrundlage für Hitzeaktionspläne, Schulwegsicherheit, Bauleitplanung und Verkehrsfluss im gesamten Stadtgebiet.",
          tag: "Nutzen",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Vergessen wir abstrakte Kennzahlen: Wir brauchen genau 1 Antenne auf einem hohen Gebäude wie dem Rathaus oder Wasserturm und 30 bis 50 Stationen an Bürgerhäusern und Schulen. Damit haben wir Bürstadt, Bobstadt und Riedrode lückenlos abgedeckt!",
        talkingPoints: [
          "LoRaWAN sendet frei über Kilometer hinweg im lizenzfreien 868-MHz-Band.",
          "Eine Antenne auf dem Rathausdach kostet einmalig wenige hundert Euro und versorgt das gesamte Stadtgebiet.",
          "Die Sensoren selbst werden von engagierten Bürgern und Schülern gebaut und gepflegt.",
        ],
        audienceEngagement:
          "Fragen Sie die Bauamtsleitung: 'Haben Sie verlässliche Messdaten für Mikroklima und Hitze in Bobstadt oder Riedrode?'",
        localHook: "Standorte: Rathaus Bürstadt, Wasserturm, Feuerwehrhäuser, Kulturzentrum KAMÜ.",
      },
    },
    {
      id: "folie-6-economics",
      stepNumber: 6,
      stepLabel: "06 / Wertschätzung & Synergien",
      eyebrow: "Steuergelder veredeln · Keine Kritik an Vorprojekten",
      title: "Bestehende Investitionen veredeln: Den 2,4-Mio.-€-Datenschatz heben!",
      lead: "Bürstadt hat mit smartcity-system.de bereits ca. 2,4 Mio. € in moderne Parksensoren investiert. Wir kritisieren das nicht, sondern heben das volle Potenzial: Kostenlose Einbindung in das Bürger-Cockpit statt ungenutzter Daten-Silos.",
      layout: "unit-economics",
      costComparison: [
        {
          feature: "smartcity-system.de Parkdaten",
          openRiedSens: "Kostenlose API-Integration ins Dashboard",
          commercialSolution: "Isolierte Silo-App / Insellösung",
          advantage: "Volle Synergie",
        },
        {
          feature: "Kommunale Software-Folgekosten",
          openRiedSens: "0 € / Jahr (Bürger-Cockpit Open Source)",
          commercialSolution: "Laufende Lizenz- & Updateverträge",
          advantage: "Haushaltsneutral",
        },
        {
          feature: "Erweiterung um Umwelt & Verkehr",
          openRiedSens: "Bürger-Sensoren (CO2, Feinstaub, Lärm)",
          commercialSolution: "Teure neue Ausschreibungen",
          advantage: "Ganzheitlich",
        },
        {
          feature: "Pflege & Weiterentwicklung",
          openRiedSens: "Ehrenamtliche Digital Natives & KAMÜ",
          commercialSolution: "Externe Beraterstundensätze",
          advantage: "Direkt vor Ort",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "In Bürstadt wurden mit smartcity-system.de rund 2,4 Millionen Euro an Förder- und Steuergeldern in smarte Parksensoren investiert. Das ist ein großartiger Datenschatz! Wir wollen diese Investition veredeln, indem wir die Daten per API kostenlos in das Bürger-Cockpit einbinden und mit Verkehr und Umwelt verknüpfen.",
        talkingPoints: [
          "Wertschätzung statt Vorwürfe: Bestehende Investitionen werden aufgewertet.",
          "Die Bürger sehen endlich auf einer einzigen Seite, wo Parkplätze frei sind und wie die Luftqualität ist.",
          "0 Euro Zusatzkosten für die städtische Kasse.",
        ],
        audienceEngagement:
          "Betonen Sie: 'Wir schaffen keine teuren Doppelstrukturen, sondern vernetzen das Bestehende.'",
        localHook: "Parksensoren am Marktplatz und Bahnhof Bürstadt.",
      },
    },
    {
      id: "folie-7-competition",
      stepNumber: 7,
      stepLabel: "07 / Das Bündnis: Bürger & Verwaltung",
      eyebrow: "Echte Akzeptanz statt Top-Down · Lokale Kraft",
      title: "Starke Allianz aus Bürgerengagement & Stadtverwaltung",
      lead: "Reine Top-Down-Projekte scheitern oft an fehlender Akzeptanz. Wir kombinieren die Begeisterung von Bürgern, Schülern und lokalen Machern mit der verlässlichen Daseinsvorsorge der Kommune.",
      layout: "civic-alliance",
      bullets: [
        {
          title: "Bürger & Schüler am Lötkolben",
          description: "Wer seinen Sensor selbst gebaut und montiert hat, versteht die Technik, schützt die Station und teilt die Daten mit Stolz.",
          tag: "Hohe Akzeptanz",
        },
        {
          title: "Kulturzentrum KAMÜ als Heimat",
          description: "Fester physischer Treffpunkt im Ried für Workshops, Reparaturen, Bürgertreffen und den 48h-Hackathon.",
          tag: "Lokal verankert",
        },
        {
          title: "Verwaltung auf Augenhöhe",
          description: "Die Kommune behält volle Datenhoheit, spart Lizenzgebühren und gewinnt engagierte Botschafter in der Stadtgesellschaft.",
          tag: "Echte Partnerschaft",
        },
        {
          title: "Regionale Digital Natives",
          description: "Verfügbare IT- und Funk-Kompetenz direkt vor Ort, statt ständige Abhängigkeit von fernen Großkonzernen.",
          tag: "Autonomie & Tempo",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Vergessen wir das Wort 'Burggraben' – für eine Bürgerinitiative geht es um eine vertrauensvolle Allianz: Wenn Verwaltung und Bürger an einem Strang ziehen, schlagen wir jeden teuren Großkonzern um Längen in Akzeptanz, Schnelligkeit und Bürgernähe.",
        talkingPoints: [
          "Kein Widerstand gegen Sensoren, weil die Bürger sie selbst an ihren Häusern anbringen.",
          "Verbindung aus handwerklicher MINT-Bildung und professioneller Software-Infrastruktur.",
          "KAMÜ Bürstadt als neutraler, kreativer Begegnungsort.",
        ],
        audienceEngagement:
          "Fragen Sie die Stadträte: 'Wäre es nicht großartig, wenn Bürger mit Stolz über städtische Digitalisierung sprechen?'",
        localHook: "Kulturzentrum KAMÜ in der Industriestraße 11, Bürstadt.",
      },
    },
    {
      id: "folie-8-traction",
      stepNumber: 8,
      stepLabel: "08 / Meilensteine & Roadmap",
      eyebrow: "Verbindlicher Zeitplan · Realistisch & Ambitioniert",
      title: "Verbindliche Roadmap: Vom Live-Prototyp zur Modellregion Bergstraße",
      lead: "Ambitioniert, aber realistisch geplant: In vier klaren Phasen etablieren wir Bürstadt als Smart-Region-Vorreiter in Hessen.",
      layout: "traction-timeline",
      bullets: [
        {
          title: "Phase 1: Daten-Integration & Live-Cockpit (Q1/Q2)",
          description: "TimescaleDB-Ingestion aller Silo-Rohdaten (smartcity-system, Bahn, ZAKB, Wetter) und offene REST-API.",
          tag: "Erreicht",
        },
        {
          title: "Phase 2: Kommunale Funkzelle & 25 Stationen (Q3)",
          description: "Inbetriebnahme Gateway auf Rathaus/Wasserturm; Rollout der ersten 25 Bürger- und Schul-Sensoren im Ried.",
          tag: "In Vorbereitung",
        },
        {
          title: "Phase 3: 1. Ried-Hackathon im KAMÜ (Q4)",
          description: "48h-Event mit Schirmherrschaft des Bürgermeisters, Prämierung von Bürger-Apps und öffentlicher Ergebnis-Showcase.",
          tag: "Geplant",
        },
        {
          title: "Phase 4: Modellregion Bergstraße (Folgejahr)",
          description: "Skalierung als Blaupause auf Nachbarkommunen (Lampertheim, Biblis, Lorsch, Kreis Bergstraße).",
          tag: "Zukunft",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Wir reden nicht über kleine Bastelprojekte: Phase 1 läuft bereits live. In Phase 2 errichten wir die Funkzelle und die ersten 25 Stationen. In Phase 3 folgt der große Hackathon im KAMÜ. Und im nächsten Schritt wird Bürstadt die Modellregion für den ganzen Kreis Bergstraße!",
        talkingPoints: [
          "Verbindliche Meilensteine, an denen sich die Initiative messen lässt.",
          "Klare Einbindung der Stadtverwaltung zu jedem Schritt.",
          "Hohe Strahlkraft für Bürstadt auf Landes- und Kreisebene.",
        ],
        audienceEngagement:
          "Zeigen Sie den Zeitstrahl: 'Wir können noch dieses Quartal mit Phase 2 loslegen!'",
        localHook: "Rollout in Bürstadt, Bobstadt und Riedrode.",
      },
    },
    {
      id: "folie-9-team",
      stepNumber: 9,
      stepLabel: "09 / Das Team vor Ort",
      eyebrow: "Macher aus der Region · Erfahrung & Leidenschaft",
      title: "Das Kern-Team: Tief im Ried verwurzelt & technologisch erfahren",
      lead: "Keine anonyme Beratungsfirma: Wir leben und arbeiten in Bürstadt und Nordheim, engagieren uns im Ehrenamt und bringen jahrzehntelange Erfahrung aus Groß-IT, Kultur und Open Source mit.",
      layout: "team-showcase",
      teamMembers: [
        {
          name: "Rüdiger Enger",
          location: "Bürstadt",
          role: "Gründer Kulturzentrum KAMÜ & Bürgerstiftung",
          imageSrc: "/pitch/ruediger-engert.jpg",
          bio: "Impulsgeber und Gründer des Kultur- und Begegnungszentrums KAMÜ ('Kultur am Übergang') im historischen Getreidespeicher in Bürstadt. Vorstandsmitglied der Bürgerstiftung Bürstadt, vernetzt Zivilgesellschaft, Kultur und Macher in der Region.",
          highlights: ["KAMÜ Initiator", "Bürgerstiftung Bürstadt", "Lokale Netzwerke"],
        },
        {
          name: "Michael Binzen",
          location: "Bürstadt",
          role: "Senior IT- & Software-Architekt (DB Systel / Bahn IT)",
          imageSrc: "/pitch/michael-binzen.jpg",
          bio: "Über 20 Jahre Software-Architektur und Digitalisierung bei der Deutschen Bahn. Pionier für Open Data, APIs und Innovationskultur. Bitkom-Referent, Mentor bei 'Jugend Hackt' und aktiv in der Bürstädter Vereinslandschaft.",
          highlights: ["Open Data Pionier", "DB Systel / Bahn IT", "Jugend Hackt Mentor"],
        },
        {
          name: "Erik Metz",
          location: "Nordheim / Ried",
          role: "Software Engineer & IoT-Systementwickler",
          imageSrc: "/pitch/erik-metz.jpg",
          bio: "Initiator von Open Ried Sens und Maintainer der offenen Sensor-Plattform. Spezialisiert auf Embedded LoRaWAN-Sensorik, Microservices, TimescaleDB und moderne Web-Architekturen für bürgernahe Umwelttelemetrie.",
          highlights: ["Open Ried Sens Lead", "LoRaWAN & IoT Firmware", "Full-Stack Dev"],
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Schauen Sie sich unser Team an: Rüdiger Enger stellt mit dem KAMÜ die physische Werkstatt und Heimat im Ried. Michael Binzen bringt über 20 Jahre Open-Data- und IT-Erfahrung der Deutschen Bahn und von Jugend Hackt mit. Erik Metz steuert die LoRaWAN-Hardware und Web-Architektur. Wir sind Macher aus Bürstadt und Nordheim.",
        talkingPoints: [
          "Verbindung aus lokaler Verankerung, Bürgerstiftung, Kultur und professioneller Enterprise-Software.",
          "Wir sind direkt ansprechbar und bleiben vor Ort.",
        ],
        audienceEngagement: "Geben Sie den Entscheidern die Visitenkarten des Kernteams.",
        localHook: "Bürstadt & Nordheim direkt im Ried.",
      },
    },
    {
      id: "folie-10-ask",
      stepNumber: 10,
      stepLabel: "10 / The Ask & Politisches Commitment",
      eyebrow: "Konkrete Beschlüsse · Was wir von der Politik brauchen",
      title: "Unser 'Ask' an Bürgermeister, Landräte & Fraktionen",
      lead: "Wir bitten nicht um Haushaltsmillionen. Wir bitten um partnerschaftliches Rückgrat, Rohdaten-Zugang und Ihre Präsenz beim Hackathon.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "ask-daten",
          title: "1. Rohdaten-Kooperation (smartcity-system & Co.)",
          description: "Freigabe der Rohdaten-Schnittstellen bestehender städtischer Systeme (Parksensoren smartcity-system.de/buerstadt, ZAKB-Tourenpläne, DB-Bahnübergangs-Status) für unser Bürger-Cockpit.",
          commitmentType: "daten",
          tag: "Open Data",
          actionText: "Schnittstellen freigeben",
        },
        {
          id: "ask-infrastruktur",
          title: "2. Dachstandort für 1 LoRaWAN-Antenne",
          description: "Freigabe eines Antennenmontagepunkts auf einem öffentlichen Gebäude (Rathaus Bürstadt oder Wasserturm) zur Öffnung des The Things Network (TTN) im Ried.",
          commitmentType: "infrastruktur",
          tag: "Funknetz",
          actionText: "Dachplatz freigeben",
        },
        {
          id: "ask-praesenz",
          title: "3. Schirmherrschaft & Keynote beim 1. Ried-Hackathon",
          description: "Offizielle Schirmherrschaft durch die Bürgermeisterin / den Bürgermeister beim 48h-Hackathon im KAMÜ Bürstadt inklusive Begrüßungs-Keynote und Stiftung eines Gewinnerpreises.",
          commitmentType: "praesenz",
          tag: "Schirmherrschaft",
          actionText: "Schirmherrschaft zusagen",
        },
        {
          id: "ask-schulen",
          title: "4. Politischer Rückenwind für MINT-Projekttage",
          description: "Empfehlung und Fürsprache bei Schulleitungen im Ried für Sensorbau-Projekttage in Physik und MINT als Vorbereitung auf den Hackathon.",
          commitmentType: "schulen",
          tag: "MINT-Bildung",
          actionText: "Schulen ermutigen",
        },
      ],
      callToAction: {
        primaryText: "Gemeinsame Vereinbarung anbahnen",
        primaryHref: "mailto:info@open-ried.de?subject=Commitment%20Kommunalpolitik%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM prüfen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Hier ist unser konkreter 'Ask': Geben Sie uns die Rohdaten der Parksensoren von smartcity-system.de frei. Erlauben Sie eine Antenne auf dem Rathaus oder Wasserturm. Und übernehmen Sie die Schirmherrschaft für den 1. Ried-Hackathon im KAMÜ. Können wir das heute gemeinsam beschließen?",
        talkingPoints: [
          "Kein Haushaltsbeschluss nötig – reine Verwaltungs- und Kooperationsvereinbarung.",
          "Hohe Sichtbarkeit für Bürgermeisterin und Fraktionen.",
          "Rechtlich sauber und 100% DSGVO-konform.",
        ],
        audienceEngagement:
          "Klicken Sie die Checkboxen auf der Folie interaktiv mit dem Bürgermeister an.",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als Austragungsort.",
      },
    },
    {
      id: "folie-11-live-bonus",
      stepNumber: 11,
      stepLabel: "11 / Live-Daten-Beweis",
      eyebrow: "Live aus dem Hessischen Ried · Während Ihres Vortrags",
      title: "Was im Ried passiert ist, während Sie uns zugehört haben",
      lead: "Unsere Plattform läuft bereits im Hintergrund: Keine Folientheorie, sondern reale Datenströme aus Müllabfuhr, Bahnverkehr, Parkleitsystem und LoRaWAN-Sensorik – passgenau zur Tages- oder Nachtzeit.",
      layout: "live-telemetry-bonus",
      speakerNotes: {
        elevatorPitch:
          "Zum Abschluss der Beweis: Während wir die letzten 10 Minuten gesprochen haben, flossen kontinuierlich Live-Daten aus Bürstadt und dem Ried in unser System. Die Plattform funktioniert heute schon!",
        talkingPoints: [
          "ZAKB Müllabfuhr: Tagsüber reale Leerungen, nachts vorschriftsmäßige Betriebsruhe im Depot Hüttenfeld.",
          "Riedbahn & Nibelungenbahn: Güterverkehr und Reisezüge werden 24/7 über Schrankenschließungen und Fahrten erfasst.",
          "LoRaWAN & Umweltsensoren: Ununterbrochene Messung von CO2, Feinstaub und Bodenfeuchte.",
          "Fazit: Wir müssen nichts neu erfinden, sondern nur gemeinsam den Hebel umlegen.",
        ],
        audienceEngagement:
          "Zeigen Sie auf die Live-Zähler und lassen Sie die Entscheider die Reaktionsschnelligkeit des Dashboards sehen.",
        localHook: "Direkte Live-Anbindung im Kulturzentrum KAMÜ Bürstadt.",
      },
      callToAction: {
        primaryText: "Live-Karte mit diesen Daten öffnen",
        primaryHref: "/?preset=mobility&darstellung=satellit",
        secondaryText: "Zurück zu Folie 1",
        secondaryHref: "#intro",
      },
    },
  ],
};

// ============================================================================
// 2. SCHULEN PITCH DECK (MINT-Bildung & Multiplikator)
// ============================================================================
export const SCHULEN_DECK: PitchDeck = {
  slug: "schulen",
  title: "MINT zum Anfassen: Klimaforschung & Sensorbau an Schulen",
  subtitle:
    "Wie Schüler durch praktisches Löten, Physik und Programmierung eigene Wetterstationen bauen und für den Ried-Hackathon brennen",
  targetAudience: "Schulleitungen, Fachleiter MINT, Physik-, Informatik- & Geografielehrer, Jugend forscht Betreuer",
  category: "bildung",
  badge: "Schulen & Jugendbildung",
  accentColor: "sky",
  estimatedMinutes: 10,
  summary:
    "Schul-Pitch: Fokus auf den Bau von Umweltsensoren. Handwerk (Löten, Zangen) trifft Physik und Full-Stack IT. Schüler werden Botschafter in ihren Familien und Teilnehmer am Ried-Hackathon. Kein Geld von Schulen erbeten!",
  slides: [
    {
      id: "schulen-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & Vision",
      eyebrow: "Zukunftskompetenzen · MINT & Bildung",
      title: "Vom passiven Konsumenten zum aktiven Umweltforscher",
      lead: "Wir bringen echtes Handwerk, moderne Mikrocontroller und Klimaforschung direkt in den Unterricht – Schüler bauen ihre eigene Wetterstation fürs Ried.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/schul-stem-workshop.jpg",
        alt: "Schüler und Lehrer beim Sensor-Workshop im Physiklabor",
        caption: "Praxis pur: Schüler lernen Löten, Verkabeln und physikalische Messmethoden",
      },
      bullets: [
        { title: "Praxis", description: "Lötkolben, Zangen, Sensoren und 3D-Druck Gehäuse montieren", tag: "Handwerk" },
        { title: "Verständnis", description: "Feinstaub, CO2, Treibhauseffekt & LoRaWAN Funk begreifen", tag: "Physik & MINT" },
        { title: "Zukunft", description: "Vorbereitung auf Ausbildung, MINT-Studium & Hackathon", tag: "Chancen" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Liebe Lehrkräfte und Schulleitungen: Schüler lernen heute oft nur noch am Bildschirm. Mit Open Ried Sens bieten wir ein Projekt, bei dem sie wieder selbst löten, schrauben und echte physikalische Sensoren zum Leben erwecken.",
        talkingPoints: [
          "Ideal für Projektwochen, Facharbeiten, MINT-AGs oder Jugend forscht.",
          "Verbindet Werkunterricht, Physik, Informatik und Erdkunde.",
        ],
        audienceEngagement: "Frage an die Lehrer: Wie schwer ist es heute, Schüler mit rein theoretischen Tafelbildern für Physik zu begeistern?",
        localHook: "Schulen in Bürstadt (Erich Kästner-Schule), Lampertheim (Lessing-Gymnasium), Bensheim.",
      },
    },
    {
      id: "schulen-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Die Schüler-Mission",
      eyebrow: "Beweislage · Der blinde Fleck",
      title: "Unsere Heimat fehlt auf den Weltkarten: Schließen wir die Lücke!",
      lead: "Wenn Schüler auf Sensor.Community oder TTN Mapper schauen, sehen sie: Bürstadt und das Ried existieren nicht. Unsere Schüler werden zu Entdeckern, die ihre Heimat sichtbar machen.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Das ist der stärkste pädagogische Hebel: 'Schaut auf die Weltkarte. Da ist ein weißer Fleck über eurer Schule. Ihr baut jetzt die Station, die diesen Fleck tilgt!'",
        talkingPoints: [
          "Schüler publizieren Daten auf einer weltweiten Plattform.",
          "Erzeugt ein tiefes Gefühl von Selbstwirksamkeit und Stolz.",
        ],
        audienceEngagement: "Zeigen Sie den Lehrern die leere Karte um ihre Schule herum.",
        localHook: "0 Feinstaubsensoren im Umkreis vieler Ried-Schulen.",
      },
    },
    {
      id: "schulen-3-curriculum",
      stepNumber: 3,
      stepLabel: "03 / Differenzierte Lernziele",
      eyebrow: "Curriculum · Handwerk, Physik & IT",
      title: "Die 4 Säulen des Sensorbaus im Unterricht",
      lead: "Ein durchdachtes pädagogisches Konzept, das handwerkliche Basiskompetenzen mit Spitzenforschung und Informatik verzahnt.",
      layout: "stem-learning-matrix",
      stemSkills: [
        {
          category: "handwerk",
          title: "1. Praktisches Handwerk",
          skills: ["Sicheres Weichlöten an Lötstationen", "Umgang mit Abisolierzange, Seitenschneider & Pinzette", "Schrauben, Dichtungen anbringen & Gehäusemontage", "3D-Druck-Nachbearbeitung & wetterfestes Versiegeln"],
          targetKids: "Fördert Feinmotorik, Konzentration & handwerkliches Selbstvertrauen",
          targetAdults: "Nimmt Berührungsängste vor Elektronik-Reparaturen",
        },
        {
          category: "sensorik",
          title: "2. Physik & Messverfahren",
          skills: ["Laser-Streulicht-Messung bei Feinstaub (SPS30 PM2.5/PM10)", "NDIR-Infrarotspektroskopie bei CO2 (SCD41)", "I²C-Busprotokoll (SDA/SCL Leitungen verstehen)", "LoRaWAN 868 MHz Funkwellen & Reichweiten"],
          targetKids: "Macht unsichtbare Umweltfaktoren physikalisch begreifbar",
          targetAdults: "Kritisches Verständnis von Messtoleranzen und Klimadaten",
        },
        {
          category: "informatik",
          title: "3. Full-Stack Informatik",
          skills: ["Mikrocontroller-Firmware (C++ / Arduino / PlatformIO)", "The Things Network Payload-Decoder (JavaScript)", "REST-APIs & TimescaleDB Zeitreihendatenbank", "Visualisierung in Next.js & Grafana Dashboards"],
          targetKids: "Echtes Programmieren jenseits von Spielzeug-Lernumgebungen",
          targetAdults: "Einblick in moderne Cloud- & IoT-Architekturen",
        },
        {
          category: "multiplikator",
          title: "4. Multiplikator & Hackathon",
          skills: ["Präsentation der Ergebnisse vor Mitschülern & Eltern", "Sensor am eigenen Haus montieren & Nachbarn begeistern", "Teilnahme am 48h Ried-Hackathon im KAMÜ Bürstadt", "Entwicklung von Daten-Apps gegen den Klimawandel"],
          targetKids: "Stolz auf das eigene Werk; Sprungbrett zum Hackathon",
          targetAdults: "Aktiver Beitrag zur regionalen Bürgerwissenschaft",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Hier sehen Sie die Lernmatrix: Wir fangen beim Löten an, gehen über die Physik optischer Sensoren und landen bei der Web-API. Das ist handfeste MINT-Bildung von A bis Z.",
        talkingPoints: [
          "Lehrkräfte müssen das Rad nicht neu erfinden: Wir stellen fertige Unterrichtsmodule bereit.",
          "Passt perfekt in den hessischen Bildungsplan für naturwissenschaftliche Fächer.",
        ],
        audienceEngagement: "Welche dieser 4 Säulen ist an Ihrer Schule aktuell am meisten unterrepräsentiert?",
        localHook: "Kooperation mit regionalen Ausbildungsbetrieben in Bürstadt.",
      },
    },
    {
      id: "schulen-4-product",
      stepNumber: 4,
      stepLabel: "04 / Der 3-Stunden-Bausatz",
      eyebrow: "Didaktisch erprobt · Sicher & Bezahlbar",
      title: "Schutzkleinspannung (3,3V): Sicher für Schülerhände",
      lead: "Kein gefährlicher Netzstrom, keine giftigen Dämpfe: Der Bausatz läuft mit USB-C und ist in einer Doppelstunde aufgebaut.",
      layout: "product-architecture",
      imageVisual: {
        src: "/pitch/sensor-hardware-kit.jpg",
        alt: "Bausatz Platine und Stevenson Screen",
        caption: "RAK3113 Mikrocontroller mit Sensirion Sensoren im Stevenson Screen",
      },
      stats: [
        { value: "3,3 V", label: "Schutzkleinspannung", subtext: "Absolut ungefährlich", color: "emerald" },
        { value: "3 Std.", label: "Bauzeit im Workshop", subtext: "Passend für Projekttag", color: "sky" },
        { value: "< 100 €", label: "Materialkosten", subtext: "Gefördert durch Sponsoren / Paten", color: "violet" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Der Bausatz ist so konstruiert, dass Schüler in 3 Stunden ein garantiertes Erfolgserlebnis haben. Die Platine ist übersichtlich, die Anschlüsse sind verpolungssicher.",
        talkingPoints: [
          "Industriesensoren von Sensirion (Schweiz): Echte Messwerte statt Spielzeug.",
          "Schüler nehmen ihren fertigen Sensor mit nach Hause oder montieren ihn auf dem Schuldach.",
        ],
        audienceEngagement: "Zeigen Sie, wie kompakt die Platine in das Gehäuse passt.",
        localHook: "Werkräume an Bürstädter Schulen oder das KAMÜ.",
      },
    },
    {
      id: "schulen-5-multiplikator",
      stepNumber: 5,
      stepLabel: "05 / Der Multiplikator-Effekt",
      eyebrow: "Von der Schule in die Region · Begeisterung wächst",
      title: "Wie der Schul-Sensorbau zum Motor des Hackathons wird",
      lead: "Wenn 20 Schüler einen Sensor bauen, stehen 20 neue Messstationen an Bürstädter Häusern. Eltern, Nachbarn und Geschwister werden neugierig – und melden sich zum Ried-Hackathon an.",
      layout: "value-prop-split",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Vom Schulprojekt zum großen Hackathon",
        caption: "Schüler und Eltern erleben den Hackathon im KAMÜ Bürstadt",
      },
      bullets: [
        { title: "Stolz am Gartenzaun", description: "Schüler erklären ihren Eltern und Nachbarn, wie der Sensor funktioniert.", tag: "Mundpropaganda" },
        { title: "Bürger-Commitment", description: "Bürger verstehen den Wert offener Daten, weil sie sie vor ihrer eigenen Tür sehen.", tag: "Teilhabe" },
        { title: "Hackathon-Teilnehmer", description: "Schüler-Teams treten beim 48h-Hackathon im KAMÜ gegen Software-Profis an.", tag: "Event-Hebel" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Das ist der psychologische Multiplikator: Ein Schüler, der mit leuchtenden Augen zuhause seinen Sensor anschließt, überzeugt die ganze Familie. Das ist die beste Werbung für den Ried-Hackathon!",
        talkingPoints: [
          "Der Hackathon ist der Höhepunkt, wo aus den Sensordaten echte Software und KI-Modelle entstehen.",
          "Schüler erleben hautnah, wofür sie Mathematik und Informatik lernen.",
        ],
        audienceEngagement: "Erinnern Sie sich an Ihr erstes technisches Werkstück, auf das Sie stolz waren?",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als Treffpunkt aller Generationen.",
      },
    },
    {
      id: "schulen-6-ask",
      stepNumber: 6,
      stepLabel: "06 / The Ask an die Schulleitung",
      eyebrow: "Keine Schulgelder gefordert · Reine Partnerschaft",
      title: "Unser 'Ask' an Schulleitung & Lehrerkollegium",
      lead: "Wir fordern kein Schulbudget: Die Finanzierung der Bausätze übernehmen Firmenpaten, Fördervereine oder Eltern/Großeltern im Projektrahmen. Wir bitten um Raum, Ankündigung und Begeisterung.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "schul-ankündigung",
          title: "1. Schulisches Announcement & MINT-Projekttag",
          description: "Ankündigung an der Schule durch Schulleitung oder Physiklehrer: Einbindung in eine Projektwoche oder MINT-AG ('Wir bauen unsere eigene Schul-Wetterstation').",
          commitmentType: "schulen",
          tag: "Unterricht",
          actionText: "Projekttag festlegen",
        },
        {
          id: "schul-schuldach",
          title: "2. Dachstandort für offizielle Schulstation",
          description: "Montage einer fertigen Station auf dem Schuldach: Liefert 24/7 echte Messwerte direkt in Physik-, Erdkunde- und Informatikstunden.",
          commitmentType: "infrastruktur",
          tag: "Messpunkt",
          actionText: "Schuldach bereitstellen",
        },
        {
          id: "schul-hackathon-team",
          title: "3. Schülerteams für den Ried-Hackathon im KAMÜ",
          description: "Ermutigung und Entsendung motivierter Schülerteams (Physik, IT, Mathe) zum 48h Ried-Hackathon im Kulturzentrum KAMÜ Bürstadt.",
          commitmentType: "praesenz",
          tag: "Hackathon",
          actionText: "Teams entsenden",
        },
        {
          id: "schul-multiplikator",
          title: "4. Multiplikator in Familie & Nachbarschaft",
          description: "Schüler montieren ihren Sensor am eigenen Haus – gelebte Werbung und Begeisterung für digitale Bildung in Bürstadt und Umgebung.",
          commitmentType: "daten",
          tag: "Bürgerstolz",
          actionText: "Begeisterung teilen",
        },
      ],
      callToAction: {
        primaryText: "Schul-Workshop buchen",
        primaryHref: "mailto:schulen@open-ried.de?subject=Anfrage%20Schulworkshop%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM ansehen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Liebe Schulleitungen: Wir wissen, wie knapp Schulbudgets sind. Wir wollen kein Geld von Ihrer Schule! Die Bausätze werden über lokale Unternehmenspaten (100 € pro Schüler), Fördervereine oder Eltern finanziert. Wir brauchen von Ihnen nur einen Projekttag und motivierte Schüler.",
        talkingPoints: [
          "0 Euro Belastung für den Schuletat.",
          "Schule erhält ein modernes MINT-Profil und Presseaufmerksamkeit.",
          "Schüler erwerben zukunftsrelevante handwerkliche und digitale Kompetenzen.",
        ],
        audienceEngagement: "Fragen Sie die Lehrer: 'Welche Klassenstufe würde bei Ihnen dafür brennen?'",
        localHook: "Kulturzentrum KAMÜ Bürstadt bietet auch externe Werkräume.",
      },
    },
    {
      id: "schulen-7-live-bonus",
      stepNumber: 7,
      stepLabel: "Bonus / Live-Daten-Beweis",
      eyebrow: "Live aus dem Hessischen Ried · Während Ihres Vortrags",
      title: "Was im Ried passiert ist, während Sie uns zugehört haben",
      lead: "Unsere Plattform erfasst bereits im Hintergrund reale Datenströme aus Müllabfuhr, Bahnverkehr und LoRaWAN-Sensorik – genau diese Daten erforschen Ihre Schüler!",
      layout: "live-telemetry-bonus",
      speakerNotes: {
        elevatorPitch:
          "Sehen Sie sich diese Live-Zahlen an: Während wir 10 Minuten über MINT-Bildung gesprochen haben, flossen hunderte reale Telemetrie-Pakete in unser Dashboard!",
        talkingPoints: [
          "Schüler arbeiten nicht mit veralteten Lehrbuch-Beispielen, sondern mit lebendigen Daten ihrer Heimat.",
          "ZAKB Müllabfuhr, Riedbahn-Züge und Umweltdaten sind synchronisiert.",
        ],
        audienceEngagement: "Zeigen Sie den Schülern oder Lehrern die tickenden Messwerte.",
        localHook: "Kulturzentrum KAMÜ Bürstadt als zentraler Datenserver.",
      },
      callToAction: {
        primaryText: "Live-Karte mit diesen Daten öffnen",
        primaryHref: "/?preset=mobility&darstellung=satellit",
        secondaryText: "Zurück zu Folie 1",
        secondaryHref: "#intro",
      },
    },
  ],
};

// ============================================================================
// 3. VHS & ERWACHSENENBILDUNG PITCH DECK
// ============================================================================
export const VHS_DECK: PitchDeck = {
  slug: "vhs",
  title: "Digitale Mündigkeit & Citizen Science für alle Generationen",
  subtitle:
    "Löten, verstehen und mitforschen von 18 bis 80 Jahren: Bürgerwissenschaft an der Volkshochschule",
  targetAudience: "Leitungen der Volkshochschulen (VHS Bergstraße, VHS Lampertheim), Seniorenbeiräte, Bildungsinitiativen",
  category: "bildung",
  badge: "Erwachsenenbildung & VHS",
  accentColor: "violet",
  estimatedMinutes: 10,
  summary:
    "VHS-Pitch: Handwerkliches Löten und Sensorbau als generationenübergreifender Bildungsbaustein. Von 18 bis 80 Jahren. Bürger verstehen Umweltmesswerte und werden stolze Botschafter für den Hackathon.",
  slides: [
    {
      id: "vhs-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & Bildungsauftrag",
      eyebrow: "Lebenslanges Lernen · Bürgerwissenschaft",
      title: "Digitalisierung begreifen statt fürchten",
      lead: "An der Volkshochschule machen wir Smart-City-Technologie anfassbar: Bürgerinnen und Bürger bauen ihre eigene Umweltstation und verstehen, wie Daten entstehen.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/sensor-hardware-kit.jpg",
        alt: "Erwachsene beim Löten im Werkraum",
        caption: "Vom Bauteil zur fertigen Wetterstation: Praktisches Lernen ohne Vorwissen",
      },
      bullets: [
        { title: "Niedrigschwellig", description: "Löten lernen von Grund auf – mit Geduld und Freude", tag: "Handwerk" },
        { title: "Aufklärung", description: "Feinstaub & Hitze objektiv messen statt Stammtischparolen", tag: "Fakten" },
        { title: "Gemeinschaft", description: "Generationenübergreifendes Tüfteln im Kulturzentrum KAMÜ", tag: "Begegnung" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Damen und Herren der Volkshochschulen: Viele Menschen fühlen sich von der rasanten Digitalisierung überrollt. Unser Kurs holt die Menschen ab – durch praktisches Selberbauen und offene Daten.",
        talkingPoints: [
          "Volkshochschulen haben den öffentlichen Auftrag zur digitalen Souveränität.",
          "Verbindung aus praktischem Werken und digitaler Mündigkeit.",
        ],
        audienceEngagement: "Frage: Wie viele Ihrer Hörer möchten Technik nicht nur bedienen, sondern verstehen?",
        localHook: "Kurse im Kulturzentrum KAMÜ Bürstadt oder in den VHS-Standorten.",
      },
    },
    {
      id: "vhs-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Die Datenlücke im Ried",
      eyebrow: "Bürgerauftrag · Citizen Science",
      title: "Warum das Ried auf Bürgerforscher angewiesen ist",
      lead: "Staatliche Messstellen stehen nur in Großstädten. Auf Sensor.Community und TTN Mapper ist das Hessische Ried weiß. Wir schließen die Lücke selbst.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Die staatlichen Messstationen des Umweltamts stehen in Darmstadt oder Mannheim. Wie es in Bürstadt oder Lampertheim aussieht, erfährt man dort nicht.",
        talkingPoints: [
          "Bürgerforschung (Citizen Science) schließt diese Lücke.",
          "Teilnehmer werden Teil einer weltweiten Gemeinschaft.",
        ],
        audienceEngagement: "Zeigen Sie den Stolz der Teilnehmer, wenn ihr eigener Punkt auf der Karte erscheint.",
        localHook: "Keine offizielle PM2.5-Station des Landes im Riedkern!",
      },
    },
    {
      id: "vhs-3-curriculum",
      stepNumber: 3,
      stepLabel: "03 / Das 3-teilige Kurskonzept",
      eyebrow: "Didaktik · Für das Semesterprogramm",
      title: "Vom Bauteil zum Dashboard in 3 Terminen",
      lead: "Didaktisch erprobt: Schritt für Schritt vom Lötkolben bis zur grafischen Auswertung auf Smartphone und Tablet.",
      layout: "stem-learning-matrix",
      stemSkills: [
        {
          category: "handwerk",
          title: "Modul 1: Handwerk & Löten",
          skills: ["Lötstation sicher bedienen", "Widerstände, Kondensatoren & ICs bestücken", "Kabel abisolieren & Steckverbinder crimpen", "Gehäuse wetterfest montieren"],
          targetKids: "Basiswerkzeuge kennenlernen",
          targetAdults: "Alte Fertigkeiten auffrischen oder neu erlernen (auch für Senioren ideal)",
        },
        {
          category: "sensorik",
          title: "Modul 2: Umweltphysik & Sensorik",
          skills: ["Feinstaub PM2.5/PM10 verstehen", "CO2-Konzentration & Lüftungsampeln", "LoRaWAN 868 MHz Funk ohne Strahlungssorgen", "Einfluss von Verkehr & Kaminöfen analysieren"],
          targetKids: "Naturwissenschaftliche Neugier wecken",
          targetAdults: "Gesundheitliche und meteorologische Zusammenhänge begreifen",
        },
        {
          category: "informatik",
          title: "Modul 3: Daten & Dashboard",
          skills: ["Station am Heim-WLAN oder LoRa anmelden", "Live-Telemetrie auf open-ried.de abrufen", "Eigene Benachrichtigungen einrichten", "Datenexport als CSV für Excel-Auswertungen"],
          targetKids: "Erste Schritte in die Datenanalyse",
          targetAdults: "Volle Kontrolle über die eigenen Hausdaten behalten",
        },
        {
          category: "multiplikator",
          title: "Abschluss: Hackathon & Community",
          skills: ["Präsentation der Station im Freundeskreis", "Erfahrungsaustausch im monatlichen Maker-Treff", "Teilnahme am Ried-Hackathon als Bürger-Experte"],
          targetKids: "Gemeinschaftserlebnis",
          targetAdults: "Aktive Teilhabe am gesellschaftlichen Diskurs",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Das Kurskonzept ist schlüsselfertig vorbereitet: Stückliste, Foliensatz, Dozentenleitfaden und Begleitunterlagen stehen bereit.",
        talkingPoints: [
          "Teilnehmergebühr deckt Bausatz und VHS-Kursgebühr.",
          "Keine Vorkenntnisse nötig – wir fangen bei Null an.",
        ],
        audienceEngagement: "Fragen Sie nach dem nächsten Redaktionsschluss des Programmkatalogs.",
        localHook: "Kulturzentrum KAMÜ als barrierefreier Kursort.",
      },
    },
    {
      id: "vhs-4-ask",
      stepNumber: 4,
      stepLabel: "04 / The Ask an die VHS-Leitung",
      eyebrow: "Kooperation · Nächste Schritte",
      title: "Unser 'Ask' an die Volkshochschule",
      lead: "Lassen Sie uns den Kurs im nächsten Semesterheft platzieren. Wir liefern den Inhalt, Sie die Reichweite.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "vhs-programm",
          title: "1. Aufnahme ins kommende Kursprogramm",
          description: "Aufnahme des 3-teiligen Kurses 'Mein eigener Umweltsensor' in das VHS-Programmheft (Kategorie Mensch & Umwelt / Digital).",
          commitmentType: "schulen",
          tag: "Kursprogramm",
          actionText: "Programmtext übernehmen",
        },
        {
          id: "vhs-dozenten",
          title: "2. Bereitstellung von Dozenten & Werkzeug",
          description: "Wir stellen zertifizierte Maker und Dozenten aus dem KAMÜ Bürstadt sowie mobile Lötstationen.",
          commitmentType: "infrastruktur",
          tag: "Dozenten",
          actionText: "Dozentenvertrag schließen",
        },
        {
          id: "vhs-hackathon-bruecke",
          title: "3. Einladung zum Ried-Hackathon",
          description: "VHS-Teilnehmer erhalten kostenfreien Zugang zum Ried-Hackathon im KAMÜ, um ihre Projekte dort zu präsentieren.",
          commitmentType: "praesenz",
          tag: "Hackathon-Brücke",
          actionText: "Kooperation vereinbaren",
        },
      ],
      callToAction: {
        primaryText: "VHS-Kurskonzept anfordern",
        primaryHref: "mailto:vhs@open-ried.de?subject=Kooperation%20VHS%20Open%20Ried%20Sens",
        secondaryText: "Online-Bauanleitung ansehen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Wir nehmen Ihnen die gesamte Arbeit ab: Text, Dozent und Material kommen von uns, Sie stellen den Raum und die Ausschreibung.",
        talkingPoints: [
          "Erfahrungsgemäß sind solche Maker-Kurse extrem schnell ausgebucht.",
          "Gerne halten wir vorab einen kostenlosen Schnupper-Vortrag.",
        ],
        audienceEngagement: "Überreichen Sie den fertigen Textentwurf für den Katalog.",
        localHook: "Bürstadt Kulturzentrum KAMÜ.",
      },
    },
    {
      id: "vhs-5-live-bonus",
      stepNumber: 5,
      stepLabel: "Bonus / Live-Daten-Beweis",
      eyebrow: "Live aus dem Hessischen Ried · Während Ihres Vortrags",
      title: "Was im Ried passiert ist, während Sie uns zugehört haben",
      lead: "Unsere Plattform läuft live: Reale Umweltdaten, Bahnverkehr und ZAKB-Telemetrie – passgenau zur Tages- oder Nachtzeit.",
      layout: "live-telemetry-bonus",
      speakerNotes: {
        elevatorPitch:
          "Hier sehen Sie das Ergebnis: Live-Messwerte aus dem Ried, die Teilnehmer in wenigen Kursabenden selbst erfassen und verstehen können!",
        talkingPoints: [
          "Bürger lernen, wie Sensoren Daten erzeugen und über Funk ins Dashboard senden.",
          "Keine Angst vor Technik – greifbare Realität.",
        ],
        audienceEngagement: "Zeigen Sie den Live-Zähler auf dem Beamer.",
        localHook: "KAMÜ Bürstadt.",
      },
      callToAction: {
        primaryText: "Live-Karte öffnen",
        primaryHref: "/?preset=mobility&darstellung=satellit",
        secondaryText: "Zurück zu Folie 1",
        secondaryHref: "#intro",
      },
    },
  ],
};

// ============================================================================
// 4. REGIONALE WIRTSCHAFT & STADTWERKE PITCH DECK
// ============================================================================
export const WIRTSCHAFT_DECK: PitchDeck = {
  slug: "wirtschaft",
  title: "Betriebsnutzen & Fachkräfte: Kooperation mit regionaler Wirkung",
  subtitle:
    "CSR (Corporate Social Responsibility), Nachwuchs-Recruiting und smarte Sensorik für Betriebe im Ried",
  targetAudience: "Geschäftsführer, Inhaber von Handwerks- & Gewerbebetrieben, Stadtwerke & IT-Unternehmen",
  category: "wirtschaft",
  badge: "Wirtschaft & Stadtwerke",
  accentColor: "amber",
  estimatedMinutes: 10,
  summary:
    "Wirtschafts-Pitch: CSR ausgeschrieben (Corporate Social Responsibility), reale betriebliche Probleme lösen (Logistik, Bahnübergänge, Kühlketten, Raumklima), 100 € Sensor-Schulpate oder In-House Azubi-Workshop, flexibles Hackathon-Sponsoring ohne starre Beträge, LoRaWAN für Nicht-Techniker erklärt & Live-Telemetrie-Beweis.",
  slides: [
    {
      id: "wirt-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & Echte CSR",
      eyebrow: "Regionale Verantwortung · Fachkräfte & MINT",
      title: "Investieren in Fachkräfte und ein vernetztes Ried: Echte CSR vor Ort",
      lead: "Statt austauschbarer Bandenwerbung oder anonymer Zertifikate: Wir leben **CSR (Corporate Social Responsibility / gesellschaftliche Verantwortung von Unternehmen)** direkt vor Ihrer Haustür. Fördern Sie MINT-Kompetenzen an Schulen und vernetzen Sie Ihren eigenen Betrieb.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Junge Talente beim Hackathon",
        caption: "Fachkräfte finden: Motivierte Schüler, Azubis und Entwickler beim Hackathon im KAMÜ Bürstadt",
      },
      bullets: [
        {
          title: "CSR ausgeschrieben & gelebt",
          description: "Corporate Social Responsibility bedeutet für uns: Jugendliche vor Ort für Technologie begeistern, statt weit entfernte Ausgleichsmaßnahmen zu kaufen.",
          tag: "Echte CSR",
        },
        {
          title: "Recruiting ohne Personalberater",
          description: "Lernen Sie beim Ried-Hackathon im KAMÜ motivierte Schüler, Azubis und Entwickler persönlich bei der Teamarbeit kennen.",
          tag: "Fachkräfte",
        },
        {
          title: "Betriebsvernetzung ohne Funkkosten",
          description: "Nutzen Sie das freie LoRaWAN-Funknetz für Ihren eigenen Betrieb: Keine monatlichen SIM-Karten, keine teuren WLAN-Kabel.",
          tag: "Smarte Betriebe",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Unternehmerinnen und Unternehmer: Wir kennen das Buzzword CSR – Corporate Social Responsibility, also die unternehmerische Gesellschaftsverantwortung. Mit Open Ried Sens wird CSR greifbar: Sie fördern Jugendliche direkt an unseren Schulen und erhalten gleichzeitig Zugang zu cleveren Nachwuchskräften und moderner IoT-Funktechnik für Ihren Betrieb.",
        talkingPoints: [
          "Echtes soziales Engagement in der Heimatregion statt anonymer Zertifikate.",
          "Verbindung aus Nachwuchs-Recruiting, gesellschaftlicher Wirkung und praktischem Betriebsnutzen.",
          "Kulturzentrum KAMÜ in Bürstadt als Treffpunkt der regionalen Wirtschaft.",
        ],
        audienceEngagement:
          "Frage: Wie schwer fällt es Ihnen aktuell, technisch interessierte Azubis und Fachkräfte im Ried zu finden?",
        localHook: "Standort Bergstraße / Metropolregion Rhein-Neckar.",
      },
    },
    {
      id: "wirt-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Reale Betriebsprobleme lösen",
      eyebrow: "Reale Herausforderungen · Offen für Firmen-Challenges",
      title: "Reale betriebliche Herausforderungen mit Daten & schlauen Köpfen lösen",
      lead: "Es geht nicht nur um das Klima: Ob Logistikverzögerungen an Bahnübergängen, Kühlketten-Ausfälle, Hallenklima, Spitzenlasten oder Parkraum – wir bringen Daten und kreative Köpfe an einen Tisch, um konkrete betriebliche Probleme zu knacken.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      bullets: [
        {
          title: "Logistik & Bahnübergänge",
          description: "Lieferverzögerungen durch geschlossene Schranken (z.B. B47 Bobstadt / Bürstadt) in Echtzeit vorhersagen und Routen optimieren.",
          tag: "Logistik",
        },
        {
          title: "Kühlketten & Hallenmonitoring",
          description: "Beispiel Bäckerei, Handwerk & Frischehandel: Kühlräume, Silos und Maschinenhallen rund um die Uhr überwachen – zuverlässig durch dicke Mauern hindurch.",
          tag: "Betriebssicherheit",
        },
        {
          title: "Ihre Challenge beim Hackathon",
          description: "Bringen Sie Ihre eigene reale Problemstellung als Challenge in den 48h-Hackathon im KAMÜ ein – multidisziplinäre Teams entwickeln funktionierende Prototypen!",
          tag: "Co-Innovation",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Wir sind keine Theoretiker: Uns geht es um reale betriebliche Schmerzpunkte. Stehen Ihre Lieferfahrzeuge regelmäßig vor geschlossenen Schranken an der B47? Müssen Sie Kühlräume oder Silos überwachen? Genau solche Aufgabenstellungen lösen wir mit Sensorik und kreativen Köpfen beim Ried-Hackathon.",
        talkingPoints: [
          "Wir sind offen für ganz reale Problemstellungen regionaler Firmen.",
          "Kombination aus Live-Telemetrie und kreativer Softwareentwicklung im KAMÜ.",
          "Konkreter Mehrwert für Handwerk, Logistik, Bäckereien und Industrie.",
        ],
        audienceEngagement:
          "Frage an die Unternehmer: Welcher Prozess in Ihrem Betrieb kostet Sie aktuell die meisten Nerven oder unnötig Geld?",
        localHook: "Gewerbegebiete Bürstadt-Ost, Bobstadt und Lampertheim.",
      },
    },
    {
      id: "wirt-3-ask",
      stepNumber: 3,
      stepLabel: "03 / The Ask an Unternehmen & Stadtwerke",
      eyebrow: "Flexible Partnerschaft · Ohne starre Beträge",
      title: "Sensor-Schulpate (100 €), In-House Azubi-Workshops & Hackathon-Support",
      lead: "Vom 100-€-Schulpatesatz bis zum betriebsinternen Azubi-Workshop: Wir bieten maßgeschneiderte Kooperationen mit echtem Mehrwert für Ihr Unternehmen.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "sponsor-schulpate",
          title: "1. Sensor-Schulpate (100 € pro Schüler)",
          description: "Finanzieren Sie einem Schüler den kompletten Bausatz für den MINT-Projekttag. Sponsoring für einzelne Kinder oder ganze Klassen (10–20 Schüler) möglich inklusive Logo auf der Station.",
          commitmentType: "schulen",
          tag: "100 € Schulpate",
          actionText: "Schulpate werden",
        },
        {
          id: "sponsor-inhouse",
          title: "2. In-House Workshop für Mitarbeiter & Azubis",
          description: "Interne Tech-Weiterbildung: Ihre Azubis und Mitarbeiter bauen Sensoren selbst im Betrieb, lernen Elektronik und vernetzen das eigene Firmengelände kostenlos.",
          commitmentType: "infrastruktur",
          tag: "Betriebs-Workshop",
          actionText: "Workshop buchen",
        },
        {
          id: "sponsor-hackathon-flex",
          title: "3. Hackathon-Sponsor & Challenge-Stifter (flexibel)",
          description: "Unterstützung ohne starre Beträge: Stiften Sie Sachpreise für Gewinner, sponsern Sie das Catering, öffnen Sie Ihre Türen für eine Werksführung oder stellen Sie eine reale Firmen-Challenge.",
          commitmentType: "finanzen",
          tag: "Freies Sponsoring",
          actionText: "Beitrag besprechen",
        },
        {
          id: "sponsor-lora-verstaendnis",
          title: "4. LoRaWAN einfach erklärt: Funk durch Wände",
          description: "Für Nicht-Techniker: LoRaWAN funktioniert wie ein extrem weitreichendes Funkgerät. Es dringt durch dicke Mauern, Keller und Kühlräume – ohne WLAN-Passwörter, ohne SIM-Karten und ohne monatliche Gebühren.",
          commitmentType: "daten",
          tag: "Einfach erklärt",
          actionText: "Signalabdeckung prüfen",
        },
      ],
      callToAction: {
        primaryText: "Unternehmens-Gespräch vereinbaren",
        primaryHref: "mailto:partner@open-ried.de?subject=Wirtschaft%20Kooperation%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM ansehen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Hier sind unsere Kooperationsmodelle: Werden Sie Schulpate für 100 Euro pro Kind, oder machen Sie einen internen Workshop mit Ihren eigenen Azubis und Mitarbeitern – kostenlose Weiterbildung und Vernetzung inklusive! Und beim Hackathon gibt es keine starren Summen: Ob Sachpreis, Challenge-Stiftung oder Catering, jeder Beitrag zählt.",
        talkingPoints: [
          "LoRaWAN einfach erklärt: Wie ein Funkgerät, das kilometerweit durch Mauern und Kühlhäuser reicht, ohne laufende Kosten.",
          "100 € pro Kind ist für jedes Unternehmen leistbar und schafft direkte Bindung zu Schülern.",
          "In-House-Workshops bringen Digitalisierung und Maker-Spirit direkt in Ihren Betrieb.",
        ],
        audienceEngagement:
          "Bieten Sie an: 'Wollen wir bei Ihren Azubis mit einem 3-stündigen Löt- und Sensor-Workshop starten?'",
        localHook: "Kulturzentrum KAMÜ Bürstadt als neutraler Eventort.",
      },
    },
    {
      id: "wirt-4-live-bonus",
      stepNumber: 4,
      stepLabel: "04 / Live-Telemetrie-Beweis",
      eyebrow: "Live aus dem Hessischen Ried · Während Ihres Vortrags",
      title: "Was im Ried passiert ist, während Sie uns zugehört haben",
      lead: "Unsere Plattform läuft bereits im Hintergrund: Reale Datenströme aus Müllabfuhr, Bahnverkehr, Parkleitsystem und LoRaWAN-Sensorik – passgenau zur Tages- oder Nachtzeit.",
      layout: "live-telemetry-bonus",
      speakerNotes: {
        elevatorPitch:
          "Schauen Sie auf diese Zahlen: Während unserer Präsentation liefen reale Messungen aus dem Ried ein. Das System steht und kann morgen auch Ihre Betriebsdaten aufnehmen!",
        talkingPoints: [
          "Zeigt Unternehmen, dass die Technologie reif für den Praxiseinsatz ist.",
          "Verknüpfung von kommunalen, betrieblichen und bürgerschaftlichen Datenströmen.",
        ],
        audienceEngagement: "Zeigen Sie den Live-Zähler auf dem Beamer.",
        localHook: "Kulturzentrum KAMÜ Bürstadt.",
      },
      callToAction: {
        primaryText: "Live-Karte mit diesen Daten öffnen",
        primaryHref: "/?preset=mobility&darstellung=satellit",
        secondaryText: "Zurück zu Folie 1",
        secondaryHref: "#intro",
      },
    },
  ],
};

// ============================================================================
// EXPORT ALL DECKS (Politik, Schulen, VHS, Wirtschaft)
// ============================================================================
export const PITCH_DECKS: PitchDeck[] = [
  POLITIK_DECK,
  SCHULEN_DECK,
  VHS_DECK,
  WIRTSCHAFT_DECK,
];

export function getPitchDeckBySlug(slug: string): PitchDeck | undefined {
  return PITCH_DECKS.find((deck) => deck.slug === slug);
}
