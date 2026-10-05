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
  | "story"
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
  | "collected-evidence";

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
    "serviceName": "Sensor.Community (Luftdaten.info)",
    "serviceUrl": "https://sensor.community/de/",
    "imagePath": "/pitch/sensor-community-ried-map.png",
    "headline": "Bürger messen Luftqualität",
    "description": "Externe Plattform als Hintergrund für Rückfragen. Die Karte bildet nur das jeweilige Netzwerk ab.",
    "riedStatus": "Aktuellen Stand bei der Quelle prüfen.",
    "impactBadge": "Hintergrundkarte"
  },
  {
    "serviceName": "TTN Mapper (The Things Network)",
    "serviceUrl": "https://ttnmapper.org/heatmap/",
    "imagePath": "/pitch/ttn-mapper-ried-map.png",
    "headline": "Kartierte LoRaWAN-Messfahrten",
    "description": "Externe Plattform als Hintergrund für Rückfragen. Die Karte bildet nur das jeweilige Netzwerk ab.",
    "riedStatus": "Aktuellen Stand bei der Quelle prüfen.",
    "impactBadge": "Hintergrundkarte"
  },
  {
    "serviceName": "Raspberryshaker (Seismograph für Erschütterungen & Geothermie)",
    "serviceUrl": "https://raspberryshake.org/",
    "imagePath": "/pitch/raspberry-shake-ried-map.png",
    "headline": "Bürger messen Erschütterungen",
    "description": "Externe Plattform als Hintergrund für Rückfragen. Die Karte bildet nur das jeweilige Netzwerk ab.",
    "riedStatus": "Aktuellen Stand bei der Quelle prüfen.",
    "impactBadge": "Hintergrundkarte"
  }
];

export const CORE_TEAM_MEMBERS: TeamMember[] = [
  { name: "Rüdiger Engert", location: "Bürstadt", role: "KAMÜ, Kultur und Bürgerinitiative", imageSrc: "/pitch/ruediger-engert.jpg", bio: "Gründer des KAMÜ im ehemaligen Engert Agrarmarkt. Bringt den Begegnungsort und die Verbindung zur Bürgerschaft ein.", highlights: [] },
  { name: "Michael Binzen", location: "Bürstadt", role: "Software, offene Daten und Jugendförderung", imageSrc: "/pitch/michael-binzen.jpg", bio: "Bringt Erfahrung aus der Bahn-IT und als Mentor bei Jugend hackt ein. Verbindet Datenideen mit gemeinsamer Projektarbeit.", highlights: [] },
  { name: "Erik Metz", location: "Nordheim / Ried", role: "Sensorbau und Open-Ried-Sens-Website", imageSrc: "/pitch/erik-metz.jpg", bio: "Bringt Erfahrung aus Automatisierung und IoT ein. Digital Fellow am MIT und Entwickler der Plattform.", highlights: [] },
];

