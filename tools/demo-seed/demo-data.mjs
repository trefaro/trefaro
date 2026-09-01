/**
 * What the demo instance contains.
 *
 * Kept apart from the mechanics so the content can be argued about without
 * touching the code that creates it. Two rules the content follows:
 *
 * - **Everything is obviously fictional.** Names, addresses and organizations are
 *   invented; every mail address is under `example.org`, which cannot receive.
 * - **Every state the application can be in appears at least once.** A published
 *   series and a draft one, an event that is over and one that is ahead, all
 *   three event types, all four field types, a session that is full and one that
 *   is not, a registration in each of its three states. A demo whose data is all
 *   the same shape hides exactly the cases that break.
 *
 * The dates are relative to a reference day so the seed keeps making sense next
 * month: one event in the past, three ahead, one draft.
 */

/** Reference: the seed shifts every date against the day it runs. */
export function timeline(today = new Date()) {
  const day = (offset) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  return {
    pastFrom: day(-79),
    pastTo: day(-78),
    mainFrom: day(47),
    mainMiddle: day(48),
    mainTo: day(49),
    briefing: day(18),
    draft: day(97),
    workshopFrom: day(69),
    workshopTo: day(70),
    /** Registrations are backdated over this many days, for the weekly chart. */
    registrationWindow: 56,
  };
}

export const SERIES = {
  citizens: {
    name: 'Bürgerräte für Europa',
    description:
      'Eine Reihe von Bürgerräten zur europäischen Demokratie: Auftakt, drei ' +
      'Sitzungen, Abschlussveranstaltung. Die Empfehlungen gehen an das ' +
      'Europäische Parlament.',
    websiteUrl: 'https://example.org/buergerraete',
    contactEmail: 'buergerraete@example.org',
    status: 'published',
  },
  workshop: {
    name: 'Demokratie-Werkstatt',
    description:
      'Zweitägige Werkstätten für Aktive in Vereinen und Initiativen: ' +
      'Beteiligungsformate, Moderation, Öffentlichkeitsarbeit.',
    contactEmail: 'werkstatt@example.org',
    status: 'published',
  },
  // A draft series, so the difference between draft and published is visible in
  // the organizer's list and absent from the public start page.
  planned: {
    name: 'Jugendforum 2027',
    description:
      'In Planung: ein Forum für Menschen zwischen 16 und 25. Noch nicht ' +
      'veröffentlicht, deshalb öffentlich nicht zu sehen.',
    status: 'draft',
  },
};

