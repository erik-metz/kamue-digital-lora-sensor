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

export interface PitchSlide {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  bullets?: SlideBullet[];
  stats?: SlideStat[];
  mapEvidence?: MapEvidence[];
  quote?: {
    text: string;
    author: string;
    role: string;
  };
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
  accentColor: "emerald" | "sky" | "violet" | "amber" | "rose" | "teal";
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

export const PITCH_DECKS: PitchDeck[] = [
  {
    slug: "politik",
    title: "Smarte Daseinsvorsorge fürs Hessische Ried",
    subtitle:
      "Wie Bürstadt & die Ried-Kommunen mit offenen Sensoren und einem Bürger-Hackathon digitale Unabhängigkeit schaffen",
    targetAudience: "Bürgermeister, Landräte, Beigeordnete, Stadträte & Fraktionen",
    category: "politik",
    badge: "Kommunale Daseinsvorsorge",
    accentColor: "emerald",
    estimatedMinutes: 12,
    summary:
      "Präsentation für kommunale Entscheider: Datenhoheit sichern, Hitze- & Dürrefrühwarnung etablieren, Bürgerbeteiligung stärken – ohne Millionenbudgets oder proprietären Vendor Lock-in.",
    slides: [
      {
        id: "intro",
        eyebrow: "Vision 2026/2027 · Kommunen & Landkreis",
        title: "Das Hessische Ried übernimmt die Führung bei Open Data & Daseinsvorsorge",
        lead: "Statt teurer Konzerngutachten und proprietärer Cloud-Lösungen bauen wir gemeinsam mit den Bürgerinnen und Bürgern ein echtes, souveränes Umwelt- und Klimadatennetzwerk.",
        bullets: [
          {
            title: "Daseinsvorsorge im Klimawandel",
            description: "Hitzestau in Ortskernen, Sandstürme auf Feldern, Grundwasserstände und Riedbahn-Belastung präzise erfassen.",
            tag: "Lokal messbar",
          },
          {
            title: "100 % Open Source & Datenhoheit",
            description: "Alle Daten gehören der Region und den Kommunen. Kein Lizenz-Abo, kein Vendor Lock-in, Open Data Hessen konform.",
            tag: "Souverän",
          },
          {
            title: "Bürgerbeteiligung, die begeistert",
            description: "Durch den Ried-Hackathon und Sensor-Workshops im KAMÜ Bürstadt werden Bürgerinnen und Jugendliche zu Mitgestaltern.",
            tag: "Gemeinschaft",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Sehr geehrte Damen und Herren, wir müssen Digitalisierung nicht für Millionenbeträge bei Großkonzernen einkaufen. Mit Open Ried Sens zeigen wir, wie das Hessische Ried zur Modellregion für offene, bürgernahe Daseinsvorsorge wird.",
          talkingPoints: [
            "Kommunen stehen vor der Pflicht zur Klimafolgenanpassung (§ 12 Hessisches Klimagesetz).",
            "Bisher fehlen dafür kleinräumige, hochauflösende Messdaten aus den Wohnquartieren.",
            "Mit unserer Plattform und dem Hackathon machen wir Bürstadt und das Ried zum Vorzeigemodell in Hessen.",
          ],
          audienceEngagement:
            "Frage in die Runde: Wissen Sie, wie heiß die Marktplätze in Bürstadt oder Lampertheim an Tropennächten wirklich bleiben?",
          localHook: "Kulturzentrum KAMÜ in Bürstadt als Innovations- und Bürger-Labor im Altkreis Bergstraße.",
        },
      },
      {
        id: "status-quo-blindspot",
        eyebrow: "Beweislage · Globale Citizen-Science-Karten",
        title: "Der digitale Blindfleck: Das Hessische Ried existiert auf Weltkarten kaum",
        lead: "Ein Blick auf die führenden weltweiten Open-Data-Karten deckt die Realität auf: Zwischen den Zentren Worms, Darmstadt und Mannheim klafft im Ried eine gravierende Datenlücke.",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Schauen Sie sich diese drei Karten an. Das ist kein Zufall, das ist eine systematische Unterversorgung des ländlichen Raums im Hessischen Ried.",
          talkingPoints: [
            "Sensor.Community: Während Darmstadt und Heidelberg grün vor Messstationen sind, ist das Ried weiß.",
            "TTN Mapper: LoRaWAN-Funk gibt es nur sporadisch dort, wo zufällig LKWs mit Messgeräten auf der A67 entlanggefahren sind.",
            "Raspberry Shake: Der Oberrheingraben ist seismisch hochsensibel – trotzdem gibt es im Ried fast keinen Bürgersensor.",
            "Fazit: Wenn wir es nicht selbst anpacken, liefert uns niemand diese Daten.",
          ],
          audienceEngagement:
            "Lassen Sie die Folie kurz wirken. Betonen Sie: 'Wir warten nicht auf Berlin oder Wiesbaden – wir lösen das hier vor Ort!'",
          localHook: "Besonders Biblis, Groß-Rohrheim und die Ortsteile von Bürstadt (Bobstadt, Riedrode) haben 0 Sensoren.",
        },
      },
      {
        id: "zwei-saeulen-loesung",
        eyebrow: "Der Masterplan · Zwei Hebel mit maximaler Wirkung",
        title: "Säule 1: Der Ried-Hackathon · Säule 2: Der Bürger-Sensorbau",
        lead: "Wir verknüpfen ein innovatives Wochenend-Event mit nachhaltiger, dauerhaft wachsender Infrastruktur vor Ort.",
        bullets: [
          {
            title: "Hebel A: Der 48h Ried-Hackathon im KAMÜ",
            description: "Bürger, Schüler, Verwaltung & IT-Experten erarbeiten an einem Wochenende lauffähige Software-, Energie- & Umweltlösungen.",
            tag: "Event & Katalysator",
          },
          {
            title: "Hebel B: Citizen Science Sensorbau-Workshops",
            description: "Bürgerinnen, Vereine und Schulen löten standardisierte LoRaWAN-Umweltstationen und installieren sie im Quartier.",
            tag: "Dauerhafte Infrastruktur",
          },
          {
            title: "Zentrale Open Ried Plattform",
            description: "Alle Daten fließen live in das Dashboard und können kostenfrei in kommunale Geoportale eingebunden werden.",
            tag: "Offene Daten",
          },
        ],
        stats: [
          { value: "< 100 €", label: "Materialkosten pro Station", subtext: "Statt 3.000 € Konzernsäulen", color: "emerald" },
          { value: "3 Stunden", label: "Bauzeit im Workshop", subtext: "Gemeinschaftserlebnis für jedes Alter", color: "sky" },
          { value: "0 €", label: "Laufende Mobilfunkkosten", subtext: "Dank freiem 868 MHz LoRaWAN Funk", color: "violet" },
        ],
        speakerNotes: {
          elevatorPitch:
            "Die Kombination aus Hackathon und Sensorbau löst zwei Probleme auf einmal: Wir schaffen handfeste Infrastruktur und begeistern gleichzeitig die Bürger für kommunale Zukunftsthemen.",
          talkingPoints: [
            "Der Hackathon erzeugt Medienwirksamkeit, Innovationsgeist und bringt junge Talente mit der Verwaltung zusammen.",
            "Die Sensoren schaffen reale Messwerte, die der Bauhof, das Umweltamt und der Katastrophenschutz direkt nutzen können.",
            "Keine monatlichen SIM-Karten-Gebühren: 1 Gateway auf dem Rathausdach versorgt bis zu 10 Kilometer Umkreis!",
          ],
          audienceEngagement:
            "Vergleichen Sie: 'Für den Preis eines einzigen Beratertags eines Großunternehmens können wir 20 Schulen mit Sensoren ausstatten!'",
          localHook: "Standorte: KAMÜ Bürstadt, Altes Rathaus, Feuerwehrhäuser in Bürstadt & Bobstadt.",
        },
      },
      {
        id: "kommunaler-nutzen",
        eyebrow: "Mehrwert für Ämter & Bürger · Faktenbasierte Politik",
        title: "Konkrete Mehrwerte für Verwaltung, Bauhof und Stadtentwicklung",
        lead: "Messdaten sind kein Selbstzweck – sie helfen der Politik, fundierte und rechtssichere Entscheidungen zu treffen.",
        bullets: [
          {
            title: "Hitze- & Stadtklima-Monitoring",
            description: "Objektive Identifikation von Hitzeinseln für gezielte Baumpflanzungen und Begrünungsmaßnahmen.",
            tag: "Klimaanpassung",
          },
          {
            title: "Grundwasser- & Trockenheitsampel",
            description: "Echtzeitwerte zur Bodenfeuchte schützen kommunale Grünflächen, Bäume und senken Bewässerungskosten.",
            tag: "Ressourcenschonung",
          },
          {
            title: "Katastrophenschutz & Starkregen-Frühwarnung",
            description: "Pegel- und Niederschlagsmonitoring warnt Rettungskräfte und Bürger frühzeitig bei Unwettern.",
            tag: "Sicherheit",
          },
          {
            title: "Vorreiterrolle für den Kreis Bergstraße",
            description: "Bürstadt positioniert sich als Innovationsstandort und leuchtendes Vorbild im Hessischen Ried.",
            tag: "Standortmarketing",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Diese Daten unterstützen direkt Ihre tägliche Verwaltungsarbeit: Von der zielgerichteten Bewässerung des Stadtgrüns bis zur transparenten Bürgerkommunikation bei Hitzeaktionsplänen.",
          talkingPoints: [
            "Der Kreis Bergstraße fördert Smart-Region-Initiativen – unser Projekt passt haargenau in die Förderkriterien.",
            "Bürger fühlen sich ernst genommen, weil sie die Umweltdaten vor ihrer eigenen Haustür selbst im Internet abrufen können.",
            "Volle DSGVO-Konformität: Keine personenbezogenen Daten, reine Umwelttelemetrie.",
          ],
          audienceEngagement:
            "Erinnern Sie an die vergangenen heißen Sommer im Ried und die Grundwasserdiskussionen mit Hessenwasser.",
          localHook: "Wasserampel Bürstadt/Lampertheim und Schutz des Riedwaldes.",
        },
      },
      {
        id: "call-to-action-politik",
        eyebrow: "Nächste Schritte · Konkrete Unterstützung",
        title: "Unser Angebot & Bitte an die Kommunalpolitik",
        lead: "Mit minimalem Aufwand kann die Stadt Bürstadt und der Kreis Bergstraße den Startschuss geben.",
        bullets: [
          {
            title: "1. Dachstandorte für LoRaWAN-Gateways",
            description: "Bereitstellung von 1–2 Antennenstandorten (z.B. Rathausdach, Feuerwehrhaus, Wasserturm).",
            tag: "Infrastruktur",
          },
          {
            title: "2. Schirmherrschaft für den Ried-Hackathon",
            description: "Übernahme der Schirmherrschaft durch die Bürgermeisterin / den Bürgermeister oder Landrat.",
            tag: "Repräsentation",
          },
          {
            title: "3. Anschub-Förderung für Schulbausätze",
            description: "Kleines Budget (z.B. 2.500 €) für 25 Sensor-Kits für die örtlichen Schulen und Bürger.",
            tag: "Jugendförderung",
          },
        ],
        callToAction: {
          primaryText: "Gemeinsames Gespräch vereinbaren",
          primaryHref: "mailto:info@open-ried.de?subject=Pitch%20Kommunalpolitik%20Open%20Ried%20Sens",
          secondaryText: "Sensor-Bauanleitung ansehen",
          secondaryHref: "/sensor-bauen",
        },
        speakerNotes: {
          elevatorPitch:
            "Wir verlangen keine Millionen. Mit einem Gateway-Standort auf dem Rathaus und Ihrer Schirmherrschaft rollen wir die Infrastruktur in wenigen Wochen aus.",
          talkingPoints: [
            "Die LoRaWAN-Gateways verbrauchen unter 10 Watt Strom – vernachlässigbar.",
            "Mit der Schirmherrschaft setzen Sie ein klares politisches Signal für junge MINT-Talente und Bürgerwissenschaft.",
            "Schlagen Sie einen gemeinsamen Vor-Ort-Termin im Kulturzentrum KAMÜ vor.",
          ],
          audienceEngagement: "Geben Sie dem Bürgermeister oder den Fraktionsvorsitzenden das Wort für Rückfragen.",
          localHook: "Kulturzentrum KAMÜ in Bürstadt als offener Treffpunkt.",
        },
      },
    ],
  },
  {
    slug: "schulen",
    title: "MINT zum Anfassen: Klimaforschung im Klassenzimmer",
    subtitle:
      "Vom Lötkolben bis zum eigenen Dashboard: Wie Schülerinnen und Schüler das Hessische Ried vermessen",
    targetAudience: "Schulleitungen, Fachbereichsleiter MINT, Physik-, Informatik- & Geografie-Lehrkräfte",
    category: "bildung",
    badge: "Schulen & MINT-Bildung",
    accentColor: "sky",
    estimatedMinutes: 10,
    summary:
      "Präsentation für Schulen und Gymnasien: Schüler bauen echte LoRaWAN-Multisensor-Stationen, lernen Elektronik, Programmierung und physikalische Klimaphänomene an echten Daten.",
    slides: [
      {
        id: "schulen-vision",
        eyebrow: "Zukunftskompetenzen · MINT & Bildung",
        title: "Praxisorientierte MINT-Bildung statt trockener Theorie",
        lead: "Mit dem Open Ried Sens Schulprogramm bauen Schülerinnen und Schüler ihre eigene vernetzte Wetter- und Klimastation und sehen ihre Messdaten live auf der Weltkarte.",
        bullets: [
          {
            title: "Handwerk & Elektronik begreifen",
            description: "Echtes Löten, I²C-Bus-Leitungen verbinden, Sensoren für CO2, Feinstaub und Temperatur verstehen.",
            tag: "Lernfeld Technik",
          },
          {
            title: "Informatik mit echtem Alltagsbezug",
            description: "Mikrocontroller-Programmierung (RAK3113), Funkprotokolle (LoRaWAN) und REST-APIs im Unterricht anwenden.",
            tag: "Informatik",
          },
          {
            title: "Klimawandel vor der Schultür erforschen",
            description: "Warum ist das Klassenzimmer stickig? Warum ist der Schulhof 8 Grad heißer als die Wiese? Schüler forschen selbst.",
            tag: "Umwelt & Physik",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Liebe Lehrkräfte, wir bieten Ihren Schülerinnen und Schülern ein Projekt, das sie nie vergessen werden: Sie bauen ein echtes Hightech-Gerät, das funkt, misst und online live zu sehen ist.",
          talkingPoints: [
            "Ideal für Projektwochen, MINT-AGs oder als fächerübergreifendes Modul in Physik, Informatik und Geografie.",
            "Alle Baupläne, Stücklisten (BOM) und didaktischen Leitfäden sind auf Open Ried Sens frei verfügbar.",
            "Schüler erhalten einen direkten Bezug zu ihrem Heimatort Bürstadt und dem Ried.",
          ],
          audienceEngagement:
            "Frage an die Lehrer: Wie schwer ist es heute, Schüler für Physik oder Informatik mit Standard-Lehrbüchern zu begeistern?",
          localHook: "Erich Kästner-Schule Bürstadt, Karl-Kübel-Schule Bensheim, Lessing-Gymnasium Lampertheim.",
        },
      },
      {
        id: "schulen-blindspot",
        eyebrow: "Die Schüler-Mission · Citizen Science",
        title: "Unsere Mission: Schüler schließen den blinden Fleck auf den Weltkarten",
        lead: "Wenn Schüler auf die weltweiten Umweltkarten schauen, sehen sie: Das Hessische Ried fehlt. Sie können die Ersten sein, die das ändern!",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Hier ist der Motivationskick für Jugendliche: 'Seht ihr diese weiße Fläche auf der Weltkarte? Das ist eure Heimatstadt. Wir bauen jetzt die Station, die diesen Fleck tilgt!'",
          talkingPoints: [
            "Sensor.Community und TTN Mapper sind globale Plattformen – Schüler publizieren echte wissenschaftliche Daten.",
            "Das stärkt das Selbstwirksamkeitsgefühl junger Menschen enorm.",
            "Teilnahme am Jugend-forscht-Wettbewerb oder schulischen Innovationspreisen möglich.",
          ],
          audienceEngagement: "Zeigen Sie den Schülern oder Lehrern, wie die Daten in Echtzeit im Web gerendert werden.",
          localHook: "Messungen direkt am Schulhof oder Schulgarten in Bürstadt.",
        },
      },
      {
        id: "schulen-konzept",
        eyebrow: "Der Bauplan · Für den Unterricht optimiert",
        title: "Der 3-Stunden-Bausatz: Sicher, modular & bezahlbar",
        lead: "Entwickelt für den Einsatz in Schulen – mit modernsten industriellen Sensoren und sicherem Niedervolt-Betrieb (3,3V / USB-C).",
        stats: [
          { value: "3,3 V", label: "Schutzkleinspannung", subtext: "Absolut gefahrloses Arbeiten", color: "emerald" },
          { value: "5 Sensoren", label: "Auf einem Bus vereint", subtext: "Temp, Feuchte, CO2, Feinstaub, VOC", color: "sky" },
          { value: "100 %", label: "Open Source Code", subtext: "Leicht anpassbar in Arduino IDE", color: "violet" },
        ],
        bullets: [
          {
            title: "Modul 1: Elektronik & Löten (60 Min)",
            description: "Platine mit RAK3113, Sensirion SCD41 (CO2) und SPS30 (Feinstaub) sauber verlöten.",
          },
          {
            title: "Modul 2: Firmware & Funk (45 Min)",
            description: "Firmware flashen, The Things Network Schlüssel eingeben und erste Live-Telemetrie prüfen.",
          },
          {
            title: "Modul 3: Montage & Gehäuse (45 Min)",
            description: "Einbau in das wetterfeste 3D-Druck-Lamellengehäuse (Stevenson Screen) für die Außenmontage.",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Der Bausatz ist so konzipiert, dass auch Schülerinnen und Schüler ohne Vorkenntnisse in 3 Stunden zu einem funktionierenden Ergebnis kommen.",
          talkingPoints: [
            "Kein gefährlicher Netzstrom: Betrieb mit handelsüblichem USB-C oder kleiner Solarzelle.",
            "Industrielle Sensoren (Sensirion Schweiz): Keine Spielzeug-Werte, sondern wissenschaftlich verwertbare Daten.",
            "Wir stellen vorgefertigte Lehrmaterialien und Schritt-für-Schritt-Videoanleitungen bereit.",
          ],
          audienceEngagement: "Bringen Sie einen Muster-Sensor mit und lassen Sie ihn durch die Reihen gehen.",
          localHook: "Workshops können auch direkt im Kulturzentrum KAMÜ in Bürstadt stattfinden.",
        },
      },
      {
        id: "schulen-hackathon",
        eyebrow: "Der Schul-Hackathon · Event-Highlight",
        title: "Großer Ried-Hackathon: Schüler programmieren gegen den Klimawandel",
        lead: "Der Höhepunkt des Schuljahres: Schüler-Teams treten beim Ried-Hackathon im KAMÜ Bürstadt an.",
        bullets: [
          {
            title: "Eigene Schüler-Challenges",
            description: "z.B. 'Bester Hitzewarner für den Pausenhof', 'CO2-Lüftungsampel für den Musiksaal' oder 'Bodenfeuchte-Wächter für Schulbeete'.",
            tag: "Wettbewerb",
          },
          {
            title: "Mentoring durch Tech-Profis",
            description: "Erfahrene Softwareentwickler, Ingenieure und Maker unterstützen die Schüler-Teams auf Augenhöhe.",
            tag: "Mentoring",
          },
          {
            title: "Attraktive Sachpreise & Zertifikate",
            description: "Wertvolle Referenzen für Bewerbungen, duale Studienplätze und Praktika in der Region.",
            tag: "Karriere-Sprungbrett",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Beim Hackathon erleben Schülerinnen und Schüler, wie faszinierend Teamarbeit in der Praxis ist. Sie sitzen mit echten Entwicklern zusammen und bauen funktionierende Software.",
          talkingPoints: [
            "Hervorragende Zusammenarbeit mit regionalen Ausbildungsbetrieben.",
            "Stärkt das Selbstbewusstsein und fördert Mädchen in MINT-Fächern.",
            "Schulen können als offizielle Partner-Schule im Event auftreten.",
          ],
          audienceEngagement: "Bieten Sie an, vorab eine 45-minütige Schnupperstunde an der Schule zu halten.",
          localHook: "Kulturzentrum KAMÜ als barrierefreier Veranstaltungsort in Bürstadt.",
        },
      },
      {
        id: "call-to-action-schulen",
        eyebrow: "Jetzt starten · Partner-Schule werden",
        title: "Unser Angebot für Ihre Schule",
        lead: "Wir bringen Material, Know-how und Dozenten – Sie bringen neugierige Schülerinnen und Schüler.",
        bullets: [
          {
            title: "Kostenlose Infostunde für Lehrkräfte",
            description: "Wir stellen das Projekt im Kollegium oder der Fachkonferenz vor.",
          },
          {
            title: "Pilot-Workshop buchen",
            description: "Wir führen den ersten Bau-Workshop gemeinsam mit Ihnen an der Schule durch.",
          },
          {
            title: "Eigene Wetterstation für Ihre Schule",
            description: "Ihre Schule wird offizieller Messpunkt auf der Open Ried Sens Karte.",
          },
        ],
        callToAction: {
          primaryText: "Schul-Workshop anfragen",
          primaryHref: "mailto:schulen@open-ried.de?subject=Anfrage%20Schulworkshop%20Open%20Ried%20Sens",
          secondaryText: "Online-Bauanleitung ansehen",
          secondaryHref: "/sensor-bauen",
        },
        speakerNotes: {
          elevatorPitch:
            "Lassen Sie uns gemeinsam den ersten Sensor an Ihrer Schule aufstellen. Wir unterstützen Sie bei jedem Schritt.",
          talkingPoints: [
            "Finanzierung kann oft über Fördervereine oder regionale Stiftungen abgewickelt werden.",
            "Wir stellen fertige Bausätze zusammen, damit Sie keine Einzelteile zusammensuchen müssen.",
          ],
          audienceEngagement: "Geben Sie die Handouts und Kontaktdaten aus.",
          localHook: "Direkter Ansprechpartner vor Ort in Bürstadt.",
        },
      },
    ],
  },
  {
    slug: "vhs",
    title: "Digitale Teilhabe für alle: Bürgerwissenschaft im Ried",
    subtitle:
      "Löten, verstehen und mitforschen von 18 bis 80 Jahren: Citizen Science an der Volkshochschule",
    targetAudience: "Leitungen der Volkshochschulen (VHS Kreis Bergstraße, VHS Lampertheim), Erwachsenenbildner",
    category: "bildung",
    badge: "Erwachsenenbildung & VHS",
    accentColor: "violet",
    estimatedMinutes: 10,
    summary:
      "Präsentation für die Erwachsenenbildung: Niedrigschwellige Kurse für Bürgerinnen und Bürger, Senioren und Neugierige. Verstehen statt Angst vor Digitalisierung.",
    slides: [
      {
        id: "vhs-mission",
        eyebrow: "Lebenslanges Lernen · Bürgerwissenschaft",
        title: "Digitalisierung begreifen: Vom Konsumenten zum mündigen Bürgerforscher",
        lead: "Viele Menschen fühlen sich von KI und Smart-City-Begriffen abgehängt. An der Volkshochschule machen wir Zukunftstechnologie erlebbar und verständlich.",
        bullets: [
          {
            title: "Niedrigschwellig ohne Vorwissen",
            description: "Jeder kann löten und Sensoren verbinden – Schritt für Schritt mit geduldiger Anleitung.",
            tag: "Für alle Generationen",
          },
          {
            title: "Fakten statt Stammtischparolen",
            description: "Wie sauber ist die Luft in Bürstadt wirklich? Wann steigt die Ozonbelastung? Eigene Messungen schaffen Klarheit.",
            tag: "Aufklärung",
          },
          {
            title: "Gemeinschaft im Quartier",
            description: "Gemeinsam tüfteln, Erfahrungen austauschen und die eigene Heimat mitgestalten.",
            tag: "Sozialer Zusammenhalt",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Sehr geehrte Damen und Herren der Volkshochschule, wir bieten einen Kurs, der Menschen die Berührungsangst vor Technik nimmt und sie zu aktiven Bürgerforschern ihrer Region macht.",
          talkingPoints: [
            "Die Volkshochschulen haben den öffentlichen Auftrag zur Förderung der digitalen Souveränität.",
            "Unser Format verbindet handwerkliches Werken (Löten) mit digitaler Bildung (Dashboards).",
            "Besonders beliebt auch bei Seniorinnen und Senioren, die ihren Enkeln zeigen wollen, was möglich ist.",
          ],
          audienceEngagement:
            "Frage: Wie viele Ihrer Kursteilnehmer fragen nach praktischer digitaler Anwendung statt reiner Software-Bedienung?",
          localHook: "Kurse im Kulturzentrum KAMÜ Bürstadt oder direkt in den VHS-Räumen.",
        },
      },
      {
        id: "vhs-blindspot",
        eyebrow: "Bürgerauftrag · Citizen Science",
        title: "Bürger füllen die Lücken, die Konzerne und Behörden offenlassen",
        lead: "Offizielle staatliche Messstellen stehen oft nur alle 30 km. Citizen-Science-Plattformen zeigen: Das Ried braucht bürgerschaftliches Engagement.",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Die staatlichen Messstationen des Umweltbundesamts stehen in Darmstadt oder Mannheim. Wie es in Bürstadt oder Lampertheim aussieht, erfährt man dort nicht.",
          talkingPoints: [
            "Bürgerforschung (Citizen Science) schließt genau diese Lücke.",
            "Die Kursteilnehmer werden Teil einer weltweiten Gemeinschaft von Menschen, die ihre Daten teilen.",
            "Wichtig: Wir schulen auch den kritischen Umgang mit Sensordaten (Messtoleranzen, Kalibrierung).",
          ],
          audienceEngagement: "Erläutern Sie, wie Teilnehmer stolz ihre eigene Station auf der Karte herzeigen.",
          localHook: "Keine offizielle PM2.5-Messstation des Landes Hessen im Riedkern!",
        },
      },
      {
        id: "vhs-kursformat",
        eyebrow: "Das VHS-Kurskonzept · 3 Termine oder Wochenend-Kompakt",
        title: "Das praxiserprobte Kursformat: 'Mein eigener Umweltsensor'",
        lead: "Didaktisch strukturiert in drei leicht verständliche Module – perfekt für das Semesterprogramm.",
        bullets: [
          {
            title: "Teil 1: Umwelt, Luft & Sensorik verstehen",
            description: "Was misst ein Feinstaub- oder CO2-Sensor? Wie funktioniert das strahlungsfreie LoRaWAN-Funknetz?",
          },
          {
            title: "Teil 2: Der Praxistag: Löten & Zusammenbau",
            description: "Gemeinsam im Werkraum die Platine löten, Sensoren montieren und das 3D-Druck-Gehäuse wetterfest abdichten.",
          },
          {
            title: "Teil 3: Das eigene Dashboard & Datenanalyse",
            description: "Die Station am Balkon oder im Garten anbringen und Messwerte am Smartphone oder Tablet verfolgen.",
          },
        ],
        stats: [
          { value: "10–12", label: "Teilnehmer pro Kurs", subtext: "Optimale Betreuungsquote", color: "emerald" },
          { value: "1 Bausatz", label: "Zum Mitnehmen", subtext: "Bleibt dauerhaft beim Teilnehmer", color: "sky" },
          { value: "0 € Abo", label: "Keine Folgekosten", subtext: "Dauerhaft freie Datennutzung", color: "violet" },
        ],
        speakerNotes: {
          elevatorPitch:
            "Das Kursformat ist schlüsselfertig vorbereitet: Stückliste, Foliensatz, Dozentenleitfaden und Begleitunterlagen stehen bereit.",
          talkingPoints: [
            "Teilnehmergebühr deckt den Materialbausatz und die VHS-Kursgebühr.",
            "Keine Vorkenntnisse nötig – wir fangen bei der Bedienung des Lötkolbens an.",
            "Als Dozenten stehen ehrenamtliche Experten aus dem Bürstädter Maker-Netzwerk bereit.",
          ],
          audienceEngagement: "Fragen Sie nach dem Redaktionsschluss des nächsten VHS-Programmkatalogs.",
          localHook: "Kooperation mit VHS Bergstraße und regionalen Seniorenbeiräten.",
        },
      },
      {
        id: "call-to-action-vhs",
        eyebrow: "Gemeinsam ins Programm · Nächste Schritte",
        title: "Aufnahme ins kommende VHS-Semesterprogramm",
        lead: "Lassen Sie uns den Kurs im nächsten Programmheft als Highlight im Fachbereich 'Mensch & Umwelt / Digitale Welten' platzieren.",
        bullets: [
          {
            title: "Schlüsselfertiger Kurstext",
            description: "Wir liefern Titel, Beschreibungstext und Materialangaben druckfertig für Ihren Katalog.",
          },
          {
            title: "Dozenten & Werkzeuge gestellt",
            description: "Lötstationen, Messgeräte und Werkzeuge bringen wir auf Wunsch komplett mit.",
          },
          {
            title: "Kombination mit Ried-Hackathon",
            description: "Kursteilnehmer können optional ihr Projekt beim Ried-Hackathon im KAMÜ vorstellen.",
          },
        ],
        callToAction: {
          primaryText: "VHS-Kurskonzept anfordern",
          primaryHref: "mailto:vhs@open-ried.de?subject=Anfrage%20VHS%20Kurs%20Open%20Ried%20Sens",
          secondaryText: "Online-Bauanleitung ansehen",
          secondaryHref: "/sensor-bauen",
        },
        speakerNotes: {
          elevatorPitch:
            "Wir nehmen Ihnen die gesamte Arbeit ab: Text, Dozent und Material kommen von uns, Sie stellen den Raum und die Ausschreibung.",
          talkingPoints: [
            "Erfahrungsgemäß sind solche Maker-Kurse extrem schnell ausgebucht.",
            "Wir bieten auch gerne einen Schnupper-Abend für Interessierte an.",
          ],
          audienceEngagement: "Überreichen Sie den fertigen Programmtext-Entwurf.",
          localHook: "Bürstadt Kulturzentrum KAMÜ als barrierefreier Kursort.",
        },
      },
    ],
  },
  {
    slug: "community",
    title: "Open Source LoRaWAN: Wir bauen das freie Ried-Netzwerk",
    subtitle:
      "Für Nerds, Maker, Freifunker, Funkamateure & Vereine: Hacking, Open Hardware & The Things Network",
    targetAudience: "Hacker, Maker, Freifunk, Chaos Computer Club, DARC Funkamateure, Vereine & Initiativen",
    category: "community",
    badge: "Tech Community & Maker",
    accentColor: "teal",
    estimatedMinutes: 10,
    summary:
      "Präsentation für Tech-Enthusiasten und Vereine: Echte Open Hardware, RAK3113 LoRaWAN Node, dezentrale Mesh-Gateways, offene APIs und der 48h Ried-Hackathon im Kulturzentrum KAMÜ.",
    slides: [
      {
        id: "community-intro",
        eyebrow: "Root für alle · Open Hardware & Free Network",
        title: "Freie Frequenzen, freie Daten: Holen wir uns die Infrastruktur zurück!",
        lead: "Genug von proprietären IoT-Silos, Cloud-Zwängen und teuren Mobilfunk-Verträgen. Wir bauen das offene LoRaWAN-Rückgrat für das gesamte Hessische Ried.",
        bullets: [
          {
            title: "100 % Open Hardware & Firmware",
            description: "RAK3113 (RP2040 / Nordic) Architektur, Sensirion I²C Sensoren, transparente Arduino & PlatformIO Quellcodes.",
            tag: "Keine Black Box",
          },
          {
            title: "The Things Network (TTN) & MQTT",
            description: "Dezentrales LoRaWAN, End-to-End verschlüsselt, direkte MQTT/REST Stream-Integration in Next.js & TimescaleDB.",
            tag: "Open Data Stack",
          },
          {
            title: "KAMÜ Bürstadt als Hacker-HQ",
            description: "Das Kulturzentrum KAMÜ wird zum Treffpunkt für Lötabende, Antennen-Messungen und Open-Source-Hacking.",
            tag: "Community Hub",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Moin Nerds und Maker! Die Welt redet über Smart Cities, aber das Ried ist auf allen Karten ein blinder Fleck. Lasst uns nicht meckern, sondern löten und flashen!",
          talkingPoints: [
            "Hier gibt es keine Vendor Lock-ins: Schaltpläne, Gerber-Dateien für KiCad und STL für 3D-Druck sind offen.",
            "Wir nutzen offene 868 MHz LoRaWAN-Frequenzen nach EU868 Standard.",
            "Jeder kann mitbauen: Von der Antennen-Optimierung bis zur Firmware-Entwicklung.",
          ],
          audienceEngagement: "Frage: Wer von euch hat schonmal ein TTN Gateway betrieben oder mit ESP32/LoRa gearbeitet?",
          localHook: "Kulturzentrum KAMÜ in Bürstadt – Platz für Lötplätze, 3D-Drucker und Serverracks.",
        },
      },
      {
        id: "community-blindspot",
        eyebrow: "Der Benchmark · Was uns die Heatmaps sagen",
        title: "Unser Feindbild: Weiße Flecken auf TTN Mapper & Sensor.Community",
        lead: "Schaut euch das an: Zwischen Mannheim und Darmstadt ist fast Niemandsland. Das ist kein Zustand, das ist eine persönliche Herausforderung!",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Auf TTN Mapper sieht man genau drei blaue Striche, wo mal einer mit dem LoRa-Node im Auto über die B47 gefahren ist. Im Ortskern Bürstadt? Null Empfang. Das ändern wir!",
          talkingPoints: [
            "Raspberry Shake: 1 Station im Umkreis von 25 km – bei bekannter Seismik im Rheingraben ein Witz.",
            "Sensor.Community: Die Feinstaub-Karte bricht an der hessisch-rheinland-pfälzischen Grenze einfach ab.",
            "Ziel: Mindestens 10 aktive Gateways und 50 Sensor-Nodes bis Ende des Jahres im Ried!",
          ],
          audienceEngagement: "Wer hat ein hohes Dach oder eine Scheune mit Sichtkontakt für ein Outdoor-Gateway?",
          localHook: "Ideal: Wasserturm Bürstadt, Kirchtürme, KAMÜ-Dach, Bobstadt.",
        },
      },
      {
        id: "community-hackathon",
        eyebrow: "Das Event · 48 Stunden Vollgas",
        title: "Der Ried-Hackathon im KAMÜ Bürstadt: Code, Solder & Club-Mate",
        lead: "Ein ganzes Wochenende im Kulturzentrum KAMÜ: Hardware-Hacker, Software-Devs und Vereine bauen an echten Lösungen.",
        bullets: [
          {
            title: "Track 1: LoRaWAN & Mesh-Netzwerke",
            description: "Gateways aufbauen, Reichweitentests mit TTN Mapper, Meshtastic-Relays für Notfunk im Ried.",
            tag: "Funktechnik",
          },
          {
            title: "Track 2: Umweltdaten & Visualisierung",
            description: "Karten-Layer, Hitze-Heatmaps, Grundwasser-Trends und Alerting-Bots via Telegram & Matrix.",
            tag: "Frontend & Data Science",
          },
          {
            title: "Track 3: Sensor-Erweiterungen & 3D-Druck",
            description: "Pegelmesser für Bäche (Weschnitz), Bodenfeuchte-Sonden für Landwirte, mobile Sensoren auf Fahrrädern.",
            tag: "Hardware Hacks",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Der Hackathon wird das Event für die regionale Tech-Szene. 48 Stunden freies WLAN, Pizza, Club-Mate und Hardware satt.",
          talkingPoints: [
            "Wir kooperieren mit Freifunk, lokalen Linux-User-Groups und Hochschulen (Darmstadt, Mannheim, Worms).",
            "Keine Marketing-Show: Am Ende des Wochenendes müssen funktionierende Prototypen auf dem Tisch stehen.",
            "Offene Repositories auf GitHub / GitLab unter MIT / GPLv3.",
          ],
          audienceEngagement: "Welche Tracks sprechen euch am meisten an? Ruft mal rein!",
          localHook: "KAMÜ Bürstadt bietet ideale Räumlichkeiten, Catering-Küche und beste Netzwerkanbindung.",
        },
      },
      {
        id: "call-to-action-community",
        eyebrow: "Mitmachen · Jetzt ins Team einsteigen",
        title: "Wie du sofort loslegen kannst",
        lead: "Ob du löten kannst, Python schreibst, Antennen misst oder Gehäuse druckst – wir brauchen deinen Skill!",
        bullets: [
          {
            title: "Werde Gateway-Host",
            description: "Stelle ein Outdoor-LoRaWAN-Gateway auf dein Dach. Wir stellen vorkonfigurierte Hardware bereit.",
          },
          {
            title: "Baue deinen eigenen Sensor",
            description: "Hol dir die Stückliste (BOM), 3D-Druckdateien und Firmware direkt auf /sensor-bauen.",
          },
          {
            title: "Komm zum nächsten Maker-Treff im KAMÜ",
            description: "Jeden Monat offener Hackspace & Lötabend für alle Interessierten.",
          },
        ],
        callToAction: {
          primaryText: "Zur Sensor-Bauanleitung & BOM",
          primaryHref: "/sensor-bauen",
          secondaryText: "Dem Entwickler-Team beitreten",
          secondaryHref: "mailto:hackathon@open-ried.de?subject=Maker%20Community%20Open%20Ried%20Sens",
        },
        speakerNotes: {
          elevatorPitch:
            "Die Hardware liegt bereit, der Code ist online. Schaut auf /sensor-bauen vorbei und baut euch eure Station.",
          talkingPoints: [
            "GitHub-Repo ist öffentlich verlinkt.",
            "Kommt beim nächsten Treffen im KAMÜ vorbei, bringt eure Projekte mit.",
          ],
          audienceEngagement: "Teilt den Link in euren Signal- und Discord-Gruppen!",
          localHook: "Treffpunkt Kulturzentrum KAMÜ in Bürstadt.",
        },
      },
    ],
  },
  {
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
      "Präsentation für Sponsoren und Wirtschaftspartner: Sichtbarkeit bei jungen Tech-Talenten, CSR-Nachhaltigkeitsprojekt und Co-Innovation bei Energie-, Hallenklima- und Mobilitätsdaten.",
    slides: [
      {
        id: "wirtschaft-roi",
        eyebrow: "Regionale Wertschöpfung · CSR & Fachkräfte",
        title: "Investieren in die Fachkräfte von morgen und ein klimaresilientes Ried",
        lead: "Statt austauschbarer Bandenwerbung investieren Sie in handfeste MINT-Bildung, Open-Source-Infrastruktur und Innovationskultur im Ried.",
        bullets: [
          {
            title: "Direkter Zugang zu Nachwuchstalenten",
            description: "Lernen Sie beim Ried-Hackathon motivierte Entwickler, Mechatroniker und Informatik-Schüler persönlich kennen.",
            tag: "Recruiting & Fachkräfte",
          },
          {
            title: "Echte Nachhaltigkeit (CSR)",
            description: "Finanzieren Sie Sensorbausätze für Schulklassen und tragen Sie messbar zur regionalen Klimafolgenforschung bei.",
            tag: "Nachhaltigkeitsbericht",
          },
          {
            title: "Infrastruktur für Ihr Unternehmen",
            description: "Nutzen Sie das freie LoRaWAN-Netz für eigene Zählerfernauslesung, Hallentemperatur- oder Logistik-Überwachung.",
            tag: "Smarte Industrie",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Sehr geehrte Unternehmerinnen und Unternehmer, der Fachkräftemangel betrifft uns alle. Mit diesem Projekt zeigen wir jungen Menschen, dass innovative Zukunftstechnologie direkt hier vor ihrer Haustür im Ried stattfindet.",
          talkingPoints: [
            "Ausbildungssuchende und Studierende suchen heute Sinnhaftigkeit und moderne Technologien.",
            "Ihr Unternehmenslogo erscheint auf dem Hackathon, den Schulbausätzen und dem offiziellen Dashboard.",
            "Möglichkeit, eigene Aufgabenstellungen ('Challenges') in den Hackathon einzubringen.",
          ],
          audienceEngagement:
            "Frage: Wie viel Budget geben Sie jährlich für Stellenanzeigen aus, auf die sich niemand meldet?",
          localHook: "Standort Bergstraße / Metropolregion Rhein-Neckar.",
        },
      },
      {
        id: "wirtschaft-blindspot",
        eyebrow: "Datenbasis für den Wirtschaftsstandort · Die Lücke",
        title: "Ohne lokale Daten keine fundierten Klimaschutzentscheidungen",
        lead: "Hitzeperioden und Extremwetter belasten Arbeitsplätze, Hallen und Lieferketten. Die weltweiten Karten zeigen: Das Ried hat keine verlässlichen Mikroklimadaten.",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Gewerbegebiete sind oft massive Hitzeinseln. Mit unserem offenen Sensornetz erfassen Unternehmen und Stadtwerke diese Werte objektiv.",
          talkingPoints: [
            "Stadtwerke können das Netz zur Zählerablesung (Smart Metering) über LoRaWAN nutzen.",
            "Gewerbebetriebe können Temperatur- und Feuchtigkeitsverläufe in Lagern und Außenbereichen überwachen.",
          ],
          audienceEngagement: "Erwähnen Sie konkrete Gewerbegebiete in Bürstadt und Lampertheim.",
          localHook: "Gewerbegebiet Bürstadt-Ost und Bobstadt.",
        },
      },
      {
        id: "wirtschaft-pakete",
        eyebrow: "Partnerschaftsmodelle · Klare Wirkung",
        title: "Attraktive Sponsoring- & Förderpakete",
        lead: "Transparent kalkuliert – jeder Euro fließt direkt in Hardware für Jugendliche und die Hackathon-Ausrichtung.",
        bullets: [
          {
            title: "Sensor-Schulpate (1.000 €)",
            description: "Finanziert 10 komplette Multisensor-Bausätze für eine Schulklasse inkl. Firmenlogo als Schulsponsor.",
            tag: "Schulpate",
          },
          {
            title: "Hackathon Track-Sponsor (2.500 €)",
            description: "Namensgeber für einen Hackathon-Wettbewerb (z.B. 'Green Energy Challenge') inkl. Jurysitz und Recruiting-Stand.",
            tag: "Track Sponsor",
          },
          {
            title: "Hauptpartner der Plattform (5.000 €)",
            description: "Dauerhafte Platzierung als Förderer auf der Open-Ried-Sens-Plattform und allen Medienveröffentlichungen.",
            tag: "Premium Partner",
          },
        ],
        callToAction: {
          primaryText: "Sponsoring-Gespräch vereinbaren",
          primaryHref: "mailto:partner@open-ried.de?subject=Sponsoring%20Open%20Ried%20Sens",
          secondaryText: "Projekt-Details ansehen",
          secondaryHref: "/sensor-bauen",
        },
        speakerNotes: {
          elevatorPitch:
            "Mit 1.000 Euro ermöglichen Sie 10 Jugendlichen einen kompletten Praxis-Workshop und erhalten dafür dauerhafte, sichtbare Präsenz.",
          talkingPoints: [
            "Spenden- oder Sponsoringrechnung kann steuerlich geltend gemacht werden.",
            "Wir bieten maßgeschneiderte Integrationen für Ihre Auszubildenden an.",
          ],
          audienceEngagement: "Bieten Sie ein persönliches Kennenlernen der Projektleiter an.",
          localHook: "Präsentation im Kulturzentrum KAMÜ.",
        },
      },
    ],
  },
  {
    slug: "landwirtschaft",
    title: "Dürre, Grundwasser & Bodenfeuchte: Daten für die Ried-Landwirtschaft",
    subtitle:
      "Präzisionslandwirtschaft mit LoRaWAN: Bodenfeuchte in mehreren Tiefen, Blattnässe & Frostwarnung",
    targetAudience: "Landwirte, Gemüsebauer, Wasser- und Beregnungsverbände, Winzer im Ried",
    category: "umwelt",
    badge: "Landwirtschaft & Wasser",
    accentColor: "emerald",
    estimatedMinutes: 10,
    summary:
      "Präsentation für Landwirte und Wasserwirtschaft: LoRaWAN auf dem Acker ohne Mobilfunkgebühren, Bodenfeuchte-Monitoring gegen Dürre und optimierte Beregnung im Hessischen Ried.",
    slides: [
      {
        id: "landwirtschaft-intro",
        eyebrow: "Wasser ist Zukunft · Präzision auf dem Acker",
        title: "Intelligentes Wassermanagement im Gemüsegarten Hessens",
        lead: "Das Hessische Ried steht vor enormen Wasser- und Bodenspannungen. Mit autarken LoRaWAN-Boden- und Mikroklimasensoren messen Landwirte exakt, wann Beregnung nötig ist.",
        bullets: [
          {
            title: "Bodenfeuchte in 20, 40 und 60 cm Tiefe",
            description: "Erkennen Sie genau, ob Wasser an den Wurzeln ankommt oder im Sandboden versickert.",
            tag: "Wasser sparen",
          },
          {
            title: "10 km Reichweite ohne SIM-Karte",
            description: "Ein LoRaWAN-Empfänger auf dem Hof deckt alle Außenlieger-Felder ohne teure Datenverträge ab.",
            tag: "Wirtschaftlich",
          },
          {
            title: "Lokale Frost- & Blattnässe-Warnung",
            description: "Echtzeitwarnung auf das Smartphone bei Spätfrösten für Spargel-, Erdbeer- und Obstanbau.",
            tag: "Ernteschutz",
          },
        ],
        speakerNotes: {
          elevatorPitch:
            "Liebe Landwirtinnen und Landwirte, das Hessische Ried hat die sandigsten Böden und die schärfsten Grundwasservorschriften. Unser Sensorsystem gibt Ihnen die Faktenbasis, um Beregnung exakt und rechtssicher zu steuern.",
          talkingPoints: [
            "Sandböden im Ried halten Wasser extrem schlecht – Standard-Wetterberichte aus Frankfurt oder Mannheim helfen auf dem Feld nicht.",
            "LoRaWAN sendet kilometerweit durch Baumkronen und über Hügel ohne monatliche Mobilfunkkosten.",
            "Die Sensoren laufen bis zu 5 Jahre autark mit einer einzigen Batterie.",
          ],
          audienceEngagement:
            "Frage: Wie oft beregnen Sie auf Verdacht, weil die Bodenfeuchte in 40 cm Tiefe unbekannt ist?",
          localHook: "Beregnungsverband Hessisches Ried, Spargelanbau Bürstadt & Lampertheim.",
        },
      },
      {
        id: "landwirtschaft-blindspot",
        eyebrow: "Funklöcher auf den Feldern · Die Realität",
        title: "Die Ackerflächen im Ried sind von Sensordaten völlig abgeschnitten",
        lead: "Während in Großstädten Sensoren an jeder Laterne hängen, gibt es auf den Agrarflächen im Ried weder Sensor.Community- noch TTN-Abdeckung.",
        mapEvidence: MAP_EVIDENCE_ITEMS,
        speakerNotes: {
          elevatorPitch:
            "Die TTN Mapper Karte zeigt es schonungslos: Auf den Äckern zwischen Bürstadt, Biblis und Lorsch gibt es kein LoRaWAN-Signal. Wenn wir ein Gateway auf einem Silo oder Hof aufstellen, decken wir hunderte Hektar ab.",
          talkingPoints: [
            "Ein einziges Gateway auf einer Hofscheune reicht aus, um 50 Sensoren auf allen Feldern zu empfangen.",
            "Landwirte können die Daten privat halten oder freiwillig für die regionale Grundwasserforschung freigeben.",
          ],
          audienceEngagement: "Wer hat ein Scheunendach oder Silo mit Strom und Internetanschluss?",
          localHook: "Hofstellen in Bürstadt, Bobstadt, Riedrode und Hofheim.",
        },
      },
      {
        id: "landwirtschaft-pilot",
        eyebrow: "Praxistest · Vom Hof zum Sensor",
        title: "Unser Pilotangebot: Kostenlose Teststation auf Ihrem Hof",
        lead: "Gemeinsam mit Ihnen möchten wir ein Testfeld im Ried aufbauen und die Daten beim Ried-Hackathon mit Agrar-Experten optimieren.",
        bullets: [
          {
            title: "Kostenlose Installation einer Wetter- & Bodensonde",
            description: "Wir stellen die Sensorhardware bereit und installieren sie fachgerecht an Ihrem Versuchsfeld.",
          },
          {
            title: "Privates Smartphone-Dashboard",
            description: "Sie erhalten sofortigen Zugriff auf die Live-Bodenfeuchte- und Temperaturkurven.",
          },
          {
            title: "Eigene Hackathon-Challenge 'Smart Farming'",
            description: "Beim Hackathon im KAMÜ entwickeln Programmierer maßgeschneiderte Auswertungen für Ihren Betrieb.",
          },
        ],
        callToAction: {
          primaryText: "Als Testbetrieb bewerben",
          primaryHref: "mailto:agrar@open-ried.de?subject=Testbetrieb%20Landwirtschaft%20Open%20Ried%20Sens",
          secondaryText: "Sensor-Bauanleitung ansehen",
          secondaryHref: "/sensor-bauen",
        },
        speakerNotes: {
          elevatorPitch:
            "Wir suchen zwei engagierte landwirtschaftliche Betriebe im Ried für unser kostenloses Pilotprogramm.",
          talkingPoints: [
            "Keinerlei Verpflichtungen, keine versteckten Kosten.",
            "Sie bestimmen, welche Daten gemessen werden und behalten die volle Kontrolle.",
          ],
          audienceEngagement: "Sprechen Sie gezielt die anwesenden Vertreter der Landwirtschaft an.",
          localHook: "Kulturzentrum KAMÜ in Bürstadt als Treffpunkt.",
        },
      },
    ],
  },
];

export function getPitchDeckBySlug(slug: string): PitchDeck | undefined {
  return PITCH_DECKS.find((deck) => deck.slug === slug);
}
