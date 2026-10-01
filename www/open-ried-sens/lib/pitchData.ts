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
  | "unit-economics"
  | "competitive-matrix"
  | "traction-timeline"
  | "stem-learning-matrix"
  | "team-showcase"
  | "the-ask-commitment";

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
  category: "politik" | "bildung" | "community" | "wirtschaft" | "umwelt";
  badge: string;
  accentColor: "emerald" | "sky" | "violet" | "amber" | "teal";
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
      "Das offene Funknetzwerk für Sensoren ohne SIM-Karten. Die Heatmap belegt: LoRaWAN existiert nur punktuell entlang Autobahnen (A67, B47) durch mobile Mapper. Ortskerne, Schulen, Ackerbauflächen und Industriegebiete im Ried sind unterversorgt.",
    riedStatus: "Lückenhafte Abdeckung – kein flächendeckender Empfang für Bürger- & Schulsensoren vorhanden.",
    impactBadge: "Kritische Funklöcher im Innenbereich",
  },
  {
    serviceName: "Raspberry Shake (Seismik & Vibration)",
    serviceUrl: "https://raspberryshake.org/",
    imagePath: "/pitch/raspberry-shake-ried-map.png",
    headline: "Bodenerschütterung, Geothermie & Riedbahn",
    description:
      "Globales Bürgernetzwerk für Seismometer. Im geothermisch hochaktiven Oberrheingraben und entlang der hochfrequentierten Riedbahn-Trasse gibt es im gesamten Altkreis nur eine einzige Station (Bürstadt/Lampertheim Grenze).",
    riedStatus: "Praktisch ein Totalausfall für Bürgerwissenschaft im sensiblen Oberrheingraben.",
    impactBadge: "Nur 1 Station im Umkreis von 25 km",
  },
];