export function events(dates) {
  return {
    // Over: this is the event that shows the follow-up text and the media links,
    // and the follow-up only leaves the server because `ends_at` has passed (F50).
    kickoff: {
      series: 'citizens',
      name: 'Auftaktkonferenz Bürgerräte',
      description:
        'Der Auftakt der Reihe: 120 zufällig ausgewählte Menschen aus zwölf ' +
        'Ländern, zwei Tage in Brüssel, Simultanverdolmetschung in vier Sprachen.',
      eventType: 'onsite',
      startsAt: `${dates.pastFrom}T09:30:00+02:00`,
      endsAt: `${dates.pastTo}T17:00:00+02:00`,
      timezone: 'Europe/Brussels',
      venueName: 'Maison de la Démocratie',
      venueAddress: 'Rue de la Loi 42, 1040 Brüssel, Belgien',
      languages: ['de', 'en', 'fr', 'pl'],
      status: 'published',
      followUpBody:
        'Danke an alle Teilnehmenden. Die Aufzeichnungen der Plenarsitzungen ' +
        'und das Protokoll der Arbeitsgruppen stehen unten. Die nächste ' +
        'Sitzung ist angekündigt — die Einladung geht an alle, die sich hier ' +
        'angemeldet haben.',
    },
    // The one everything hangs off: the form, the programme, the registrations.
    main: {
      series: 'citizens',
      name: 'Bürgerrat Klima — Sitzung 3',
      description:
        'Die dritte Sitzung des Bürgerrats Klima. Vormittags Fachvorträge, ' +
        'nachmittags parallele Arbeitsgruppen, am dritten Tag die Abstimmung ' +
        'über die Empfehlungen. Teilnahme vor Ort oder online.',
      eventType: 'hybrid',
      startsAt: `${dates.mainFrom}T09:00:00+02:00`,
      endsAt: `${dates.mainTo}T16:30:00+02:00`,
      timezone: 'Europe/Berlin',
      venueName: 'Haus der Demokratie',
      venueAddress: 'Greifswalder Straße 4, 10405 Berlin',
      onlineUrl: 'https://meet.example.org/buergerrat-klima-3',
      languages: ['de', 'en'],
      status: 'published',
    },
    briefing: {
      series: 'citizens',
      name: 'Online-Briefing für Delegierte',
      description:
        'Einstündiges Briefing vor der Sitzung: Ablauf, Abstimmungsverfahren, ' +
        'Technik. Aufzeichnung folgt.',
      eventType: 'online',
      startsAt: `${dates.briefing}T18:00:00+02:00`,
      endsAt: `${dates.briefing}T19:00:00+02:00`,
      timezone: 'Europe/Berlin',
      onlineUrl: 'https://meet.example.org/briefing-delegierte',
      languages: ['de'],
      status: 'published',
    },
    // Draft, and without a venue — which is exactly what publishing would refuse
    // (F27), so it also demonstrates why the check exists.
    closing: {
      series: 'citizens',
      name: 'Abschlussveranstaltung mit dem Parlament',
      description:
        'Noch im Entwurf: Ort und Programm stehen nicht fest, deshalb nicht ' +
        'veröffentlicht.',
      eventType: 'onsite',
      startsAt: `${dates.draft}T10:00:00+01:00`,
      endsAt: `${dates.draft}T18:00:00+01:00`,
      timezone: 'Europe/Brussels',
      languages: ['de', 'en'],
    },
    autumn: {
      series: 'workshop',
      name: 'Demokratie-Werkstatt Herbst',
      description:
        'Zwei Tage Praxis: Beteiligungsformate planen, Sitzungen moderieren, ' +
        'Presse ansprechen. Für Aktive aus Vereinen und Initiativen.',
      eventType: 'onsite',
      startsAt: `${dates.workshopFrom}T10:00:00+01:00`,
      endsAt: `${dates.workshopTo}T16:00:00+01:00`,
      timezone: 'Europe/Berlin',
      venueName: 'Volkshochschule Köln',
      venueAddress: 'Cäcilienstraße 35, 50667 Köln',
      languages: ['de'],
      status: 'published',
    },
  };
}

