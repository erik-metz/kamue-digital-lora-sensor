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

export interface DualPillarItem {
  tag: string;
  headline: string;
  description: string;
  imageSrc: string;
  badges: string[];
}

export interface CuriousHackathonExample {
  title: string;
  description: string;
  url: string;
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
  | "dual-pillars"
  | "open-innovation"
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
  stepNumber: number; // 1 to 9 / 10
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
  dualPillars?: DualPillarItem[];
  curiousHackathonExamples?: CuriousHackathonExample[];
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
    serviceName: "Raspberryshaker (Seismograph für Erschütterungen & Geothermie)",
    serviceUrl: "https://raspberryshake.org/",
    imagePath: "/pitch/raspberry-shake-ried-map.png",
    headline: "Raspberryshaker: Bodenerschütterung & Seismik",
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
  title: "Gemeinsam Neues fürs Ried erarbeiten: Smarte Daten & Bürger-Hackathon",
  subtitle:
    "Aus gesammelten und zusammengetragenen Live-Daten reale Lösungen für die Region entwickeln – im Kulturzentrum KAMÜ Bürstadt",
  targetAudience: "Bürgermeister, Landräte, Beigeordnete, Stadträte, Bauamtsleiter & Fraktionen",
  category: "politik",
  badge: "Kommunale Daseinsvorsorge",
  accentColor: "emerald",
  estimatedMinutes: 10,
  summary:
    "Präziser 9-teiliger Pitch für politische Entscheidungsträger: Klarer Nutzen (Lösungen beim Hackathon erarbeiten), Aufbrechen von Daten-Silos, 2 visuelle Säulen (Sensorbau & Hackathon), Bürgerinitiative & Know-how als Produkt, Synergien mit dem Smart-City-Projekt Bürstadt & Lampertheim, Roadmap mit Fokus Bürstadt/Lampertheim zuerst, Core-Team aus dem Ried und fokussierter Ask an die Politik.",
  slides: [
    {
      id: "folie-1-title",
      stepNumber: 1,
      stepLabel: "01 / Nutzen & Ziel",
      eyebrow: "Smarte Region Bergstraße · Ried-Hackathon",
      title: "Gemeinsam Neues für die Region erarbeiten: Vom Rohdaten-Schatz zu echten Lösungen",
      lead: "Ziel unserer Initiative: Aus zusammengetragenen und selbst gemessenen Live-Daten während des 48h-Hackathons Neues für das Ried herausfinden und praxistaugliche Lösungen erarbeiten. Dafür bündeln wir Live-Daten, Bürger-Sensoren und bestehende Infrastruktur im Kulturzentrum KAMÜ – bei 0 € Belastung für den städtischen Haushalt.",
      layout: "one-pager-hero",
      imageVisual: {
        src: "/pitch/kamue-cooperation.jpg",
        alt: "Bürger, Verwaltung und Entwickler im Kulturzentrum KAMÜ",
        caption: "Gemeinsam an einem Tisch: Bürger, Verwaltung & IT-Experten im Kulturzentrum KAMÜ Bürstadt",
      },
      bullets: [
        {
          title: "Ziel: Echte Lösungen beim Hackathon",
          description: "Aus zusammengetragenen Daten Neues für die Region erforschen – von Schulwegsicherheit und Verkehrsfluss bis Hitze-Frühwarnung.",
          tag: "Kern-Nutzen",
        },
        {
          title: "Was wir dafür brauchen",
          description: "Regionale Live-Daten, politisches Commitment, bürgergebaute Sensoren und Zugang zur bestehenden LoRa-Funkinfrastruktur.",
          tag: "Die Hebel",
        },
        {
          title: "0 € Kommunalkosten",
          description: "Vollständig haushaltsneutral: Finanziert durch Bürgerinitiative, Fördermittel & Spenden; minimale Serverkosten (~50 €/Jahr).",
          tag: "Haushaltsneutral",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Sehr geehrte Damen und Herren: Es geht uns nicht nur darum, dass dieses Projekt für die Stadt kostenlos ist – der entscheidende Nutzen ist: Wir bringen Bürger, Schüler und Fachleute zusammen, um aus echten Daten konkrete Lösungen für unsere Kommunen zu erarbeiten. Beim 48h-Hackathon im KAMÜ entstehen funktionierende Prototypen, die Probleme vor Ort lösen.",
        talkingPoints: [
          "Verbindung aus praktischer Bürgerbeteiligung, MINT-Bildung an Schulen und echter kommunaler Problemlösung.",
          "Kommunen stehen vor der Pflicht zur Klimafolgenanpassung (§ 12 Hessisches Klimagesetz) – wir liefern Daten und smarte Tools.",
          "Kulturzentrum KAMÜ in Bürstadt als offene Werkstatt und Innovationsort.",
        ],
        audienceEngagement:
          "Frage an die Runde: Welche drängenden regionalen Fragen möchten Sie beim Hackathon von schlauen Köpfen lösen lassen?",
        localHook: "Kulturzentrum KAMÜ in Bürstadt (Industriestraße 11) als regionale Innovations-Heimat.",
      },
    },
    {
      id: "folie-2-problem",
      stepNumber: 2,
      stepLabel: "02 / Das Problem & Daten-Silos",
      eyebrow: "Beweislage · Daten-Silos vs. Datenblindfleck",
      title: "Unmengen an Daten existieren – aber isoliert in Silos und ohne zentrale Heimat",
      lead: "Von Parkleitsystemen über Bahnübergänge bis zu Mülltouren: Es gibt unzählige Daten im Ried. Doch sie liegen ungenutzt in Silos. Gleichzeitig beweisen globale Plattformen: Auf Sensor.Community, TTN Mapper und Raspberryshaker ist das Ried fast völlig weiß.",
      layout: "blindspot-evidence",
      mapEvidence: MAP_EVIDENCE_ITEMS,
      speakerNotes: {
        elevatorPitch:
          "Das Paradoxon im Ried: Einerseits gibt es Daten in einzelnen Portalen, andererseits sind wir auf weltweiten Citizen-Science-Karten wie Sensor.Community oder dem Raspberryshaker völlig unsichtbar. Niemand von außen wird diese Silos für uns aufbrechen – das können nur wir gemeinsam vor Ort tun.",
        talkingPoints: [
          "Vorhandene Datenströme (Parken, Bahn, Müll) sind nicht miteinander verknüpft.",
          "Auf freien Plattformen hat das Ried gravierende Datenblindflecken.",
          "Engagierte Digital Natives und Bürger wollen ehrenamtlich anpacken, um diese Lücke zu schließen.",
        ],
        audienceEngagement:
          "Lassen Sie die drei Karten wirken: 'Sehen Sie, wie der Riedkern zwischen Mannheim und Darmstadt weiß bleibt?'",
        localHook: "Besonders Bürstadt und Lampertheim brauchen eine zentrale Bündelung.",
      },
    },
    {
      id: "folie-3-solution",
      stepNumber: 3,
      stepLabel: "03 / Die zwei Säulen der Initiative",
      eyebrow: "Fundament & Hebelwirkung",
      title: "Säule 1: Dichte Messungen · Säule 2: Der 48h Ried-Hackathon",
      lead: "Ein komplementäres Zusammenspiel: Eigene Bürger-Stationen liefern kleinräumige Umweltdaten – und der Hackathon im KAMÜ macht daraus reale Anwendungen für die Region.",
      layout: "dual-pillars",
      dualPillars: [
        {
          tag: "Säule 1: Der Bürger-Sensorbau",
          headline: "Feingranulare Umwelt- & Klimadaten",
          description:
            "Standardisierte Wetter- und Umweltstationen messen kleinräumig CO2 (Sensirion SCD41), Feinstaub (SPS30 PM2.5/PM10), Stickoxide (NOx), Ozon, Lärm und Hitzeinseln. Gebaut von Schülern, Bürgern und Vereinen zum Selbstkostenpreis.",
          imageSrc: "/pitch/sensor-hardware-kit.jpg",
          badges: ["RAK3113 LoRaWAN", "Schweizer Sensirion", "Echtes MINT-Handwerk", "0 € Funkkosten"],
        },
        {
          tag: "Säule 2: Der 48h Ried-Hackathon",
          headline: "Gemeinsam Neues für die Region erarbeiten",
          description:
            "Was machen wir mit den Daten? Schüler, Entwickler, Bürger und Fachämter tüfteln ein Wochenende lang im Kulturzentrum KAMÜ an konkreten Lösungen – von Schulwegsicherheit und Schrankenampeln bis zum Hitzeaktionsplan.",
          imageSrc: "/pitch/hackathon-kamue-community.jpg",
          badges: ["Kulturzentrum KAMÜ", "Interdisziplinäre Teams", "Offene Challenges", "Laufende Prototypen"],
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Hier sehen Sie unsere beiden Säulen: Säule 1 liefert durch Bürger-Sensoren die dichten Umweltdaten. Säule 2 ist der 48h-Hackathon im KAMÜ, bei dem smarte Köpfe aus diesen Daten greifbare Werkzeuge für die Region bauen.",
        talkingPoints: [
          "Säule 1 sorgt für handfeste Hardware und Beteiligung von Jugendlichen.",
          "Säule 2 sorgt für Software, Bürger-Apps und Erkenntnisse, die der Verwaltung direkt nützen.",
        ],
        audienceEngagement:
          "Stellen Sie die Frage: 'Wann hat Ihre Kommune das letzte Mal Bürger direkt an funktionierenden Prototypen mitbauen lassen?'",
        localHook: "Kulturzentrum KAMÜ Bürstadt als Veranstaltungs- und Werkstattort.",
      },
    },
    {
      id: "folie-4-product",
      stepNumber: 4,
      stepLabel: "04 / Das eigentliche Produkt",
      eyebrow: "Menschen, Know-how & Open Innovation",
      title: "Unser Produkt: Die Initiative, Bündelung von Know-how & Bürgerbildung",
      lead: "Das eigentliche Produkt ist kein fertiges Software-Paket von der Stange. Es ist die Bündelung regionalen Know-hows, digitale Bildung und das gemeinsame Arbeiten für das Ried. Und das Spannende: Was bei einem Hackathon entsteht, ist im Vorfeld bewusst offen und unvorhersehbar!",
      layout: "open-innovation",
      bullets: [
        {
          title: "Bündelung von regionalem Know-how",
          description: "Software-Architekten, Handwerker, Physiklehrer, Schüler und Verwaltungsmitarbeiter arbeiten Hand in Hand statt in getrennten Welten.",
        },
        {
          title: "Digitale Bildung & Mündigkeit",
          description: "Schüler und Bürger verstehen Sensoren, Funk und Datenflüsse, weil sie sie selbst gebaut und in Betrieb genommen haben.",
        },
        {
          title: "Open Innovation & Gestaltungsfreiheit",
          description: "Niemand weiß vorher exakt, was an einem Hackathon-Wochenende entsteht – genau das setzt maximale Kreativität frei. Am Sonntagabend laufen funktionierende Prototypen!",
        },
      ],
      curiousHackathonExamples: [
        {
          title: "Lärm-Ampel für Schulwege & Baustellen",
          description: "Schüler bauten eine Ampel, die Lärmspitzen visualisiert und sichere Ausweichrouten empfiehlt.",
          url: "https://jugendhackt.org/projekte/",
          tag: "Jugend hackt",
        },
        {
          title: "Schranken-Countdown-Bot",
          description: "Sagt aus dem Bahn-Signalton voraus, wie viele Minuten der Bahnübergang noch geschlossen bleibt.",
          url: "https://codefor.de/projekte/",
          tag: "Open Knowledge",
        },
        {
          title: "Smarte Wildtier-Warnung an Straßen",
          description: "Sensor warnt Tiere per Infrarot/Akustik vor herannahenden Fahrzeugen im Riedwald.",
          url: "https://www.stupidhackathon.com/",
          tag: "Maker-Projekt",
        },
        {
          title: "Der Mülleimer, der Danke sagt",
          description: "Ultraschall-Füllstandsmesser belohnt Mülltrennung mit Sprachansage und Meldesystem.",
          url: "https://jugendhackt.org/projekte/",
          tag: "Civic Tech",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Unser Produkt ist kein fertiges Dashboard, sondern der Prozess: Wir bringen Bürger, Schüler und Fachleute zusammen. Bei einem Hackathon weiß man am Freitagnachmittag nie, was am Sonntagabend herauskommt – und genau das ist der Zauber! Aus Rohdaten und Freiheit entstehen oft die genialsten Lösungen.",
        talkingPoints: [
          "Beispiele aus Jugend hackt und weltweiten Civic-Hackathons belegen: Ungewissheit führt zu Innovation.",
          "Verwaltung formuliert Aufgabenstellungen, die Bürger-Teams lösen sie.",
        ],
        audienceEngagement:
          "Zeigen Sie auf die kuriosen Beispiele: 'Genau diese kreative Energie holen wir ins KAMÜ!'",
        localHook: "Bürstadt Kulturzentrum KAMÜ als Raum für freie Ideen.",
      },
    },
    {
      id: "folie-5-synergy",
      stepNumber: 5,
      stepLabel: "05 / Synergien & Wertschätzung",
      eyebrow: "Bestehende Investitionen veredeln",
      title: "Gemeinsames Smart-City-Projekt von Bürstadt & Lampertheim veredeln",
      lead: "Bürstadt und Lampertheim haben bereits gemeinsam in smarte Parksensoren investiert (smartcity-system.de/buerstadt). Wir knüpfen genau hier an: Offene Schnittstellen binden diese Parkdaten in eine zentrale regionale Datenplattform ein – ohne Doppelstrukturen und ohne Mehrkosten für die Kommunen.",
      layout: "unit-economics",
      costComparison: [
        {
          feature: "Smart-City Parksensoren (smartcity-system.de/buerstadt)",
          openRiedSens: "Kostenlose API-Integration in die Plattform",
          commercialSolution: "Isolierte Silo-App / Insellösung",
          advantage: "Volle Synergie",
        },
        {
          feature: "Kommunale Software-Folgekosten",
          openRiedSens: "0 € / Jahr (Open-Source Datenplattform)",
          commercialSolution: "Laufende Lizenz- & Wartungsverträge",
          advantage: "Haushaltsneutral",
        },
        {
          feature: "Erweiterung um Umwelt & Verkehr",
          openRiedSens: "Bürger-Sensoren (CO2, Feinstaub, Lärm)",
          commercialSolution: "Teure Neuausschreibungen",
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
          "Bürstadt und Lampertheim haben bereits Vorarbeit geleistet und Parksensoren installiert. Wir wollen diese Daten nicht verstauben lassen, sondern sie über offene APIs mit Verkehrs- und Umweltdaten auf unserer regionalen Plattform zusammenführen – 0 Euro Zusatzkosten.",
        talkingPoints: [
          "Wertschätzung für die bisherige interkommunale Zusammenarbeit Bürstadt/Lampertheim.",
          "Verknüpfung von Parkplatzdaten mit Wetter, Bahnübergängen und Bürgerapps.",
        ],
        audienceEngagement:
          "Betonen Sie: 'Wir vernetzen das Bestehende zu einem echten Mehrwert für alle Bürger.'",
        localHook: "Interkommunale Achse Bürstadt & Lampertheim.",
      },
    },
    {
      id: "folie-6-roadmap",
      stepNumber: 6,
      stepLabel: "06 / Roadmap & Meilensteine",
      eyebrow: "Klare Prioritäten · Schritt für Schritt",
      title: "Roadmap: Bürstadt & Lampertheim zuerst – dann das Ried und Hessen",
      lead: "Klare Prioritäten: In Q3 2026 ist die zentrale Datenbank und Plattform bereits live erreicht. Jetzt folgt die Pilotphase in Bürstadt und Lampertheim, bevor die Skalierung im Ried und in Hessen startet.",
      layout: "traction-timeline",
      bullets: [
        {
          title: "Bereits erreicht (Q3 2026): Datenbank & Plattform live",
          description: "Zentrale Datenbank und Web-Plattform open-ried.de laufen live. REST-API und Telemetrie-Ingestion stehen bereit.",
          tag: "Erreicht",
        },
        {
          title: "1. Fokus: Bürstadt & Lampertheim (Pilotphase)",
          description: "Anbindung der Smart-City-Parkdaten, 25 Quartiers-Sensoren an Schulen & Bürgerhäusern, Aktivierung der LoRa-Funknetze.",
          tag: "Fokus 1",
        },
        {
          title: "2. Fokus: Weitere Orte im Ried",
          description: "Ausweitung der Bürger-Stationen auf Biblis, Groß-Rohrheim, Einhausen und Lorsch sowie Vorbereitung der Hackathon-Challenges.",
          tag: "Fokus 2",
        },
        {
          title: "3. Fokus: Modellregion & Skalierung in Hessen",
          description: "Der 48h Ried-Hackathon im KAMÜ Bürstadt als Blaupause und Vorbild für den Kreis Bergstraße und weitere Regionen in Hessen.",
          tag: "Fokus 3",
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Hier ist unser klarer Fahrplan: Die Datenbank und Plattform sind in Q3 2026 bereits live erreicht. Unser erster Fokus liegt ganz klar auf Bürstadt und Lampertheim. Wenn das System hier steht, rollen wir es ins restliche Ried und danach als Modellregion nach Hessen aus.",
        talkingPoints: [
          "Kein unüberlegter Schnellschuss, sondern strukturierter Rollout.",
          "Bürstadt und Lampertheim sind die Vorreiter.",
        ],
        audienceEngagement:
          "Zeigen Sie den Zeitstrahl: 'Die technische Basis steht bereits – jetzt starten wir gemeinsam!'",
        localHook: "Fokus-Achse Bürstadt und Lampertheim.",
      },
    },
    {
      id: "folie-7-team",
      stepNumber: 7,
      stepLabel: "07 / Das Core-Team",
      eyebrow: "Wir leben im Ried · Erfahrung & Leidenschaft",
      title: "Das Team vor Ort: Tief im Ried verwurzelt & technologisch erfahren",
      lead: "Wir leben im Ried, engagieren uns vor Ort und bringen jahrzehntelange Erfahrung aus Groß-IT, Industrie-Automation, Kultur und Open Source mit.",
      layout: "team-showcase",
      teamMembers: [
        {
          name: "Rüdiger Engert",
          location: "Bürstadt",
          role: "Gründer Kulturzentrum KAMÜ & Bürgerstiftung",
          imageSrc: "/pitch/ruediger-engert.jpg",
          bio: "Impulsgeber und Gründer des Kultur- und Begegnungszentrums KAMÜ ('Kultur am Übergang') im historischen Getreidespeicher in Bürstadt (ehemals Engert Agrarmarkt). Langjähriger Förderer der regionalen Kultur und Vorstandsmitglied der Bürgerstiftung Bürstadt.",
          highlights: ["KAMÜ Gründer", "Ehemals Engert Agrarmarkt", "Bürgerstiftung Bürstadt"],
        },
        {
          name: "Michael Binzen",
          location: "Bürstadt",
          role: "Senior IT- & Software-Architekt (DB Systel / Bahn IT)",
          imageSrc: "/pitch/michael-binzen.jpg",
          bio: "Über 20 Jahre Software-Architektur und Digitalisierung bei der Deutschen Bahn. Pionier für Open Data, Echtzeit-APIs und Innovationskultur. Bitkom-Referent, Mentor bei 'Jugend Hackt' und aktiv in der Bürstädter Vereinslandschaft (TV 1891 Bürstadt).",
          highlights: ["Open Data & APIs", "DB Systel / Bahn IT", "Jugend Hackt Mentor"],
        },
        {
          name: "Erik Metz",
          location: "Nordheim / Ried",
          role: "Software Engineer, Automatisierung & IoT (Digital Fellow MIT)",
          imageSrc: "/pitch/erik-metz.jpg",
          bio: "20+ Jahre Erfahrung in industrieller Automatisierungstechnik, SPS-Steuerungen, Industrie-Robotik, Embedded Elektronik und IoT. Digital Fellow am MIT, Initiator von Open Ried Sens und Maintainer der Plattform.",
          highlights: ["20+ Jahre Automation & Robotik", "Digital Fellow MIT", "IoT & Open Source Lead"],
        },
      ],
      speakerNotes: {
        elevatorPitch:
          "Wir sind kein anonymes Beratungsunternehmen, sondern Menschen, die im Ried leben: Rüdiger Engert bringt mit dem KAMÜ den zentralen Begegnungsort und Bürgerstiftungs-Erfahrung mit. Michael Binzen steuert 20 Jahre Bahn-IT und Jugend-Hackt-Expertise bei. Erik Metz verbindet 20 Jahre Automation und MIT-Erfahrung mit der Plattform-Architektur.",
        talkingPoints: [
          "Verbindung aus lokaler Verankerung, Kultur, Jugendförderung und Enterprise-IT.",
          "Verlässliche Macher direkt vor Ort.",
        ],
        audienceEngagement: "Geben Sie die Kontaktdaten des Kernteams weiter.",
        localHook: "Bürstadt & Nordheim im Herzen des Rieds.",
      },
    },
    {
      id: "folie-8-ask",
      stepNumber: 8,
      stepLabel: "08 / Unser Ask an die Politik",
      eyebrow: "Konkrete Bitten · Gemeinsam anpacken",
      title: "Unser Ask an die Politik",
      lead: "Wir bitten nicht um Haushaltsgelder, sondern um offene Türen, Datenzugang und partnerschaftliche Unterstützung für die Region.",
      layout: "the-ask-commitment",
      specificAsks: [
        {
          id: "ask-rohdaten",
          title: "1. Rohdaten vom bestehenden Smart-City-Projekt",
          description: "Zugang zu den Rohdaten-Schnittstellen der Parkplatz-Sensoren aus dem gemeinsamen Projekt von Bürstadt & Lampertheim (smartcity-system.de/buerstadt) zur Einbindung in die offene Plattform.",
          commitmentType: "daten",
          tag: "Smart City Daten",
          actionText: "Schnittstellen freigeben",
        },
        {
          id: "ask-live-daten",
          title: "2. Unterstützung für weitere regionale Live-Daten",
          description: "Unterstützung und Fürsprache bei weiteren lokalen Datenquellen: Bahn- und Bus-Echtzeitdaten, ZAKB-Entsorgungstouren und lokale Energieversorger (z.B. EWR).",
          commitmentType: "daten",
          tag: "Live-Datenströme",
          actionText: "Türen öffnen",
        },
        {
          id: "ask-infrastruktur",
          title: "3. Zugang zur bestehenden LoRa-Funkinfrastruktur",
          description: "Nutzung und Öffnung der bereits vorhandenen kommunalen LoRa-Gateways und Funktechnologie im Stadtgebiet für das offene The Things Network (TTN).",
          commitmentType: "infrastruktur",
          tag: "LoRa-Infrastruktur",
          actionText: "Infrastruktur öffnen",
        },
        {
          id: "ask-praesenz",
          title: "4. Schirmherrschaft & Präsenz beim Hackathon",
          description: "Offizielle Schirmherrschaft für den 1. Ried-Hackathon im KAMÜ Bürstadt, Eröffnungs-Keynote und Präsenz bei der öffentlichen Prämierung der Gewinnerprojekte.",
          commitmentType: "praesenz",
          tag: "Schirmherrschaft",
          actionText: "Schirmherrschaft zusagen",
        },
      ],
      callToAction: {
        primaryText: "Partnerschaft vereinbaren",
        primaryHref: "mailto:info@open-ried.de?subject=Kooperation%20Politik%20Open%20Ried%20Sens",
        secondaryText: "Bauanleitung & BOM prüfen",
        secondaryHref: "/sensor-bauen",
      },
      speakerNotes: {
        elevatorPitch:
          "Hier ist unser konkreter 'Ask': Wir wollen kein Geld aus dem Haushalt. Wir bitten um Rohdaten aus dem Smart-City-Projekt, Fürsprache bei ZAKB und Bahn, Zugang zur bestehenden LoRa-Infrastruktur und Ihre Schirmherrschaft beim 1. Ried-Hackathon im KAMÜ.",
        talkingPoints: [
          "Reine Kooperationsvereinbarung ohne Beschaffungsaufwand.",
          "Hohe Bürgerakzeptanz und Medienwirksamkeit für die Politik.",
        ],
        audienceEngagement:
          "Klicken Sie die vier Punkte auf der Folie durch und fragen Sie nach der Zustimmung.",
        localHook: "Kulturzentrum KAMÜ in Bürstadt als Austragungsort.",
      },
    },
    {
      id: "folie-9-live-bonus",
      stepNumber: 9,
      stepLabel: "09 / Live-Daten-Beweis",
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