// ============================================================================
// 1. POLITIK PITCH DECK (10 Folien Startup-Storytelling)
// ============================================================================
export const POLITIK_DECK: PitchDeck = {
  slug: "politik",
  title: "Smarte Daseinsvorsorge & Datenhoheit fürs Hessische Ried",
  subtitle:
    "Wie Bürstadt & die Ried-Kommunen mit offenen LoRaWAN-Sensoren und einem 48h Bürger-Hackathon echte Unabhängigkeit schaffen",
  targetAudience: "Bürgermeister, Landräte, Beigeordnete, Stadträte, Bauamtsleiter & Fraktionen",
  category: "politik",
  badge: "Kommunale Daseinsvorsorge",
  accentColor: "emerald",
  estimatedMinutes: 12,
  summary:
    "10-teiliger Startup-Pitch für die Kommunalpolitik: Vom Daten-Blindfleck zur Daseinsvorsorge ohne Vendor Lock-in. Mit konkreten Bitten: Rohdaten-Zugriff, Gateway-Öffnung, Hackathon-Schirmherrschaft.",
  slides: [
    {
      id: "folie-1-title",
      stepNumber: 1,
      stepLabel: "01 / One-Pager & Hook",
      eyebrow: "Smarte Region Bergstraße · Hessen",
      title: "Open Ried Sens: Daseinsvorsorge aus Bürgerhand statt teurer Konzerngutachten",
      lead: "Wir vernetzen das Hessische Ried mit freiem LoRaWAN-Funk und offenen Umweltdaten. 10x günstiger, 100% datenschutzkonform und gemeinsam mit Bürgern und Schulen gebaut.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Hackathon im Kulturzentrum KAMÜ Bürstadt",
        caption: "Das Kulturzentrum KAMÜ in Bürstadt als Innovations-Labor für das Hessische Ried",
      },
      bullets: [
        { title: "Initiative", description: "Bürgerwissenschaftliches Open-Data-Netzwerk im Ried", tag: "Open Source" },
        { title: "Zentrum", description: "Kulturzentrum KAMÜ in Bürstadt als Innovations-Labor", tag: "Bürstadt" },
        { title: "Mission", description: "Echtzeit-Messung von Hitze, Trockenheit, Lärm & Hochwasser", tag: "Daseinsvorsorge" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Damen und Herren Bürgermeister und Landräte: Wir müssen Digitalisierung nicht für Millionenbeträge bei Konzernen einkaufen. Mit Open Ried Sens zeigen wir, wie Bürstadt und das Ried zum hessischen Vorbild für offene, bürgernahe Daseinsvorsorge werden.",
        talkingPoints: [
          "Kommunen stehen vor der Pflicht zur Klimafolgenanpassung (§ 12 Hessisches Klimagesetz).",
          "Bisher fehlen dafür kleinräumige, hochauflösende Messdaten aus den Wohnquartieren.",
          "Wir bringen Hardware, Software, Bürger und Schulen zusammen.",
        ],
        audienceEngagement:
          "Frage in die Runde: Wissen Sie, wie heiß die Marktplätze in Bürstadt oder Lampertheim an Tropennächten wirklich bleiben?",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als offener Treffpunkt.",
      },
    },
    {
      id: "folie-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Das Problem & Pain Point",
      eyebrow: "Beweislage · Der digitale Blindfleck",
      title: "Das Hessische Ried existiert auf Weltkarten nicht",
      lead: "Ein Blick auf Sensor.Community, TTN Mapper und Raspberry Shake belegt: Zwischen den Ballungsräumen Worms, Darmstadt und Mannheim klafft im Ried eine gravierende Datenlücke.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Schauen Sie sich diese drei Karten an. Das ist kein Zufall, das ist eine systematische Unterversorgung des ländlichen Raums im Ried. Während Heidelberg und Darmstadt grün vor Messpunkten sind, ist das Ried weiß.",
        talkingPoints: [
          "Sensor.Community: Keine Feinstaubdaten zwischen Worms und Lorsch.",
          "TTN Mapper: LoRa-Funk gibt es nur sporadisch dort, wo LKWs mit Messgeräten über die Autobahn fuhren.",
          "Raspberry Shake: Im seismisch aktiven Oberrheingraben gibt es nur 1 Station.",
          "Fazit: Wenn wir es nicht selbst anpacken, liefert uns niemand diese Daten.",
        ],
        audienceEngagement:
          "Lassen Sie die Folie kurz wirken. Betonen Sie: 'Wir warten nicht auf Berlin oder Wiesbaden – wir lösen das hier vor Ort!'",
        localHook: "Besonders Biblis, Groß-Rohrheim und Bürstadt-Ortsteile (Bobstadt, Riedrode) haben 0 Sensoren.",
      },
    },
    {
      id: "folie-3-solution",
      stepNumber: 3,
      stepLabel: "03 / Die Lösung & Value Proposition",
      eyebrow: "Zwei Hebel mit Hebelwirkung",
      title: "Säule A: Der Ried-Hackathon · Säule B: Das Bürger-Sensornetzwerk",
      lead: "Wir verknüpfen ein innovatives 48h-Wochenend-Event mit dauerhafter, bürgerbetriebener Sensor-Infrastruktur im gesamten Altkreis.",
      layout: "value-prop-split",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Ried-Hackathon im KAMÜ",
        caption: "Bürger, Schüler, IT-Profis & Verwaltung lösen an einem Wochenende echte Herausforderungen",
      },
      stats: [
        { value: "10x", label: "Kostenvorteil", subtext: "< 100 € statt 3.000 € pro Station", color: "emerald" },
        { value: "0 €", label: "Funkgebühren", subtext: "Freies The Things Network (TTN)", color: "sky" },
        { value: "100%", label: "Open Data", subtext: "Volle Datenhoheit bei der Kommune", color: "violet" },
      ],
      bullets: [
        {
          title: "Hebel 1: Der 48h Ried-Hackathon",
          description: "Entwickler, Schüler und Verwaltung programmieren Lösungen für echte lokale Herausforderungen.",
          tag: "Event-Katalysator",
        },
        {
          title: "Hebel 2: Bürger-Sensorbau",
          description: "Schüler, Vereine und Bürger löten standardisierte Wetterstationen und montieren sie am Haus.",
          tag: "Dauerhafte Infrastruktur",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Unsere Lösung besteht aus zwei sich gegenseitig verstärkenden Elementen: Der Sensorbau bringt handfeste Messpunkte und bindet die Bürger ein. Der Hackathon nutzt genau diese Daten für smarte Anwendungen.",
        talkingPoints: [
          "Bürger sind keine passiven Konsumenten, sondern stolze Mitgestalter ihrer Heimat.",
          "Die Plattform open-ried.de ist bereits live und visualisiert Telemetrie in Echtzeit.",
        ],
        audienceEngagement: "Stellen Sie die Frage: 'Wann hat Ihre Kommune das letzte Mal Bürger direkt an Technik mitbauen lassen?'",
        localHook: "Kulturzentrum KAMÜ in Bürstadt bietet Werkstatt, Bühne und Glasfaser.",
      },
    },
    {
      id: "folie-4-product",
      stepNumber: 4,
      stepLabel: "04 / Das Produkt & Tech-Stack",
      eyebrow: "Technologische Souveränität · Kein Vendor Lock-in",
      title: "Industrielle Präzision zum Selbstkostenpreis",
      lead: "Vom wetterfesten 3D-Druck-Gehäuse über den RAK3113 LoRaWAN-Mikrocontroller bis zum TimescaleDB-Backend – transparent und langlebig.",
      layout: "product-architecture",
      imageVisual: {
        src: "/pitch/sensor-hardware-kit.jpg",
        alt: "Open Ried Sens Bausatz im 3D-Druck Stevenson Screen",
        caption: "Modularer Aufbau: RAK3113, Sensirion SCD41 (CO2) & SPS30 (Feinstaub) im Lamellengehäuse",
      },
      bullets: [
        { title: "Sensorik", description: "Sensirion SPS30 (Feinstaub), SCD41 (CO2), SHT41 (Klima), BME688 (Luft)", tag: "Hardware" },
        { title: "Funkstrecke", description: "LoRaWAN 868 MHz – bis zu 10 km Reichweite ohne SIM-Karte", tag: "Funknetz" },
        { title: "Backend & Web", description: "TimescaleDB, Next.js, FastAPI & offene OpenAPI-Schnittstellen", tag: "Open Data" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Hier sehen Sie die Hardware: Ein professionelles Lamellengehäuse schützt Schweizer Präzisionssensoren. Die Station sendet per LoRaWAN über Kilometer hinweg direkt in unser regionales Dashboard.",
        talkingPoints: [
          "Keine Batterien, die nach 6 Monaten leer sind: Betrieb über USB-C oder Solarzelle.",
          "Vollständig Open Source: Baupläne und Quellcodes sind frei auf /sensor-bauen verfügbar.",
        ],
        audienceEngagement: "Geben Sie ein Test-Gehäuse oder eine Platine durch die Reihen.",
        localHook: "3D-Druck Gehäuse können in lokalen Schulen oder im KAMÜ gedruckt werden.",
      },
    },
    {
      id: "folie-5-market",
      stepNumber: 5,
      stepLabel: "05 / Markt & Potenzial im Ried",
      eyebrow: "TAM / SAM / SOM · Flächendeckendes Netz",
      title: "100 % Abdeckung für das Hessische Ried ist greifbar",
      lead: "Mit nur 12 strategischen LoRaWAN-Gateways und 150 Bürger-Sensoren schaffen wir das dichteste Umwelt- und Klimadatennetz Hessens.",
      layout: "tam-sam-som",
      marketFunnel: {
        tam: { number: "185.000", title: "Gesamte Einwohner im Altkreis Bergstraße/Ried", desc: "Potenzial für Bürgerbeteiligung, Schulen & kommunale Daseinsvorsorge" },
        sam: { number: "55.000", title: "Kern-Einzugsgebiet Ried", desc: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim, Einhausen & Lorsch" },
        som: { number: "150 Stationen & 12 Gateways", title: "Unser 18-Monate-Fokus", desc: "Vollständige flächendeckende Netzabdeckung & 1 Station pro Schul- & Wohnquartier" },
      },
      speakerNotes: {
        elevatorPitch:
          "Um das gesamte Ried abzudecken, brauchen wir keine Millionen. Mit 12 Gateways auf Rathäusern und 150 Sensoren haben wir 100% Empfang und ein lückenloses Sensornetz.",
        talkingPoints: [
          "Ein Gateway auf dem Bürstädter Wasserturm oder Rathaus hat 10 km Reichweite.",
          "Damit versorgen wir nicht nur Bürstadt, sondern auch Bobstadt und Riedrode mit.",
        ],
        audienceEngagement: "Visualisieren Sie den Funkkreis auf einer mentalen Karte des Rieds.",
        localHook: "Standorte: Rathaus Bürstadt, Wasserturm, Feuerwehrhäuser, KAMÜ.",
      },
    },
    {
      id: "folie-6-economics",
      stepNumber: 6,
      stepLabel: "06 / Wirtschaftlichkeit & Unit Economics",
      eyebrow: "Kostenvergleich · Kommunale Haushaltsdisziplin",
      title: "< 100 € pro DIY-Station vs. 3.200 € Konzernerlöse",
      lead: "Großkonzerne verkaufen Kommunen oft teure proprietäre Säulen mit 48-Monats-Wartungsverträgen. Unser Modell spart Steuergelder und stärkt das Ehrenamt.",
      layout: "unit-economics",
      costComparison: [
        { feature: "Anschaffungskosten pro Sensor", openRiedSens: "ca. 94 € (Selbstkosten)", commercialSolution: "2.800 € – 3.500 €", advantage: "30x günstiger" },
        { feature: "Monatliche Daten- & Cloud-Kosten", openRiedSens: "0 € (freies TTN Netz)", commercialSolution: "45 € / Monat / Station", advantage: "Kein Abo" },
        { feature: "Software- & API-Lizenzen", openRiedSens: "0 € (Open Source)", commercialSolution: "5.000 € / Jahr Portal-Lizenz", advantage: "100% frei" },
        { feature: "Wartung & Reparatur", openRiedSens: "Bürger & Schüler selbst", commercialSolution: "Teurer Techniker-Service", advantage: "Autark" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Vergleichen Sie die Zahlen: Für das Budget einer einzigen kommerziellen Smart-City-Stele statten wir 30 Schulen und Bürgerhäuser mit Sensoren aus und haben 0 Euro monatliche Folgekosten.",
        talkingPoints: [
          "Kein Risiko von Preiserhöhungen durch Software-Anbieter.",
          "Ersatzteile sind Standardbauteile, jederzeit bei Mouser oder Reichelt nachbestellbar.",
        ],
        audienceEngagement: "Fragen Sie den Kämmerer oder Bürgermeister: 'Klingt eine Ersparnis von 90% für Ihren Haushalt interessant?'",
        localHook: "Kommunale Haushaltskonsolidierung im Kreis Bergstraße.",
      },
    },
    {
      id: "folie-7-competition",
      stepNumber: 7,
      stepLabel: "07 / Wettbewerb & Burggraben",
      eyebrow: "Differenzierung · Warum wir nicht kopierbar sind",
      title: "Unser Burggraben: Echte Bürgerbeteiligung & Open Source",
      lead: "Klassische IT-Dienstleister können Software liefern – aber sie haben keine Bürger, die mitlöten, keine Schulen im Boot und keinen lokalen Hackathon im KAMÜ.",
      layout: "competitive-matrix",
      competitivePoints: [
        { name: "Große Telekom- & Smart-City-Konzerne", x: 20, y: 15, description: "Teuer, Closed Source, kein Bürgerbezug" },
        { name: "Reine Hobby-Foren (Bastler)", x: 80, y: 40, description: "Gute Technik, aber keine Plattform für Verwaltungen" },
        { name: "Offizielle Umweltämter (HLNUG)", x: 50, y: 25, description: "Sehr genaue Daten, aber nur alle 30 km eine Messstelle" },
        { name: "Open Ried Sens & KAMÜ Bürstadt", x: 95, y: 92, description: "Offene Daten, bezahlbare Hardware, MINT-Schulprogramm & Hackathon", isSelf: true },
      ],
      speakerNotes: {
        elevatorPitch:
          "Unser Moat – unser Alleinstellungsmerkmal – ist das Vertrauen und die Begeisterung der Bürger vor Ort. Ein Konzern kann keinen Löt-Workshop an der Bürstädter Schule veranstalten. Wir schon.",
        talkingPoints: [
          "Wir kombinieren technische Exzellenz mit tiefem lokalem Ehrenamt.",
          "Das Kulturzentrum KAMÜ gibt uns ein physisches Zuhause im Ried.",
        ],
        audienceEngagement: "Betonen Sie die Symbiose aus Bürgernähe und professioneller Software-Architektur.",
        localHook: "Verankerung in der lokalen Zivilgesellschaft in Bürstadt und Lampertheim.",
      },
    },
    {
      id: "folie-8-traction",
      stepNumber: 8,
      stepLabel: "08 / Traktion & Meilensteine",
      eyebrow: "Beweis für Machbarkeit · Was bereits steht",
      title: "Wir starten nicht bei Null: Die Plattform läuft bereits live",
      lead: "Von der Live-Telemetrie über REST-APIs bis zur 3D-Bauanleitung – der Prototyp ist erprobt und einsatzbereit.",
      layout: "traction-timeline",
      bullets: [
        { title: "Meilenstein 1: Plattform open-ried.de live", description: "Next.js Web-Portal mit interaktiver Karte, Sensor-Verwaltung und Live-Telemetrie.", tag: "Erreicht" },
        { title: "Meilenstein 2: Hardware-Design & Anleitung", description: "Bauanleitung, Schaltpläne, STL-Dateien und BOM auf /sensor-bauen veröffentlicht.", tag: "Erreicht" },
        { title: "Meilenstein 3: Partnerschaft KAMÜ", description: "Kulturzentrum KAMÜ in Bürstadt als Veranstaltungsort für Workshops & Hackathon gesichert.", tag: "Erreicht" },
        { title: "Nächster Schritt: Kommunaler Rollout", description: "Erste Gateways auf Rathäusern und 25 Sensoren an Schulen & Bürgerhäusern.", tag: "Jetzt anstehend" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Wir kommen nicht mit einer vagen Idee zu Ihnen, sondern mit funktionierender Realität: Die Website open-ried.de läuft, die Sensoren messen, die Bauanleitungen sind online.",
        talkingPoints: [
          "Sehen Sie sich die Live-Daten auf open-ried.de an.",
          "Jetzt geht es um die Skalierung in die Breite der Region.",
        ],
        audienceEngagement: "Öffnen Sie kurz das Live-Dashboard auf dem Beamer, um die Werte zu zeigen.",
        localHook: "Erste Stationen laufen bereits im Testbetrieb in Bürstadt.",
      },
    },
    {
      id: "folie-9-team",
      stepNumber: 9,
      stepLabel: "09 / Das Team & Maker-Netzwerk",
      eyebrow: "Köpfe hinter dem Projekt · Digital Natives vor Ort",
      title: "Digital Natives, Ingenieure & das Bürgerlabor KAMÜ",
      lead: "Ein eingespieltes Team aus Software-Architekten, Elektronik-Entwicklern, Pädagogen und engagierten Bürgern treibt Open Ried Sens voran.",
      layout: "team-showcase",
      bullets: [
        { title: "Tech & Architecture Core", description: "Full-Stack Software-Entwickler, Embedded Firmware Spezialisten (C++/PlatformIO) und Datenbank-Ingenieure.", tag: "Technologie" },
        { title: "MINT & Bildung", description: "Pädagogen, Physiklehrer und Maker mit Erfahrung in Schüler-Workshops und Jugend forscht.", tag: "Didaktik" },
        { title: "Kulturzentrum KAMÜ Bürstadt", description: "Trägerverein, Raum, Werkstattinfrastruktur und Vernetzung mit regionalen Vereinen.", tag: "Standort" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Wir sind keine externe Agentur, die nach dem Projekt wieder abzieht. Wir leben hier im Ried, unsere Kinder gehen hier zur Schule, und wir wollen unsere Region fit für die Zukunft machen.",
        talkingPoints: [
          "Hohe Fachkompetenz in IoT, Funktechnik und Web-Entwicklung.",
          "Verlässliche Ehrenamtsstrukturen im Kulturzentrum KAMÜ.",
        ],
        audienceEngagement: "Stellen Sie die anwesenden Teammitglieder kurz namentlich vor.",
        localHook: "Bürstadt Kulturzentrum KAMÜ als Heimatbasis.",
      },
    },
    {
      id: "folie-10-ask",
      stepNumber: 10,
      stepLabel: "10 / The Ask & Politisches Commitment",
      eyebrow: "Was wir von der Politik brauchen · Konkrete Beschlüsse",
      title: "Unser 'Ask' an Bürgermeister, Landräte & Fraktionen",
      lead: "Wir bitten nicht um Millionen – wir bitten um politisches Rückgrat, Infrastrukturzugang und eine Partnerschaft auf Augenhöhe.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "ask-daten",
          title: "1. Zugriff auf Rohdaten & Live-Schnittstellen",
          description: "Zusammenarbeit für offene Daten: Freigabe von Parkplatz-Sensordaten (z.B. smartcity-system.de/buerstadt), ZAKB-Entsorgungstouren, Bahnübergangs-Status und Bus/Bahn-Echtzeitdaten für unser Dashboard.",
          commitmentType: "daten",
          tag: "Open Data",
          actionText: "Verwaltungs-Vereinbarung prüfen",
        },
        {
          id: "ask-infrastruktur",
          title: "2. LoRaWAN-Infrastruktur öffnen & Antennenplätze",
          description: "Zugang zu 2–3 kommunalen Dachstandorten (Rathaus, Feuerwehrhaus, Wasserturm) und Öffnung bestehender kommunaler Gateways für The Things Network (TTN).",
          commitmentType: "infrastruktur",
          tag: "Funk-Infrastruktur",
          actionText: "Standort-Freigabe beschließen",
        },
        {
          id: "ask-foerderung",
          title: "3. Anschub-Budget für Open-Source Ausbau",
          description: "Überschaubare Projektförderung (z.B. 3.000 € – 5.000 €) für 25–50 Sensorbausätze an Schulen und Vereinen im Ried.",
          commitmentType: "finanzen",
          tag: "MINT-Förderung",
          actionText: "Fördermittel bereitstellen",
        },
        {
          id: "ask-praesenz",
          title: "4. Schirmherrschaft & Siegerpreis beim Ried-Hackathon",
          description: "Präsenz beim Hackathon im KAMÜ: Schirmherrschaft, Eröffnungs-Keynote durch Bürgermeister/Landrat und Stiftung eines Preises für das Gewinnerteam.",
          commitmentType: "praesenz",
          tag: "Schirmherrschaft",
          actionText: "Termin vormerken",
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
          "Hier ist unsere konkrete Bitte: Geben Sie uns das politische Rückgrat! Öffnen Sie die Rohdaten – wie die Parkdaten von smartcity-system.de –, erlauben Sie eine LoRaWAN-Antenne auf dem Rathaus und übernehmen Sie die Schirmherrschaft für den Hackathon.",
        talkingPoints: [
          "smartcity-system.de/buerstadt hat bereits Parksensoren – wir können diese Werte aggregieren und im Kontext von Verkehr und Wetter zeigen.",
          "Eine TTN-Antenne auf dem Rathausdach kostet 300 € und versorgt die halbe Stadt.",
          "Ihre Schirmherrschaft sendet ein starkes Signal an die Jugend.",
        ],
        audienceEngagement: "Fragen Sie die Bürgermeisterin / den Bürgermeister direkt: 'Können wir den Termin für die Schirmherrschaft gemeinsam festhalten?'",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als Austragungsort.",
      },
    },
  ],
};

// ============================================================================
// 2. SCHULEN PITCH DECK (Fokus Sensorbau -> Multiplikator für Hackathon)
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
    "Schul-Pitch: Fokus auf den Bau von Umweltsensoren. Handwerk (Löten, Zangen) trifft Physik und Full-Stack IT. Schüler werden Botschafter in ihren Familien und Teilnehmer am Ried-Hackathon.",
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
        { value: "< 100 €", label: "Materialkosten", subtext: "Fördervereins-kompatibel", color: "violet" },
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
      eyebrow: "Nächste Schritte · Konkrete Umsetzung",
      title: "Unser 'Ask' an Schulleitung, Fachkonferenzen & Fördervereine",
      lead: "Wir bringen Dozenten, Werkzeuge und Bausätze – Sie stellen Raum und motivierte Schüler.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "schul-ankündigung",
          title: "1. Schulisches Announcement & Projekttag",
          description: "Ankündigung an der Schule durch Schulleitung oder Physiklehrer: Durchführung eines Projekttags 'Wir bauen unsere Schul-Wetterstation'.",
          commitmentType: "schulen",
          tag: "Unterricht",
          actionText: "Projekttag festlegen",
        },
        {
          id: "schul-foerderverein",
          title: "2. Finanzierung über Förderverein / Sponsoren",
          description: "Übernahme von 10–20 Bausätzen (ca. 1.000 € – 2.000 €) über den Förderverein oder regionale Firmen-Paten.",
          commitmentType: "finanzen",
          tag: "Finanzierung",
          actionText: "Förderantrag stellen",
        },
        {
          id: "schul-schuldach",
          title: "3. Messpunkt auf dem Schuldach",
          description: "Montage einer offiziellen Schul-Wetterstation auf dem Schuldach als permanenter Messpunkt für den Unterricht.",
          commitmentType: "infrastruktur",
          tag: "Messpunkt",
          actionText: "Standort freigeben",
        },
        {
          id: "schul-hackathon-team",
          title: "4. Schüler-Delegation zum Ried-Hackathon",
          description: "Entsendung von 1–2 Schüler-Teams zum 48h Ried-Hackathon im KAMÜ Bürstadt mit Betreuungslehrer.",
          commitmentType: "praesenz",
          tag: "Hackathon",
          actionText: "Teams anmelden",
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
          "Lassen Sie uns noch in diesem Schulhalbjahr einen Pilot-Workshop an Ihrer Schule machen. Wir begleiten Sie bei jedem Schritt und bringen das Material mit.",
        talkingPoints: [
          "Wir unterstützen bei der Beantragung von Fördermitteln.",
          "Die Schule erhält ein offizielles Zertifikat als 'MINT-Klimaforschungsschule im Ried'.",
        ],
        audienceEngagement: "Geben Sie Handouts und Terminvorschläge an die Lehrkräfte aus.",
        localHook: "Ansprechpartner direkt vor Ort in Bürstadt.",
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
  ],
};

// ============================================================================
// 4. TECH COMMUNITY & MAKER PITCH DECK
// ============================================================================
export const COMMUNITY_DECK: PitchDeck = {
  slug: "community",
  title: "Open Hardware & Mesh: Wir bauen die freie Ried-Infrastruktur",
  subtitle:
    "Für Nerds, Maker, Freifunker, Funkamateure (DARC) & Vereine: The Things Network, Firmware-Hacking & 48h Hackathon im KAMÜ",
  targetAudience: "Hacker, Maker, Freifunk, Chaos Computer Club, DARC Funkamateure, Vereine & Initiativen",
  category: "community",
  badge: "Tech Community & Maker",
  accentColor: "teal",
  estimatedMinutes: 10,
  summary:
    "Community-Pitch: Echte Open Hardware, RAK3113 LoRaWAN Node, dezentrale Gateways, offene APIs und der 48h Ried-Hackathon im Kulturzentrum KAMÜ.",
  slides: [
    {
      id: "comm-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & Mission",
      eyebrow: "Root für alle · Open Hardware & Free Network",
      title: "Freie Frequenzen, freie Daten: Holen wir uns die Infrastruktur zurück!",
      lead: "Genug von proprietären IoT-Silos und teuren Cloud-Abos. Wir bauen das offene LoRaWAN-Rückgrat für das gesamte Hessische Ried.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Hacker und Entwickler beim Hackathon",
        caption: "KAMÜ Bürstadt: Lötkolben, Laptops, LoRa-Funk und Club-Mate",
      },
      bullets: [
        { title: "Open Source", description: "RAK3113, Sensirion I²C, PlatformIO Firmware & TimescaleDB", tag: "100% Offen" },
        { title: "The Things Network", description: "Dezentrales 868 MHz LoRaWAN ohne Provider-Vertrag", tag: "Freifunk IoT" },
        { title: "KAMÜ Hackspace", description: "Regelmäßige Lötabende und Maker-Treffen in Bürstadt", tag: "HQ" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Moin Nerds und Maker! Die Welt redet über Smart Cities, aber das Ried ist auf allen Karten ein blinder Fleck. Lasst uns nicht meckern, sondern löten, flashen und Gateways aufs Dach setzen!",
        talkingPoints: [
          "Hier gibt es keine Vendor Lock-ins: Schaltpläne, KiCad-Files und STL-Dateien sind offen.",
          "Jeder kann mitbauen: Von Antennenoptimierung bis Firmware-Entwicklung.",
        ],
        audienceEngagement: "Wer von euch hat schonmal ein TTN Gateway betrieben oder mit ESP32/LoRa gearbeitet?",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als offener Treffpunkt.",
      },
    },
    {
      id: "comm-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Die Heatmaps lügen nicht",
      eyebrow: "Beweislage · Daten-Blindflecken",
      title: "Unser Feindbild: Weiße Flecken auf TTN Mapper & Sensor.Community",
      lead: "Zwischen Mannheim und Darmstadt klafft Niemandsland. Das ist kein Schicksal, das ist eine persönliche Herausforderung für unsere Community!",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Auf TTN Mapper sieht man genau drei blaue Striche, wo mal einer mit dem LoRa-Node im Auto über die B47 gefahren ist. Im Ortskern Bürstadt? Null Empfang. Das ändern wir!",
        talkingPoints: [
          "Ziel: Mindestens 10 aktive Gateways und 50 Sensor-Nodes bis Ende des Jahres im Ried!",
        ],
        audienceEngagement: "Wer hat ein hohes Dach oder eine Scheune mit Sichtkontakt für ein Outdoor-Gateway?",
        localHook: "Wasserturm Bürstadt, Kirchtürme, KAMÜ-Dach, Bobstadt.",
      },
    },
    {
      id: "comm-3-hackathon",
      stepNumber: 3,
      stepLabel: "03 / Das Event",
      eyebrow: "48 Stunden Vollgas · Kulturzentrum KAMÜ",
      title: "Der Ried-Hackathon: Code, Solder & Open Data",
      lead: "Ein ganzes Wochenende im Kulturzentrum KAMÜ: Hardware-Hacker, Software-Devs und Vereine bauen an echten Lösungen.",
      layout: "value-prop-split",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Hackathon im KAMÜ",
        caption: "48h Coding, LoRa-Reichweitentests und Pizza im Kulturzentrum KAMÜ",
      },
      bullets: [
        { title: "Track 1: LoRaWAN & Mesh", description: "Gateways aufbauen, TTN Mapper Coverage, Meshtastic-Relays", tag: "Funktechnik" },
        { title: "Track 2: Data Science & AI", description: "Hitze-Heatmaps, Grundwasser-Vorhersagemodelle, Telegram-Alert-Bots", tag: "Software" },
        { title: "Track 3: Hardware Hacks", description: "Pegelsonden für die Weschnitz, Bodenfeuchte für Landwirte, 3D-Druck", tag: "Hardware" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Der Hackathon wird das Event für die regionale Tech-Szene. 48 Stunden schnelles Netz, Pizza, Mate und Hardware satt.",
        talkingPoints: [
          "Kooperation mit Freifunk, Linux-User-Groups und Hochschulen.",
          "Keine Marketing-Show: Am Sonntag müssen funktionierende Prototypen auf dem Tisch stehen.",
        ],
        audienceEngagement: "Welche Tracks sprechen euch am meisten an?",
        localHook: "KAMÜ Bürstadt bietet beste Räumlichkeiten.",
      },
    },
    {
      id: "comm-4-ask",
      stepNumber: 4,
      stepLabel: "04 / The Ask an die Maker",
      eyebrow: "Mitmachen · Jetzt ins Team einsteigen",
      title: "Unser 'Ask' an Hacker, Maker & Funkamateure",
      lead: "Ob du löten kannst, Python schreibst, Antennen misst oder Gehäuse druckst – wir brauchen deinen Skill!",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "maker-gateway",
          title: "1. Werde Gateway-Host",
          description: "Stelle ein Outdoor-LoRaWAN-Gateway auf dein Dach. Wir stellen vorkonfigurierte Hardware bereit.",
          commitmentType: "infrastruktur",
          tag: "Gateway Host",
          actionText: "Dachstandort anbieten",
        },
        {
          id: "maker-mentor",
          title: "2. Mentor beim Ried-Hackathon werden",
          description: "Unterstütze Schüler- und Einsteiger-Teams beim Löten, Coden und Flashen während des Hackathons.",
          commitmentType: "praesenz",
          tag: "Mentoring",
          actionText: "Als Mentor eintragen",
        },
        {
          id: "maker-code",
          title: "3. Open Source Firmware & Dashboard beisteuern",
          description: "Contribute zu unseren Repositories: Neue Sensortreiber (I²C), Decoder oder Karten-Layer.",
          commitmentType: "daten",
          tag: "GitHub / GitLab",
          actionText: "Repo forken & beitragen",
        },
      ],
      callToAction: {
        primaryText: "Zur Bauanleitung & BOM",
        primaryHref: "/sensor-bauen",
        secondaryText: "Dem Entwickler-Team beitreten",
        secondaryHref: "mailto:hackathon@open-ried.de?subject=Maker%20Community%20Open%20Ried%20Sens",
      },
      speakerNotes: {
        elevatorPitch:
          "Die Hardware liegt bereit, der Code ist online. Schaut auf /sensor-bauen vorbei und lasst uns das Netz aufbauen.",
        talkingPoints: ["Kommt beim nächsten Treffen im KAMÜ vorbei, bringt eure Projekte mit."],
        audienceEngagement: "Teilt den Link in euren Signal- und Discord-Gruppen!",
        localHook: "Treffpunkt Kulturzentrum KAMÜ in Bürstadt.",
      },
    },
  ],
};