/** All four field types, one of them required, one of them a file (F12, E9). */
export const FORM_FIELDS = [
  {
    label: 'Organisation',
    type: 'text',
    helpText:
      'Verein, Initiative oder Institution — leer lassen, wenn du privat kommst.',
  },
  {
    label: 'Teilnahme',
    type: 'select',
    options: ['Vor Ort in Berlin', 'Online', 'Erst vor Ort, dann online'],
    required: true,
  },
  {
    label: 'Verpflegung',
    type: 'select',
    options: ['Keine Einschränkung', 'Vegetarisch', 'Vegan', 'Glutenfrei'],
  },
  { label: 'Barrierefreier Zugang nötig', type: 'checkbox' },
  {
    label: 'Visa-Dokument',
    type: 'file',
    helpText:
      'Nur nötig, wenn du ein Einladungsschreiben für die Botschaft brauchst.',
    accept: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
];

/**
 * The programme of the main event.
 *
 * Two entries share a slot on purpose: parallel sessions are what a two-track
 * congress is, and the application shows the overlap rather than refusing it
 * (F41). Both carry sign-up and a capacity — one small enough for the seed to
 * fill completely, so "full" is a state you can see.
 */
export function programme(dates) {
  return [
    [
      'mainFrom',
      '09:00',
      '09:30',
      'Ankommen und Registrierung',
      null,
      'Team Bürgerräte',
    ],
    [
      'mainFrom',
      '09:30',
      '10:30',
      'Was bisher geschah',
      'Rückblick auf die ersten beiden Sitzungen und der Stand der Empfehlungen.',
      'Dr. Amina Kowalski',
    ],
    [
      'mainFrom',
      '11:00',
      '12:30',
      'Fachvortrag: Kosten des Nichthandelns',
      'Was Klimaschutz kostet und was er spart, gerechnet für die nächsten zwanzig Jahre.',
      'Prof. Henrik Sandberg',
    ],
    [
      'mainFrom',
      '14:00',
      '16:00',
      'Arbeitsgruppe A: Verkehr',
      'Parallel zu Arbeitsgruppe B. Begrenzte Plätze, Anmeldung nötig.',
      'Moderation: Lea Fischer',
      { registrationEnabled: true, capacity: 12 },
    ],
    [
      'mainFrom',
      '14:00',
      '16:00',
      'Arbeitsgruppe B: Gebäude und Wärme',
      'Parallel zu Arbeitsgruppe A. Begrenzte Plätze, Anmeldung nötig.',
      'Moderation: Tomasz Nowak',
      { registrationEnabled: true, capacity: 4 },
    ],
    [
      'mainMiddle',
      '09:30',
      '11:00',
      'Bericht aus den Arbeitsgruppen',
      null,
      'Alle Moderationen',
    ],
    [
      'mainMiddle',
      '11:30',
      '13:00',
      'Streitgespräch: Tempo oder Akzeptanz?',
      'Zwei Positionen, moderiert, mit Fragen aus dem Plenum und aus dem Chat.',
      'Moderation: Dr. Amina Kowalski',
    ],
    [
      'mainMiddle',
      '14:30',
      '17:00',
      'Formulierungswerkstatt',
      'Die Empfehlungen werden Satz für Satz geschrieben. Kein Vortrag, nur Arbeit.',
      'Team Bürgerräte',
    ],
    [
      'mainTo',
      '09:30',
      '12:00',
      'Abstimmung über die Empfehlungen',
      'Namentliche Abstimmung, Übertragung für Online-Teilnehmende.',
      'Vorsitz',
    ],
    ['mainTo', '13:00', '16:30', 'Übergabe und Ausblick', null, 'Vorsitz'],
  ].map(([key, from, to, title, description, speaker, extra]) => ({
    title,
    description,
    speaker,
    startsAt: `${dates[key]}T${from}:00+02:00`,
    endsAt: `${dates[key]}T${to}:00+02:00`,
    ...(extra ?? {}),
  }));
}

/** The past event needs a programme so a recording can point at a session (F54). */
export function pastProgramme(dates) {
  return [
    ['pastFrom', '09:30', '10:30', 'Eröffnung', 'Generalsekretärin'],
    [
      'pastFrom',
      '11:00',
      '13:00',
      'Plenum: Wie wir arbeiten wollen',
      'Vorsitz',
    ],
    ['pastTo', '10:00', '12:00', 'Plenum: Themen für die Sitzungen', 'Vorsitz'],
  ].map(([key, from, to, title, speaker]) => ({
    title,
    speaker,
    startsAt: `${dates[key]}T${from}:00+02:00`,
    endsAt: `${dates[key]}T${to}:00+02:00`,
  }));
}

/** Linked, never embedded (F51); the kind is the order (F52). */
export const MEDIA_LINKS = {
  // Two of these are attached to a session of the past event, by index.
  kickoff: [
    {
      kind: 'recording',
      title: 'Aufzeichnung: Eröffnung',
      url: 'https://media.example.org/auftakt/eroeffnung',
      session: 0,
    },
    {
      kind: 'recording',
      title: 'Aufzeichnung: Plenum, Tag 2',
      url: 'https://media.example.org/auftakt/plenum-tag-2',
      session: 2,
    },
    {
      kind: 'material',
      title: 'Protokoll der Arbeitsgruppen (PDF)',
      url: 'https://example.org/auftakt/protokoll.pdf',
    },
    {
      kind: 'material',
      title: 'Teilnehmendenliste, anonymisiert',
      url: 'https://example.org/auftakt/teilnehmende.pdf',
    },
  ],
  main: [
    {
      kind: 'stream',
      title: 'Livestream des Plenums',
      url: 'https://media.example.org/klima-3/live',
    },
  ],
};

/**
 * The people who register.
 *
 * Forty rather than the sixty the participant overview was measured at: the
 * public form allows sixty submissions per five minutes per client address, and a
 * seed that spends the whole budget leaves the instance unusable for the next few
 * minutes. Forty is still two pages of the overview and enough shape for the
 * weekly chart. The measurement at two thousand rows lives in the API contract
 * suite, which is where a load figure belongs.
 */
export const PEOPLE = [
  ['Annika', 'Sørensen'],
  ['Bartosz', 'Lewandowski'],
  ['Camille', 'Duvivier'],
  ['Dimitris', 'Papadakis'],
  ['Elif', 'Yıldırım'],
  ['Fabien', 'Rouvier'],
  ['Greta', 'Lindqvist'],
  ['Hannes', 'Baumgartner'],
  ['Ilaria', 'Bellandi'],
  ['Jakub', 'Havelka'],
  ['Katrin', 'Moosbrugger'],
  ['Lars', 'Vestergaard'],
  ['Marta', 'Oliveira'],
  ['Nils', 'Häkkinen'],
  ['Olga', 'Petrenko'],
  ['Pauline', 'Delcourt'],
  ['Quentin', 'Marchand'],
  ['Rania', 'Ben Salah'],
  ['Sofia', 'Kalniņa'],
  ['Tobias', 'Reinhardt'],
  ['Ulrike', 'Stankowski'],
  ['Viktor', 'Novotný'],
  ['Wanda', 'Krzemińska'],
  ['Xavier', 'Puigdemont'],
  ['Yara', 'Haddad'],
  ['Zoltán', 'Kovács'],
  ['Aoife', 'Ní Bhraonáin'],
  ['Bram', 'Vandenberghe'],
  ['Chiara', 'Ferraro'],
  ['Dovydas', 'Petrauskas'],
  ['Emma', 'Lindholm'],
  ['Filip', 'Jovanović'],
  ['Gabriela', 'Munteanu'],
  ['Hugo', 'Salgado'],
  ['Ines', 'Bergström'],
  ['Janne', 'Korhonen'],
  ['Klara', 'Šimková'],
  ['Luca', 'Moretti'],
  ['Maja', 'Zupančič'],
  ['Nadia', 'El Amrani'],
];

export const ORGANIZATIONS = [
  null,
  'Initiative Klimadialog',
  'Bürgernetz Süd',
  null,
  'Verein für offene Politik',
  'Jugendrat Europa',
  null,
  'Klimabeirat Nord',
  'Forum Beteiligung',
  null,
];
export const ORIGINS = [
  null,
  'Newsletter',
  'Empfehlung einer Freundin',
  'Website',
  null,
  'Veranstaltung im Frühjahr',
  'Presse',
  null,
];

export const INVITATION = {
  subject: 'Sitzung 3 des Bürgerrats Klima — du bist eingeladen',
  body:
    'Hallo,\n\n' +
    'der Bürgerrat Klima trifft sich zum dritten Mal, und weil du beim Auftakt ' +
    'dabei warst, laden wir dich wieder ein.\n\n' +
    'Drei Tage in Berlin oder online, mit der Abstimmung über die Empfehlungen ' +
    'am letzten Tag. Die Anmeldung läuft über die Veranstaltungsseite.\n\n' +
    'Herzliche Grüße\nTeam Bürgerräte',
};

/** `Anna Müller` → `anna.mueller@example.org`, and never a real address. */
export function addressFor(firstName, lastName) {
  const local = `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z.]/g, '');
  return `${local}@example.org`;
}

/**
 * What the demo organization calls itself and looks like (FR 1.4, phase 2).
 *
 * The seed sets this because a whitelabel application whose demo says "Trefaro"
 * in the header, in the tab, in every mail and on a home screen demonstrates the
 * opposite of what it is for (F60). Fictional like everything else here.
 *
 * The two colours are the pair the design page's own contrast rule is happiest
 * with (F67): a primary dark enough to carry white text and to stand out against
 * the white page, an accent that is only ever used inside something.
 */
export const BRANDING = {
  organizationName: 'Demokratie Initiative e.V.',
  primaryColor: '#1d4e6f',
  accentColor: '#e8a33d',
  fontFamily: 'source-sans-3',
};

/**
 * The instance logo: letterhead format, transparent, so it sits in a header.
 *
 * Drawn rather than committed (see `demoPng`). A ring and three bars — enough to
 * be recognizably a mark and obviously not a real organization's.
 */
/**
 * A logo for one series and one event (FR 2.1, FR 3.1).
 *
 * Only one of each on purpose. A row logo is the exception — most series and
 * events carry the organization's mark from the header — and a demo instance in
 * which *every* row has its own picture would show a feature working while
 * hiding what it is for. Deliberately unlike the organization logo, so the two
 * are distinguishable on the start page at a glance.
 */
export const SERIES_LOGO = {
  width: 320,
  height: 120,
  paint: (x, y) => {
    const accent = hexToRgb(BRANDING.accentColor);
    const primary = hexToRgb(BRANDING.primaryColor);

    // A ring of twelve dots — a nod to the European stars, since the series is
    // about European democracy.
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const cx = 60 + Math.cos(angle) * 38;
      const cy = 60 + Math.sin(angle) * 38;
      if (distance(x, y, cx, cy) <= 7) return [...accent, 255];
    }

    // Two bars where a wordmark would sit.
    if (x >= 130 && x < 300 && y >= 44 && y < 58) return [...primary, 255];
    if (x >= 130 && x < 250 && y >= 66 && y < 76) return [...accent, 255];
    return [0, 0, 0, 0];
  },
};

/** A mark for one event, square-ish, so it reads differently from the series'. */
export const EVENT_LOGO = {
  width: 160,
  height: 160,
  paint: (x, y) => {
    const primary = hexToRgb(BRANDING.primaryColor);
    const accent = hexToRgb(BRANDING.accentColor);

    if (!insideRoundedSquare(x, y, 160, 28)) return [0, 0, 0, 0];
    // A thick chevron, pointing forward.
    const stroke = Math.abs(x - 60 - Math.abs(y - 80));
    if (stroke <= 14) return [...accent, 255];
    return [...primary, 255];
  },
};

export const LOGO = {
  width: 480,
  height: 120,
  paint: (x, y) => {
    const primary = hexToRgb(BRANDING.primaryColor);
    const accent = hexToRgb(BRANDING.accentColor);

    const ring = distance(x, y, 60, 60);
    if (ring <= 46 && ring >= 30) return [...primary, 255];
    if (ring <= 22) return [...accent, 255];

    // Three bars of decreasing width, in the place a wordmark would be.
    const bars = [
      [130, 34, 300],
      [130, 56, 232],
      [130, 78, 168],
    ];
    for (const [left, top, width] of bars) {
      if (x >= left && x < left + width && y >= top && y < top + 12) {
        return [...primary, 255];
      }
    }
    return [0, 0, 0, 0];
  },
};

/**
 * The app icon: square and 512 pixels, so a browser really installs from it.
 *
 * Both properties are the point. F105 keeps the shipped Trefaro icons beside an
 * uploaded one unless the upload is square and at least 144 pixels — so an icon
 * that misses either would leave the demo instance installing under somebody
 * else's mark, which is exactly the thing the demo is meant to show working.
 */
export const APP_ICON = {
  width: 512,
  height: 512,
  paint: (x, y) => {
    const primary = hexToRgb(BRANDING.primaryColor);
    const accent = hexToRgb(BRANDING.accentColor);

    // A rounded square, because that is what a home screen expects; the corner
    // is generous, so a launcher that crops it further still shows the ring.
    if (!insideRoundedSquare(x, y, 512, 96)) return [0, 0, 0, 0];

    const centre = distance(x, y, 256, 256);
    if (centre <= 168 && centre >= 118) return [255, 255, 255, 255];
    if (centre <= 60) return [...accent, 255];
    return [...primary, 255];
  },
};

/**
 * The English side of the demo content (FR 3.12, AP 11).
 *
 * The demo data is German, so the translations are what a visitor switching to
 * English gets — the case the feature exists for. Deliberately incomplete: the
 * draft series and two of the events have none, because "some of it is
 * translated" is the state an organization is actually in, and the fallback to
 * the original is the behaviour worth seeing (F94).
 *
 * Programme items are keyed by their German title: the seed knows the ids only
 * after it created them, and a position in a list is the one key that silently
 * moves when somebody edits the content above.
 */
export const TRANSLATIONS = {
  locale: 'en',
  series: {
    citizens: {
      name: "Citizens' assemblies for Europe",
      description:
        "A series of citizens' assemblies on European democracy: an opening " +
        'conference, three sessions and a closing event. The recommendations go ' +
        'to the European Parliament.',
    },
    workshop: {
      name: 'Democracy workshop',
      description:
        'Two-day workshops for people active in associations and initiatives: ' +
        'participation formats, facilitation, public relations.',
    },
  },
  events: {
    kickoff: {
      name: "Opening conference of the citizens' assemblies",
      description:
        'The start of the series: 120 randomly selected people from twelve ' +
        'countries, two days in Brussels, with simultaneous interpretation into ' +
        'four languages.',
      venueName: 'House of Democracy',
      followUpBody:
        'Thank you to everyone who took part. The recordings of the plenary ' +
        'sessions and the minutes of the working groups are below. The next ' +
        'session has been announced — the invitation goes to everybody who ' +
        'registered here.',
    },
    main: {
      name: 'Climate assembly — third session',
      description:
        'The third session of the climate assembly. Expert talks in the ' +
        'morning, parallel working groups in the afternoon, and the vote on the ' +
        'recommendations on the third day. On site or online.',
      venueName: 'House of Democracy',
    },
  },
  /** Only the sessions of the main event, and not all of them. */
  programItems: {
    'Ankommen und Registrierung': { title: 'Arrival and registration' },
    'Was bisher geschah': {
      title: 'The story so far',
      description:
        'A look back at the first two sessions and where the recommendations ' +
        'stand.',
    },
    'Fachvortrag: Kosten des Nichthandelns': {
      title: 'Expert talk: the cost of doing nothing',
      description:
        'What climate protection costs and what it saves, calculated over the ' +
        'next twenty years.',
    },
    'Arbeitsgruppe A: Verkehr': {
      title: 'Working group A: transport',
      description:
        'Runs in parallel with working group B. Limited seats, sign-up needed.',
    },
    'Arbeitsgruppe B: Gebäude und Wärme': {
      title: 'Working group B: buildings and heating',
      description:
        'Runs in parallel with working group A. Limited seats, sign-up needed.',
    },
  },
};

/** `#1d4e6f` → `[29, 78, 111]`. */
function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
}

function distance(x, y, centreX, centreY) {
  return Math.hypot(x - centreX, y - centreY);
}

/** A square with quarter-circle corners, tested without drawing anything. */
function insideRoundedSquare(x, y, size, radius) {
  const nearX = Math.min(Math.max(x, radius), size - radius);
  const nearY = Math.min(Math.max(y, radius), size - radius);
  return distance(x, y, nearX, nearY) <= radius;
}