export const POLITIK_DECK: PitchDeck = {
  "slug": "politik",
  "title": "Daten öffnen und Bürgerinitiative ermöglichen",
  "subtitle": "Eine Bürgerinitiative für das Ried: vorhandene Daten nutzen, eigene Sensoren bauen und beim Hackathon gemeinsam Ideen entwickeln.",
  "targetAudience": "Politik und kommunale Verwaltung",
  "category": "politik",
  "badge": "Politik",
  "accentColor": "emerald",
  "estimatedMinutes": 12,
  "summary": "Rohdatenzugang zuerst, geeignete Funkinfrastruktur als zweiter Schritt. Weitere Kontakte und Hackathon-Unterstützung ergänzen die Kooperation.",
  "slides": [
    {
      "id": "politik-team",
      "stepNumber": 1,
      "stepLabel": "01",
      "eyebrow": "Open Ried Sens",
      "title": "Unser Team im Ried",
      "lead": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
      "layout": "team-showcase",
      "teamMembers": CORE_TEAM_MEMBERS,
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "politik-hackathon",
      "stepNumber": 2,
      "stepLabel": "02",
      "eyebrow": "Open Ried Sens",
      "title": "Was ist ein Hackathon?",
      "lead": "Menschen mit unterschiedlichen Erfahrungen arbeiten für eine begrenzte Zeit gemeinsam an Ideen und ersten Prototypen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Mitmachen",
          "description": "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein."
        },
        {
          "title": "Gemeinsam ausprobieren",
          "description": "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir haben uns zusammengefunden, um einen Hackathon zu organisieren. Dafür suchen wir Daten und Fragestellungen aus unserer Umgebung. Die Ergebnisse bleiben offen: Erste Prototypen sind möglich, fertige Lösungen sind kein Versprechen.",
        "talkingPoints": [
          "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein.",
          "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/hackathon-kamue-community.jpg",
        "alt": "Illustration gemeinsamer Projektarbeit beim Hackathon",
        "caption": "Idee für das gemeinsame Arbeiten im KAMÜ"
      }
    },
    {
      "id": "politik-origin",
      "stepNumber": 3,
      "stepLabel": "03",
      "eyebrow": "Open Ried Sens",
      "title": "Vorhandene Daten als Ausgangspunkt",
      "lead": "Das Smart-City-Projekt von Bürstadt und Lampertheim hat Messdaten geschaffen. Wir möchten als Bürger mehr damit anfangen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Was wir sehen",
          "description": "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung."
        },
        {
          "title": "Was wir ergänzen möchten",
          "description": "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir knüpfen an die Arbeit der beiden Städte an. Aus Bürgersicht möchten wir besser verstehen, wie wir die Daten weiterverwenden können. Welche Rohdaten zugänglich sind, wollen wir mit den Verantwortlichen klären. Die Website smartcity-system.de/buerstadt ist eine bisherige Referenz im Projekt, der genaue Datenumfang muss gemeinsam geklärt werden.",
        "talkingPoints": [
          "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung.",
          "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "politik-collected",
      "stepNumber": 4,
      "stepLabel": "04",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Datenbasis für den Hackathon",
      "lead": "Unsere Website bündelt bereits weitere regionale Daten für den Hackathon.",
      "layout": "story",
      "bullets": [
        {
          "title": "Umwelt und Region",
          "description": "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen."
        },
        {
          "title": "Mobilität und Infrastruktur",
          "description": "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen."
        },
        {
          "title": "Ein Ausgangspunkt für Teams",
          "description": "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir beginnen nicht bei null. Die Website bündelt bereits weitere Daten für den Hackathon. Gesammelte Daten sind je nach Quelle Messwerte, aktuelle Zustände oder Statistiken. Das ist noch kein direkter Zugriff auf alle gewünschten Smart-City-, Bahn-, Bus- oder Müllfahrzeug-Rohdaten.",
        "talkingPoints": [
          "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen.",
          "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen.",
          "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "callToAction": {
        "primaryText": "Gesammelte Daten und Quellen ansehen",
        "primaryHref": "/quellen"
      }
    },
    {
      "id": "politik-sensors",
      "stepNumber": 5,
      "stepLabel": "05",
      "eyebrow": "Open Ried Sens",
      "title": "Eigene Sensoren für das ganze Ried",
      "lead": "Säule 1: Bürger bauen Sensoren und ergänzen die regionale Datenbasis.",
      "layout": "story",
      "bullets": [
        {
          "title": "Mehr Orte einbeziehen",
          "description": "Bürstadt und Lampertheim sind der Ausgangspunkt. Auch Nordheim, Wattenheim, Biblis, Groß-Rohrheim, Hofheim und Rosengarten gehören in unseren Blick."
        },
        {
          "title": "Messen und weiterforschen",
          "description": "Säule 2: Beim Hackathon können Teams eigene und vorhandene Daten gemeinsam untersuchen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Säule 1: Bürger bauen Sensoren und ergänzen die regionale Datenbasis.",
        "talkingPoints": [
          "Bürstadt und Lampertheim sind der Ausgangspunkt. Auch Nordheim, Wattenheim, Biblis, Groß-Rohrheim, Hofheim und Rosengarten gehören in unseren Blick.",
          "Säule 2: Beim Hackathon können Teams eigene und vorhandene Daten gemeinsam untersuchen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/sensor-hardware-kit.jpg",
        "alt": "Sensorbausatz der Initiative",
        "caption": "Bausatz und Messumfang gemeinsam für den Pilot festlegen"
      }
    },
    {
      "id": "politik-school-bridge",
      "stepNumber": 6,
      "stepLabel": "06",
      "eyebrow": "Open Ried Sens",
      "title": "Sensorbau gemeinsam mit Schulen",
      "lead": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
      "layout": "story",
      "bullets": [
        {
          "title": "Interesse genügt",
          "description": "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen."
        },
        {
          "title": "Zu Hause weiterforschen",
          "description": "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
        "talkingPoints": [
          "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen.",
          "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/schul-stem-workshop.jpg",
        "alt": "Illustration eines Sensorbau-Workshops",
        "caption": "Vorschlag: ein erster gemeinsam geplanter Projekttag"
      }
    },
    {
      "id": "politik-data-check",
      "stepNumber": 7,
      "stepLabel": "07",
      "eyebrow": "Open Ried Sens",
      "title": "Gesammelte Daten im Quellencheck",
      "lead": "Echte gespeicherte Quelldaten mit Herkunft und Quellenstand.",
      "layout": "collected-evidence",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Diese Ansicht fragt echte Datensätze der Website ab. Sie zeigt Quelle, Quellenstand und einen Ausschnitt der Antwort. Fehlende oder nicht erreichbare Daten bleiben sichtbar. Es werden keine Müllleerungen, Zugfahrten oder Funkpakete aus der Vortragsdauer errechnet. Die Demo ist ein optionaler Blick auf den Stand der Website, kein Beweis für die noch gewünschten Rohdatenzugänge.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "politik-raw-data",
      "stepNumber": 8,
      "stepLabel": "08",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere wichtigste Bitte: Rohdatenzugang",
      "lead": "Wir möchten die Daten des gemeinsamen Projekts selbst untersuchen und für den Hackathon nutzen.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Wir möchten die Daten des gemeinsamen Projekts selbst untersuchen und für den Hackathon nutzen.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "ask-rohdaten",
          "title": "1. Rohdaten des Smart-City-Projekts",
          "description": "Zugang zu verfügbaren Einzelmessungen mit Zeitstempeln, Datenbeschreibung und geklärten Nutzungsbedingungen. Dafür einen technischen Ansprechpartner benennen.",
          "commitmentType": "daten",
          "tag": "Höchste Priorität",
          "actionText": "Datenansprechpartner benennen"
        }
      ]
    },
    {
      "id": "politik-network",
      "stepNumber": 9,
      "stepLabel": "09",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere zweite Bitte: Sensoren anbinden",
      "lead": "Die vorhandene Funktechnik ist noch zu klären. Falls sie geeignet ist, möchten wir daran anknüpfen.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Die vorhandene Funktechnik ist noch zu klären. Falls sie geeignet ist, möchten wir daran anknüpfen.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "ask-infrastruktur",
          "title": "2. Vorhandene Funkinfrastruktur nutzen",
          "description": "Technik und Betreiber klären. Falls ein geeignetes LoRaWAN-Netz besteht, einen eigenen Sensor testweise anbinden und die Teilnahmebedingungen abstimmen.",
          "commitmentType": "infrastruktur",
          "tag": "Zweite Priorität",
          "actionText": "Netzprüfung vereinbaren"
        }
      ]
    },
    {
      "id": "politik-next-step",
      "stepNumber": 10,
      "stepLabel": "10",
      "eyebrow": "Open Ried Sens",
      "title": "Weitere Unterstützung und nächster Schritt",
      "lead": "Zuerst einen Datenansprechpartner und einen Termin zur Netzprüfung vereinbaren. Weitere Unterstützung ist willkommen.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Zuerst einen Datenansprechpartner und einen Termin zur Netzprüfung vereinbaren. Weitere Unterstützung ist willkommen.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "ask-live-daten",
          "title": "3. Kontakte zu weiteren Datenanbietern",
          "description": "Fürsprache bei Bahn, VRN und ZAKB für Bahnhöfe, Züge, Bahnübergänge, Busse und Müllfahrzeuge. Datenfreigaben entscheiden die jeweiligen Anbieter.",
          "commitmentType": "daten",
          "tag": "Ergänzende Unterstützung",
          "actionText": "Termin vereinbaren"
        },
        {
          "id": "ask-praesenz",
          "title": "4. Bürgermeister beim Hackathon",
          "description": "Ein oder beide Bürgermeister zur Eröffnung einladen. Eine Keynote, Schirmherrschaft oder Unterstützung des Hauptpreises wäre willkommen.",
          "commitmentType": "praesenz",
          "tag": "Optional",
          "actionText": "Beteiligung besprechen"
        }
      ],
      "callToAction": {
        "primaryText": "Kooperationsgespräch vereinbaren",
        "primaryHref": "mailto:info@open-ried.de?subject=Ried-Hackathon"
      }
    }
  ]
};

export const SCHULEN_DECK: PitchDeck = {
  "slug": "schulen",
  "title": "Sensorbau als gemeinsames Schulprojekt",
  "subtitle": "Eine Bürgerinitiative für das Ried: vorhandene Daten nutzen, eigene Sensoren bauen und beim Hackathon gemeinsam Ideen entwickeln.",
  "targetAudience": "Schulleitungen, MINT-Lehrkräfte und Jugend forscht",
  "category": "bildung",
  "badge": "Schulen",
  "accentColor": "sky",
  "estimatedMinutes": 10,
  "summary": "Ein erster Projekttag mit interessierten Jugendlichen. Sensorbau, Messverständnis und freiwillige Teilnahme am Hackathon.",
  "slides": [
    {
      "id": "schulen-team",
      "stepNumber": 1,
      "stepLabel": "01",
      "eyebrow": "Open Ried Sens",
      "title": "Unser Team im Ried",
      "lead": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
      "layout": "team-showcase",
      "teamMembers": CORE_TEAM_MEMBERS,
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "schulen-hackathon",
      "stepNumber": 2,
      "stepLabel": "02",
      "eyebrow": "Open Ried Sens",
      "title": "Was ist ein Hackathon?",
      "lead": "Menschen mit unterschiedlichen Erfahrungen arbeiten für eine begrenzte Zeit gemeinsam an Ideen und ersten Prototypen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Mitmachen",
          "description": "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein."
        },
        {
          "title": "Gemeinsam ausprobieren",
          "description": "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir haben uns zusammengefunden, um einen Hackathon zu organisieren. Dafür suchen wir Daten und Fragestellungen aus unserer Umgebung. Die Ergebnisse bleiben offen: Erste Prototypen sind möglich, fertige Lösungen sind kein Versprechen.",
        "talkingPoints": [
          "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein.",
          "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/hackathon-kamue-community.jpg",
        "alt": "Illustration gemeinsamer Projektarbeit beim Hackathon",
        "caption": "Idee für das gemeinsame Arbeiten im KAMÜ"
      }
    },
    {
      "id": "schulen-origin",
      "stepNumber": 3,
      "stepLabel": "03",
      "eyebrow": "Open Ried Sens",
      "title": "Vorhandene Daten als Ausgangspunkt",
      "lead": "Das Smart-City-Projekt von Bürstadt und Lampertheim hat Messdaten geschaffen. Wir möchten als Bürger mehr damit anfangen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Was wir sehen",
          "description": "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung."
        },
        {
          "title": "Was wir ergänzen möchten",
          "description": "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir knüpfen an die Arbeit der beiden Städte an. Aus Bürgersicht möchten wir besser verstehen, wie wir die Daten weiterverwenden können. Welche Rohdaten zugänglich sind, wollen wir mit den Verantwortlichen klären. Die Website smartcity-system.de/buerstadt ist eine bisherige Referenz im Projekt, der genaue Datenumfang muss gemeinsam geklärt werden.",
        "talkingPoints": [
          "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung.",
          "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "schulen-collected",
      "stepNumber": 4,
      "stepLabel": "04",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Datenbasis für den Hackathon",
      "lead": "Unsere Website bündelt bereits weitere regionale Daten für den Hackathon.",
      "layout": "story",
      "bullets": [
        {
          "title": "Umwelt und Region",
          "description": "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen."
        },
        {
          "title": "Mobilität und Infrastruktur",
          "description": "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen."
        },
        {
          "title": "Ein Ausgangspunkt für Teams",
          "description": "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir beginnen nicht bei null. Die Website bündelt bereits weitere Daten für den Hackathon. Gesammelte Daten sind je nach Quelle Messwerte, aktuelle Zustände oder Statistiken. Das ist noch kein direkter Zugriff auf alle gewünschten Smart-City-, Bahn-, Bus- oder Müllfahrzeug-Rohdaten.",
        "talkingPoints": [
          "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen.",
          "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen.",
          "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "callToAction": {
        "primaryText": "Gesammelte Daten und Quellen ansehen",
        "primaryHref": "/quellen"
      }
    },
    {
      "id": "schulen-school-bridge",
      "stepNumber": 5,
      "stepLabel": "05",
      "eyebrow": "Open Ried Sens",
      "title": "Sensorbau gemeinsam mit Schulen",
      "lead": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
      "layout": "story",
      "bullets": [
        {
          "title": "Interesse genügt",
          "description": "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen."
        },
        {
          "title": "Zu Hause weiterforschen",
          "description": "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
        "talkingPoints": [
          "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen.",
          "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/schul-stem-workshop.jpg",
        "alt": "Illustration eines Sensorbau-Workshops",
        "caption": "Vorschlag: ein erster gemeinsam geplanter Projekttag"
      }
    },
    {
      "id": "schulen-learning",
      "stepNumber": 6,
      "stepLabel": "06",
      "eyebrow": "Open Ried Sens",
      "title": "Was Jugendliche dabei lernen",
      "lead": "Ein überschaubarer Einstieg, mit Raum für Vertiefung.",
      "layout": "story",
      "bullets": [
        {
          "title": "Praktisches Handwerk",
          "description": "Sensor und Gehäuse zusammenbauen, Werkzeuge unter Anleitung verwenden."
        },
        {
          "title": "Messwerte verstehen",
          "description": "Messprinzip und Grenzen kennenlernen, Werte vergleichen und eigene Fragen untersuchen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Ein überschaubarer Einstieg, mit Raum für Vertiefung.",
        "talkingPoints": [
          "Sensor und Gehäuse zusammenbauen, Werkzeuge unter Anleitung verwenden.",
          "Messprinzip und Grenzen kennenlernen, Werte vergleichen und eigene Fragen untersuchen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "schulen-pilot",
      "stepNumber": 7,
      "stepLabel": "07",
      "eyebrow": "Open Ried Sens",
      "title": "Ein erster Projekttag",
      "lead": "Mit einer Partnerschule starten und den Umfang gemeinsam festlegen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Gemeinsame Vorbereitung",
          "description": "Altersgruppe, Betreuung, Räume, Werkzeuge und Material abstimmen."
        },
        {
          "title": "Finanzierung klären",
          "description": "Wir fordern kein Schulbudget. Firmenpaten, Fördervereine oder andere Beiträge sollen die Bausätze ermöglichen. Zusagen vor der Ausschreibung klären."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Mit einer Partnerschule starten und den Umfang gemeinsam festlegen.",
        "talkingPoints": [
          "Altersgruppe, Betreuung, Räume, Werkzeuge und Material abstimmen.",
          "Wir fordern kein Schulbudget. Firmenpaten, Fördervereine oder andere Beiträge sollen die Bausätze ermöglichen. Zusagen vor der Ausschreibung klären."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "schulen-data-check",
      "stepNumber": 8,
      "stepLabel": "08",
      "eyebrow": "Open Ried Sens",
      "title": "Gesammelte Daten im Quellencheck",
      "lead": "Echte gespeicherte Quelldaten mit Herkunft und Quellenstand.",
      "layout": "collected-evidence",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Diese Ansicht fragt echte Datensätze der Website ab. Sie zeigt Quelle, Quellenstand und einen Ausschnitt der Antwort. Fehlende oder nicht erreichbare Daten bleiben sichtbar. Es werden keine Müllleerungen, Zugfahrten oder Funkpakete aus der Vortragsdauer errechnet. Die Demo ist ein optionaler Blick auf den Stand der Website, kein Beweis für die noch gewünschten Rohdatenzugänge.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "schulen-next-step",
      "stepNumber": 9,
      "stepLabel": "09",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Bitte an die Schule",
      "lead": "Eine Kontaktlehrkraft benennen und einen ersten Planungstermin vereinbaren.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Eine Kontaktlehrkraft benennen und einen ersten Planungstermin vereinbaren.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "school-day",
          "title": "Projekttag und Ausschreibung",
          "description": "Ein geeignetes Format abstimmen und interessierte Jugendliche ansprechen.",
          "commitmentType": "schulen",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        },
        {
          "id": "school-hackathon",
          "title": "Freiwillig beim Hackathon mitmachen",
          "description": "Jugendliche können ihre Messfragen und Ergebnisse einbringen. Standort und Teilnahme gemeinsam begleiten.",
          "commitmentType": "praesenz",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        }
      ],
      "callToAction": {
        "primaryText": "Projekttag gemeinsam planen",
        "primaryHref": "mailto:info@open-ried.de?subject=Ried-Hackathon"
      }
    }
  ]
};

export const VHS_DECK: PitchDeck = {
  "slug": "vhs",
  "title": "Sensorbau und Bürgerwissenschaft an der VHS",
  "subtitle": "Eine Bürgerinitiative für das Ried: vorhandene Daten nutzen, eigene Sensoren bauen und beim Hackathon gemeinsam Ideen entwickeln.",
  "targetAudience": "VHS-Leitungen und Erwachsenenbildung",
  "category": "bildung",
  "badge": "VHS",
  "accentColor": "violet",
  "estimatedMinutes": 10,
  "summary": "Gemeinsam einen Pilotkurs planen: Sensoren bauen, Messwerte verstehen und im Ried mitforschen.",
  "slides": [
    {
      "id": "vhs-team",
      "stepNumber": 1,
      "stepLabel": "01",
      "eyebrow": "Open Ried Sens",
      "title": "Unser Team im Ried",
      "lead": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
      "layout": "team-showcase",
      "teamMembers": CORE_TEAM_MEMBERS,
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "vhs-hackathon",
      "stepNumber": 2,
      "stepLabel": "02",
      "eyebrow": "Open Ried Sens",
      "title": "Was ist ein Hackathon?",
      "lead": "Menschen mit unterschiedlichen Erfahrungen arbeiten für eine begrenzte Zeit gemeinsam an Ideen und ersten Prototypen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Mitmachen",
          "description": "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein."
        },
        {
          "title": "Gemeinsam ausprobieren",
          "description": "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir haben uns zusammengefunden, um einen Hackathon zu organisieren. Dafür suchen wir Daten und Fragestellungen aus unserer Umgebung. Die Ergebnisse bleiben offen: Erste Prototypen sind möglich, fertige Lösungen sind kein Versprechen.",
        "talkingPoints": [
          "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein.",
          "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/hackathon-kamue-community.jpg",
        "alt": "Illustration gemeinsamer Projektarbeit beim Hackathon",
        "caption": "Idee für das gemeinsame Arbeiten im KAMÜ"
      }
    },
    {
      "id": "vhs-origin",
      "stepNumber": 3,
      "stepLabel": "03",
      "eyebrow": "Open Ried Sens",
      "title": "Vorhandene Daten als Ausgangspunkt",
      "lead": "Das Smart-City-Projekt von Bürstadt und Lampertheim hat Messdaten geschaffen. Wir möchten als Bürger mehr damit anfangen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Was wir sehen",
          "description": "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung."
        },
        {
          "title": "Was wir ergänzen möchten",
          "description": "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir knüpfen an die Arbeit der beiden Städte an. Aus Bürgersicht möchten wir besser verstehen, wie wir die Daten weiterverwenden können. Welche Rohdaten zugänglich sind, wollen wir mit den Verantwortlichen klären. Die Website smartcity-system.de/buerstadt ist eine bisherige Referenz im Projekt, der genaue Datenumfang muss gemeinsam geklärt werden.",
        "talkingPoints": [
          "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung.",
          "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "vhs-collected",
      "stepNumber": 4,
      "stepLabel": "04",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Datenbasis für den Hackathon",
      "lead": "Unsere Website bündelt bereits weitere regionale Daten für den Hackathon.",
      "layout": "story",
      "bullets": [
        {
          "title": "Umwelt und Region",
          "description": "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen."
        },
        {
          "title": "Mobilität und Infrastruktur",
          "description": "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen."
        },
        {
          "title": "Ein Ausgangspunkt für Teams",
          "description": "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir beginnen nicht bei null. Die Website bündelt bereits weitere Daten für den Hackathon. Gesammelte Daten sind je nach Quelle Messwerte, aktuelle Zustände oder Statistiken. Das ist noch kein direkter Zugriff auf alle gewünschten Smart-City-, Bahn-, Bus- oder Müllfahrzeug-Rohdaten.",
        "talkingPoints": [
          "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen.",
          "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen.",
          "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "callToAction": {
        "primaryText": "Gesammelte Daten und Quellen ansehen",
        "primaryHref": "/quellen"
      }
    },
    {
      "id": "vhs-course",
      "stepNumber": 5,
      "stepLabel": "05",
      "eyebrow": "Open Ried Sens",
      "title": "Unser Vorschlag für einen Sensorkurs",
      "lead": "In drei Terminen schrittweise bauen, Messwerte verstehen und gemeinsam auswerten.",
      "layout": "story",
      "bullets": [
        {
          "title": "Bau und Inbetriebnahme",
          "description": "Werkzeuge kennenlernen, Sensor montieren und eine geeignete Verbindung prüfen."
        },
        {
          "title": "Auswertung und Mitforschen",
          "description": "Eigene Werte verstehen und Fragen entwickeln. Dauer und Schwierigkeitsgrad im Pilot erproben."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "In drei Terminen schrittweise bauen, Messwerte verstehen und gemeinsam auswerten.",
        "talkingPoints": [
          "Werkzeuge kennenlernen, Sensor montieren und eine geeignete Verbindung prüfen.",
          "Eigene Werte verstehen und Fragen entwickeln. Dauer und Schwierigkeitsgrad im Pilot erproben."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/sensor-hardware-kit.jpg",
        "alt": "Sensorbausatz für einen möglichen VHS-Kurs"
      }
    },
    {
      "id": "vhs-course-plan",
      "stepNumber": 6,
      "stepLabel": "06",
      "eyebrow": "Open Ried Sens",
      "title": "Nach dem Kurs weiterforschen",
      "lead": "Eine eigene Station kann zum Einstieg in Bürgerwissenschaft und den Hackathon werden.",
      "layout": "story",
      "bullets": [
        {
          "title": "Zu Hause oder gemeinsam",
          "description": "Geeigneten Standort und Verbindung prüfen. Ergebnisse mit anderen Teilnehmenden teilen."
        },
        {
          "title": "Kursorganisation",
          "description": "Räume, Dozenten, Werkzeuge, Materialkosten, Gebühren und Ausschreibungsfrist gemeinsam abstimmen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Eine eigene Station kann zum Einstieg in Bürgerwissenschaft und den Hackathon werden.",
        "talkingPoints": [
          "Geeigneten Standort und Verbindung prüfen. Ergebnisse mit anderen Teilnehmenden teilen.",
          "Räume, Dozenten, Werkzeuge, Materialkosten, Gebühren und Ausschreibungsfrist gemeinsam abstimmen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "vhs-data-check",
      "stepNumber": 7,
      "stepLabel": "07",
      "eyebrow": "Open Ried Sens",
      "title": "Gesammelte Daten im Quellencheck",
      "lead": "Echte gespeicherte Quelldaten mit Herkunft und Quellenstand.",
      "layout": "collected-evidence",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Diese Ansicht fragt echte Datensätze der Website ab. Sie zeigt Quelle, Quellenstand und einen Ausschnitt der Antwort. Fehlende oder nicht erreichbare Daten bleiben sichtbar. Es werden keine Müllleerungen, Zugfahrten oder Funkpakete aus der Vortragsdauer errechnet. Die Demo ist ein optionaler Blick auf den Stand der Website, kein Beweis für die noch gewünschten Rohdatenzugänge.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "vhs-next-step",
      "stepNumber": 8,
      "stepLabel": "08",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Bitte an die VHS",
      "lead": "Einen Pilotkurs gemeinsam konkretisieren und anschließend die Aufnahme ins Programm prüfen.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Einen Pilotkurs gemeinsam konkretisieren und anschließend die Aufnahme ins Programm prüfen.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "vhs-program",
          "title": "Kontakt zur Programmplanung",
          "description": "Zielgruppe, Termin und Ausschreibung abstimmen.",
          "commitmentType": "schulen",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        },
        {
          "id": "vhs-roles",
          "title": "Aufgaben und Kosten vereinbaren",
          "description": "Die Initiative bringt Fachwissen und Kursidee ein. Dozenten, Werkzeuge, Räume und Finanzierung verbindlich abstimmen.",
          "commitmentType": "infrastruktur",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        }
      ],
      "callToAction": {
        "primaryText": "Pilotkurs besprechen",
        "primaryHref": "mailto:info@open-ried.de?subject=Ried-Hackathon"
      }
    }
  ]
};

export const WIRTSCHAFT_DECK: PitchDeck = {
  "slug": "wirtschaft",
  "title": "Unternehmen unterstützen Sensorbau und Hackathon",
  "subtitle": "Eine Bürgerinitiative für das Ried: vorhandene Daten nutzen, eigene Sensoren bauen und beim Hackathon gemeinsam Ideen entwickeln.",
  "targetAudience": "Regionale Unternehmen und Stadtwerke",
  "category": "wirtschaft",
  "badge": "Wirtschaft & Stadtwerke",
  "accentColor": "amber",
  "estimatedMinutes": 10,
  "summary": "Bausätze, Fachwissen oder den Hackathon unterstützen. Unternehmen und Stadtwerke wählen einen konkreten ersten Beitrag.",
  "slides": [
    {
      "id": "wirtschaft-team",
      "stepNumber": 1,
      "stepLabel": "01",
      "eyebrow": "Open Ried Sens",
      "title": "Unser Team im Ried",
      "lead": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
      "layout": "team-showcase",
      "teamMembers": CORE_TEAM_MEMBERS,
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Wir sind drei Menschen aus der Region und möchten gemeinsam einen Hackathon für das Ried organisieren.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "wirtschaft-hackathon",
      "stepNumber": 2,
      "stepLabel": "02",
      "eyebrow": "Open Ried Sens",
      "title": "Was ist ein Hackathon?",
      "lead": "Menschen mit unterschiedlichen Erfahrungen arbeiten für eine begrenzte Zeit gemeinsam an Ideen und ersten Prototypen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Mitmachen",
          "description": "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein."
        },
        {
          "title": "Gemeinsam ausprobieren",
          "description": "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir haben uns zusammengefunden, um einen Hackathon zu organisieren. Dafür suchen wir Daten und Fragestellungen aus unserer Umgebung. Die Ergebnisse bleiben offen: Erste Prototypen sind möglich, fertige Lösungen sind kein Versprechen.",
        "talkingPoints": [
          "Schüler, Bürger, Entwickler und Menschen mit Fachwissen bringen ihre Perspektiven ein.",
          "Eine regionale Frage untersuchen, eine Idee entwickeln und Ergebnisse vorstellen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/hackathon-kamue-community.jpg",
        "alt": "Illustration gemeinsamer Projektarbeit beim Hackathon",
        "caption": "Idee für das gemeinsame Arbeiten im KAMÜ"
      }
    },
    {
      "id": "wirtschaft-origin",
      "stepNumber": 3,
      "stepLabel": "03",
      "eyebrow": "Open Ried Sens",
      "title": "Vorhandene Daten als Ausgangspunkt",
      "lead": "Das Smart-City-Projekt von Bürstadt und Lampertheim hat Messdaten geschaffen. Wir möchten als Bürger mehr damit anfangen.",
      "layout": "story",
      "bullets": [
        {
          "title": "Was wir sehen",
          "description": "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung."
        },
        {
          "title": "Was wir ergänzen möchten",
          "description": "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir knüpfen an die Arbeit der beiden Städte an. Aus Bürgersicht möchten wir besser verstehen, wie wir die Daten weiterverwenden können. Welche Rohdaten zugänglich sind, wollen wir mit den Verantwortlichen klären. Die Website smartcity-system.de/buerstadt ist eine bisherige Referenz im Projekt, der genaue Datenumfang muss gemeinsam geklärt werden.",
        "talkingPoints": [
          "Im bisherigen Dashboard stehen uns aggregierte Darstellungen zur Verfügung.",
          "Einzelmessungen selbst auswerten und mit weiteren regionalen Daten verbinden."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "wirtschaft-collected",
      "stepNumber": 4,
      "stepLabel": "04",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Datenbasis für den Hackathon",
      "lead": "Unsere Website bündelt bereits weitere regionale Daten für den Hackathon.",
      "layout": "story",
      "bullets": [
        {
          "title": "Umwelt und Region",
          "description": "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen."
        },
        {
          "title": "Mobilität und Infrastruktur",
          "description": "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen."
        },
        {
          "title": "Ein Ausgangspunkt für Teams",
          "description": "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir beginnen nicht bei null. Die Website bündelt bereits weitere Daten für den Hackathon. Gesammelte Daten sind je nach Quelle Messwerte, aktuelle Zustände oder Statistiken. Das ist noch kein direkter Zugriff auf alle gewünschten Smart-City-, Bahn-, Bus- oder Müllfahrzeug-Rohdaten.",
        "talkingPoints": [
          "Zum Beispiel Pegelstände, Grundwasser und regionale Flächeninformationen.",
          "Verkehr, Haltestellen und Infrastruktur ergänzen die Umweltinformationen.",
          "Die Daten helfen beim Entwickeln eigener Fragen. Kommunale Rohdaten sollen sie ergänzen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "callToAction": {
        "primaryText": "Gesammelte Daten und Quellen ansehen",
        "primaryHref": "/quellen"
      }
    },
    {
      "id": "wirtschaft-school-bridge",
      "stepNumber": 5,
      "stepLabel": "05",
      "eyebrow": "Open Ried Sens",
      "title": "Sensorbau gemeinsam mit Schulen",
      "lead": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
      "layout": "story",
      "bullets": [
        {
          "title": "Interesse genügt",
          "description": "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen."
        },
        {
          "title": "Zu Hause weiterforschen",
          "description": "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Ein erster Projekttag verbindet digitale Bildung mit der Bürgerinitiative.",
        "talkingPoints": [
          "Über Lehrkräfte, MINT-AGs und Jugend forscht interessierte Jugendliche erreichen. Später mehrere Schulen einbeziehen.",
          "Bei geeignetem Standort und mit Zustimmung der Familie kann der Sensor zu Hause stehen. Das kann auch Nachbarn und Freunde auf den Hackathon aufmerksam machen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "imageVisual": {
        "src": "/pitch/schul-stem-workshop.jpg",
        "alt": "Illustration eines Sensorbau-Workshops",
        "caption": "Vorschlag: ein erster gemeinsam geplanter Projekttag"
      }
    },
    {
      "id": "wirtschaft-participation",
      "stepNumber": 6,
      "stepLabel": "06",
      "eyebrow": "Open Ried Sens",
      "title": "So kann Ihr Betrieb mitmachen",
      "lead": "Regionale Bildungsförderung ist ein konkreter Beitrag zu CSR (Corporate Social Responsibility).",
      "layout": "story",
      "bullets": [
        {
          "title": "Bausätze oder Veranstaltung unterstützen",
          "description": "Material für Schüler, Sachpreise oder Catering ermöglichen. Umfang und Kosten gemeinsam festlegen."
        },
        {
          "title": "Fachwissen einbringen",
          "description": "Mentoren oder eine geeignete Firmen-Challenge anbieten. Ein Workshop mit Azubis ist eine weitere Möglichkeit."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Regionale Bildungsförderung ist ein konkreter Beitrag zu CSR (Corporate Social Responsibility).",
        "talkingPoints": [
          "Material für Schüler, Sachpreise oder Catering ermöglichen. Umfang und Kosten gemeinsam festlegen.",
          "Mentoren oder eine geeignete Firmen-Challenge anbieten. Ein Workshop mit Azubis ist eine weitere Möglichkeit."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "wirtschaft-scope",
      "stepNumber": 7,
      "stepLabel": "07",
      "eyebrow": "Open Ried Sens",
      "title": "Ein passender erster Beitrag",
      "lead": "Wir stimmen eine überschaubare Beteiligung mit Ihnen ab.",
      "layout": "story",
      "bullets": [
        {
          "title": "Für Unternehmen",
          "description": "Einen Projekttag oder Hackathon-Beitrag wählen. Bausatzkosten prüfen, bevor ein Komplettpreis zugesagt wird."
        },
        {
          "title": "Für Stadtwerke",
          "description": "Datenzugänge, Betreiberwissen oder Infrastruktur prüfen. LoRaWAN einfach erklärt: Funk für kleine Sensorpakete, dessen Empfang und Bedingungen wir am Standort testen müssen."
        }
      ],
      "speakerNotes": {
        "elevatorPitch": "Wir stimmen eine überschaubare Beteiligung mit Ihnen ab.",
        "talkingPoints": [
          "Einen Projekttag oder Hackathon-Beitrag wählen. Bausatzkosten prüfen, bevor ein Komplettpreis zugesagt wird.",
          "Datenzugänge, Betreiberwissen oder Infrastruktur prüfen. LoRaWAN einfach erklärt: Funk für kleine Sensorpakete, dessen Empfang und Bedingungen wir am Standort testen müssen."
        ],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "wirtschaft-data-check",
      "stepNumber": 8,
      "stepLabel": "08",
      "eyebrow": "Open Ried Sens",
      "title": "Gesammelte Daten im Quellencheck",
      "lead": "Echte gespeicherte Quelldaten mit Herkunft und Quellenstand.",
      "layout": "collected-evidence",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Diese Ansicht fragt echte Datensätze der Website ab. Sie zeigt Quelle, Quellenstand und einen Ausschnitt der Antwort. Fehlende oder nicht erreichbare Daten bleiben sichtbar. Es werden keine Müllleerungen, Zugfahrten oder Funkpakete aus der Vortragsdauer errechnet. Die Demo ist ein optionaler Blick auf den Stand der Website, kein Beweis für die noch gewünschten Rohdatenzugänge.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      }
    },
    {
      "id": "wirtschaft-next-step",
      "stepNumber": 9,
      "stepLabel": "09",
      "eyebrow": "Open Ried Sens",
      "title": "Unsere Bitte an Ihr Unternehmen",
      "lead": "Eine Beteiligungsform wählen und einen Ansprechpartner für die Ausarbeitung benennen.",
      "layout": "the-ask-commitment",
      "bullets": [],
      "speakerNotes": {
        "elevatorPitch": "Eine Beteiligungsform wählen und einen Ansprechpartner für die Ausarbeitung benennen.",
        "talkingPoints": [],
        "audienceEngagement": "Den nächsten Schritt gemeinsam konkretisieren.",
        "localHook": "Wir leben im Ried. Das KAMÜ in Bürstadt ist unser Treffpunkt."
      },
      "specificAsks": [
        {
          "id": "business-sponsor",
          "title": "Sensorbau oder Hackathon fördern",
          "description": "Einzelne Bausätze, einen Projekttag oder einen Veranstaltungsbeitrag gemeinsam kalkulieren.",
          "commitmentType": "finanzen",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        },
        {
          "id": "business-challenge",
          "title": "Mentoring, Challenge oder Infrastruktur",
          "description": "Ein geeignetes Thema oder einen prüfbaren Daten- und Infrastrukturbeitrag vereinbaren.",
          "commitmentType": "infrastruktur",
          "tag": "Nächster Schritt",
          "actionText": "Termin vereinbaren"
        }
      ],
      "callToAction": {
        "primaryText": "Beteiligung besprechen",
        "primaryHref": "mailto:info@open-ried.de?subject=Ried-Hackathon"
      }
    }
  ]
};

export const PITCH_DECKS: PitchDeck[] = [POLITIK_DECK, SCHULEN_DECK, VHS_DECK, WIRTSCHAFT_DECK];

export function getPitchDeckBySlug(slug: string): PitchDeck | undefined {
  return PITCH_DECKS.find((deck) => deck.slug === slug);
}