// ============================================================================
// 5. REGIONALE WIRTSCHAFT & STADTWERKE PITCH DECK
// ============================================================================
export const WIRTSCHAFT_DECK: PitchDeck = {
  slug: "wirtschaft",
  title: "Green Tech & Fachkräfte: Sponsoring mit regionaler Wirkung",
  subtitle:
    "Wie Stadtwerke, Mittelstand & IT-Unternehmen den MINT-Nachwuchs fördern und Klimaresilienz schaffen",
  targetAudience: "Geschäftsführer von Stadtwerken, regionalen IT-Betrieben, Banken & Mittelständlern",
  category: "wirtschaft",
  badge: "Wirtschaft & Stadtwerke",
  accentColor: "amber",
  estimatedMinutes: 10,
  summary:
    "Sponsoren-Pitch: Fachkräftesicherung durch MINT-Schulpateschaften (1.000 € für 10 Sensoren), Co-Innovation beim Hackathon und eigenes Monitoring von Energie & Hallenklima.",
  slides: [
    {
      id: "wirt-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & ROI",
      eyebrow: "Regionale Wertschöpfung · CSR & Fachkräfte",
      title: "Investieren in die Fachkräfte von morgen und ein klimaresilientes Ried",
      lead: "Statt austauschbarer Bandenwerbung investieren Sie in handfeste MINT-Bildung, Open-Source-Infrastruktur und Innovationskultur vor Ihrer Haustür.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/hackathon-kamue-community.jpg",
        alt: "Junge Talente beim Hackathon",
        caption: "Fachkräfte finden: Motivierte Schüler und Studenten beim Hackathon im KAMÜ",
      },
      bullets: [
        { title: "Recruiting", description: "Lernen Sie beim Hackathon motivierte Entwickler und Schüler persönlich kennen", tag: "Talente" },
        { title: "Echte CSR", description: "Finanzieren Sie Sensorbausätze für Schulen inkl. Schulpateschaft", tag: "Nachhaltigkeit" },
        { title: "Infrastruktur", description: "Nutzen Sie das freie LoRaWAN-Netz für eigene Zähler oder Hallenklima", tag: "Smarte Betriebe" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Unternehmerinnen und Unternehmer: Der Fachkräftemangel betrifft uns alle. Mit diesem Projekt zeigen wir jungen Menschen, dass innovative Zukunftstechnologie direkt hier im Ried stattfindet.",
        talkingPoints: [
          "Schüler und Azubis suchen heute Sinnhaftigkeit und moderne Technologien.",
          "Möglichkeit, eigene Aufgabenstellungen ('Challenges') in den Hackathon einzubringen.",
        ],
        audienceEngagement: "Frage: Wie viel Budget geben Sie jährlich für Stellenanzeigen aus, auf die sich niemand meldet?",
        localHook: "Standort Bergstraße / Metropolregion Rhein-Neckar.",
      },
    },
    {
      id: "wirt-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Die Datenlücke",
      eyebrow: "Standortrisiko · Klimafolgen im Gewerbegebiet",
      title: "Ohne lokale Daten keine fundierten Klimaschutzentscheidungen",
      lead: "Gewerbegebiete im Ried sind extreme Hitzeinseln. Dennoch gibt es bisher kein freies Sensornetz zur objektiven Messung von Hitze und Trockenheit.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Gewerbegebiete heizen sich im Sommer massiv auf. Mit unserem Sensornetz erfassen Unternehmen und Stadtwerke diese Werte objektiv.",
        talkingPoints: [
          "Stadtwerke können das Netz zur Zählerablesung (Smart Metering) nutzen.",
        ],
        audienceEngagement: "Erwähnen Sie Gewerbegebiete in Bürstadt und Lampertheim.",
        localHook: "Gewerbegebiet Bürstadt-Ost und Bobstadt.",
      },
    },
    {
      id: "wirt-3-ask",
      stepNumber: 3,
      stepLabel: "03 / The Ask an Sponsoren",
      eyebrow: "Sponsoring-Pakete · Transparente Wirkung",
      title: "Unser 'Ask' an Unternehmen & Stadtwerke",
      lead: "Transparent kalkuliert – jeder Euro fließt direkt in Bausätze für Jugendliche und den Hackathon.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "sponsor-schulpate",
          title: "1. Sensor-Schulpate (1.000 €)",
          description: "Finanziert 10 komplette Multisensor-Bausätze für eine Schulklasse inkl. Firmenlogo als offizieller Schulsponsor.",
          commitmentType: "schulen",
          tag: "Schulpate",
          actionText: "Schulpateschaft übernehmen",
        },
        {
          id: "sponsor-track",
          title: "2. Hackathon Track-Sponsor (2.500 €)",
          description: "Namensgeber für eine Hackathon-Challenge (z.B. 'Green Energy Challenge') inkl. Jurysitz und Recruiting-Stand.",
          commitmentType: "finanzen",
          tag: "Track Sponsor",
          actionText: "Track sponsern",
        },
        {
          id: "sponsor-gateway",
          title: "3. Gateway auf dem Firmendach",
          description: "Bereitstellung eines LoRaWAN-Antennenstandorts auf Ihrem Betriebsgebäude zur Erweiterung des Netzes.",
          commitmentType: "infrastruktur",
          tag: "Dachstandort",
          actionText: "Firmendach bereitstellen",
        },
      ],
      callToAction: {
        primaryText: "Sponsoring vereinbaren",
        primaryHref: "mailto:partner@open-ried.de?subject=Sponsoring%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM ansehen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Mit 1.000 Euro ermöglichen Sie 10 Jugendlichen einen kompletten Praxis-Workshop und erhalten dafür dauerhafte, sichtbare Präsenz.",
        talkingPoints: [
          "Spenden- oder Sponsoringrechnung kann steuerlich geltend gemacht werden.",
        ],
        audienceEngagement: "Bieten Sie ein persönliches Kennenlernen an.",
        localHook: "Präsentation im Kulturzentrum KAMÜ.",
      },
    },
  ],
};

// ============================================================================
// 6. LANDWIRTSCHAFT & WASSER PITCH DECK
// ============================================================================
export const LANDWIRTSCHAFT_DECK: PitchDeck = {
  slug: "landwirtschaft",
  title: "Dürre, Grundwasser & Mikroklima: Sensordaten für die Ried-Landwirtschaft",
  subtitle:
    "Präzisionslandwirtschaft mit LoRaWAN: Bodenfeuchte in mehreren Tiefen, Blattnässe & Frostwarnung auf dem Acker",
  targetAudience: "Landwirte, Gemüsebauer, Wasser- und Beregnungsverbände, Winzer im Ried",
  category: "umwelt",
  badge: "Landwirtschaft & Wasser",
  accentColor: "emerald",
  estimatedMinutes: 10,
  summary:
    "Agrar-Pitch: Autarke Bodenfeuchte- und Mikroklimasensoren für Landwirte. 10 km LoRaWAN-Reichweite ohne SIM-Karte, optimierte Beregnung und gemeinsame Challenges beim Hackathon.",
  slides: [
    {
      id: "land-1-title",
      stepNumber: 1,
      stepLabel: "01 / Hook & Nutzen",
      eyebrow: "Wasser ist Zukunft · Präzision auf dem Acker",
      title: "Intelligentes Wassermanagement im Gemüsegarten Hessens",
      lead: "Das Hessische Ried steht vor enormen Wasser- und Bodenspannungen. Mit autarken LoRaWAN-Boden- und Mikroklimasensoren messen Landwirte exakt, wann Beregnung nötig ist.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/sensor-hardware-kit.jpg",
        alt: "Sensorstation auf landwirtschaftlicher Fläche",
        caption: "Wetterfeste Außenstation: 10 km Reichweite ohne Mobilfunkgebühren",
      },
      bullets: [
        { title: "Bodenfeuchte", description: "Messung in 20, 40 und 60 cm Tiefe – genau dort, wo Wurzeln saugen", tag: "Wasser sparen" },
        { title: "10 km LoRaWAN", description: "Ein Empfänger auf dem Hof deckt alle Außenlieger-Felder ab", tag: "0 € Funkkosten" },
        { title: "Frost- & Blattnässe", description: "Echtzeitwarnung aufs Smartphone für Spargel-, Erdbeer- und Obstanbau", tag: "Ernteschutz" },
      ],
      speakerNotes: {
        elevatorPitch:
          "Liebe Landwirtinnen und Landwirte: Das Hessische Ried hat die sandigsten Böden und die schärfsten Grundwasservorschriften. Unser Sensorsystem gibt Ihnen die Faktenbasis, um Beregnung exakt und rechtssicher zu steuern.",
        talkingPoints: [
          "LoRaWAN sendet kilometerweit über Felder ohne monatliche SIM-Kartenkosten.",
        ],
        audienceEngagement: "Frage: Wie oft beregnen Sie auf Verdacht, weil die Bodenfeuchte in 40 cm Tiefe unbekannt ist?",
        localHook: "Beregnungsverband Hessisches Ried, Spargelanbau Bürstadt & Lampertheim.",
      },
    },
    {
      id: "land-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Die Datenwüste auf dem Acker",
      eyebrow: "Funklöcher · Agrarflächen abgeschnitten",
      title: "Die Ackerflächen im Ried sind von Sensordaten völlig abgeschnitten",
      lead: "Die TTN Mapper Karte zeigt es schonungslos: Auf den Feldern zwischen Bürstadt, Biblis und Lorsch gibt es kein LoRaWAN-Signal.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Ein einziges Gateway auf einer Hofscheune reicht aus, um 50 Sensoren auf allen Feldern im Umkreis zu empfangen.",
        talkingPoints: [
          "Landwirte behalten die volle Datenhoheit: Werte können privat bleiben oder freiwillig geteilt werden.",
        ],
        audienceEngagement: "Wer hat ein Scheunendach oder Silo mit Strom und Internetanschluss?",
        localHook: "Hofstellen in Bürstadt, Bobstadt, Riedrode und Hofheim.",
      },
    },
    {
      id: "land-3-ask",
      stepNumber: 3,
      stepLabel: "03 / The Ask an die Landwirtschaft",
      eyebrow: "Pilotprojekt · Vom Hof zum Sensor",
      title: "Unser 'Ask' an Landwirte & Beregnungsverbände",
      lead: "Gemeinsam mit Ihnen möchten wir Testfelder aufbauen und die Daten beim Hackathon mit Agrar-Experten veredeln.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "agrar-testbetrieb",
          title: "1. Kostenlose Teststation auf Ihrem Hof",
          description: "Wir installieren fachgerecht eine Bodenfeuchte- und Wetterstation auf Ihrem Versuchsfeld.",
          commitmentType: "infrastruktur",
          tag: "Pilotbetrieb",
          actionText: "Als Pilotbetrieb bewerben",
        },
        {
          id: "agrar-gateway",
          title: "2. Gateway-Standort auf Scheune oder Silo",
          description: "Bereitstellung einer Außenantenne auf einem hohen Wirtschaftsgebäude für flächendeckenden Acker-Empfang.",
          commitmentType: "infrastruktur",
          tag: "Scheunendach",
          actionText: "Standort bereitstellen",
        },
        {
          id: "agrar-hackathon",
          title: "3. Challenge-Partner beim Ried-Hackathon",
          description: "Bringen Sie Ihre konkrete Fragestellung (z.B. Frostschutz-Alarmierung) als Wettbewerbsaufgabe in den Hackathon ein.",
          commitmentType: "praesenz",
          tag: "Smart Farming",
          actionText: "Aufgabe formulieren",
        },
      ],
      callToAction: {
        primaryText: "Als Testbetrieb bewerben",
        primaryHref: "mailto:agrar@open-ried.de?subject=Testbetrieb%20Landwirtschaft%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM ansehen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Wir suchen zwei engagierte landwirtschaftliche Betriebe im Ried für unser kostenloses Pilotprogramm.",
        talkingPoints: ["Keinerlei Verpflichtungen, volle Datenkontrolle."],
        audienceEngagement: "Sprechen Sie gezielt die anwesenden Landwirte an.",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als Treffpunkt.",
      },
    },
  ],
};

export const PITCH_DECKS: PitchDeck[] = [
  POLITIK_DECK,
  SCHULEN_DECK,
  VHS_DECK,
  COMMUNITY_DECK,
  WIRTSCHAFT_DECK,
  LANDWIRTSCHAFT_DECK,
];

export function getPitchDeckBySlug(slug: string): PitchDeck | undefined {
  return PITCH_DECKS.find((deck) => deck.slug === slug);
}
