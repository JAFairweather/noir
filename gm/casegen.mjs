// casegen.mjs — case graphs from seeds (spec §4, M3).
//
// Deterministic skeleton, generative flesh: everything here — topology,
// culprit, cipher, timeline order, names, places — is fixed by the seed.
// Two players on one seed face the same case; the Director (when present)
// makes sure they never read the same sentence. Generated cases satisfy
// the same module shape as hand-authored ones, including a walkthrough,
// so the smoke suite can prove every seed solvable.
//
// v1 generates Berlin 1938 cases: one template topology (9 scopes: incite,
// cipher drop, red herring, burnable informant, timeline, site, registry,
// resolution) with the CONTENT randomized per seed. Topology variety and
// other eras come after the Director has field-tested this shape.

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------- era pools
// Berlin 1938, per the era bible: bureaucratic menace, stamps and queues.

const POOL = {
  surnames: ['HARTMANN', 'VOGEL', 'RICHTER', 'LANGE', 'SCHILLING', 'KRAMER', 'NEUMANN', 'BECKER'],
  worknames: ['AMSEL', 'FALKE', 'MARDER', 'DROSSEL', 'LERCHE', 'KIEBITZ'],   // courier bird-names
  couriers: ['GRAF', 'SEIDEL', 'WINTER', 'BRAND'],
  drops: [
    { plain: 'TRAM DEPOT SEVEN', tokens: ['TRAM', 'DEPOT', ['SEVEN', '7']], place: 'the tram depot, bay seven' },
    { plain: 'KIOSK SAVIGNYPLATZ', tokens: ['KIOSK', 'SAVIGNYPLATZ'], place: 'the news kiosk on Savignyplatz' },
    { plain: 'BOATHOUSE WANNSEE', tokens: ['BOATHOUSE', 'WANNSEE'], place: 'the boathouse at Wannsee' },
    { plain: 'HAUPTPOST BOX FOUR', tokens: ['HAUPTPOST', ['FOUR', '4']], place: 'post box four at the Hauptpost' },
  ],
  informants: [
    { name: 'HERR OSSIETZ', role: 'night porter', venue: 'the Hotel Excelsior', alias: 'OSSIETZ' },
    { name: 'FRAU LIEBERMANN', role: 'ticket seller', venue: 'the Ufa-Palast cinema', alias: 'LIEBERMANN' },
    { name: 'HERR QUANDT', role: 'cloakroom man', venue: 'Café Kranzler', alias: 'QUANDT' },
  ],
  offices: [
    { name: 'the permit office', doc: 'work permits' },
    { name: 'the customs annex', doc: 'transit stamps' },
    { name: 'the freight registry', doc: 'export waybills' },
  ],
  herrings: [
    { name: 'WINKLER', trade: 'a fence for ration books', clears: 'buys paper, never sells it' },
    { name: 'MOHR', trade: 'a money changer off Alexanderplatz', clears: 'was in a cell that week for short-changing the wrong wife' },
  ],
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)]
const pickN = (rand, arr, n) => {
  const copy = [...arr], out = []
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0])
  return out
}

// Vigenère, computed — the intercept in the briefing is a REAL cipher.
function vigenere(plain, key) {
  const A = 65
  let ki = 0
  const out = [...plain].map(ch => {
    if (ch < 'A' || ch > 'Z') return ''
    const c = ((ch.charCodeAt(0) - A) + (key[ki++ % key.length].charCodeAt(0) - A)) % 26
    return String.fromCharCode(A + c)
  }).join('')
  return out.replace(/(.{5})/g, '$1 ').trim()
}

const tokenMatch = (tokens) => (t) =>
  tokens.every(tok => Array.isArray(tok) ? tok.some(v => t.includes(v)) : t.includes(tok))

// ---------------------------------------------------------------- casegen

export function generateCase(seed, era = 'berlin-1938') {
  return era === 'neworleans-1968' ? buildNola(seed) : buildBerlin(seed)
}

function buildBerlin(seed) {
  const rand = mulberry32(hash(String(seed)))
  const ERA = 'berlin-1938'
  const CASE_ID = `gen:${seed}`

  const [culprit, cleared] = pickN(rand, POOL.surnames, 2)
  const courier = pick(rand, POOL.couriers)
  const workname = pick(rand, POOL.worknames)
  const drop = pick(rand, POOL.drops)
  const informant = pick(rand, POOL.informants)
  const office = pick(rand, POOL.offices)
  const [herring, herring2raw] = pickN(rand, POOL.herrings, 2)
  const herring2 = rand() < 0.4 ? herring2raw : null
  const cipherText = vigenere(drop.plain.replace(/[^A-Z]/g, ''), workname)
  const nights = pick(rand, [['MON', 'MONDAY'], ['TUE', 'TUESDAY'], ['THU', 'THURSDAY']])
  const [nightAbbr, nightWord] = nights
  // timeline: three fixed beats, shuffled presentation
  const beats = [
    { label: 'arrives with the satchel', time: '21:10' },
    { label: `is joined by a man from ${office.name}`, time: '22:20' },
    { label: 'departs alone, carrying nothing', time: '23:35' },
  ]
  const order = pickN(rand, [0, 1, 2], 3)          // presentation order of A/B/C
  const letters = ['A', 'B', 'C']
  const timelineAnswer = order.map((o, i) => [o, letters[i]]).sort((x, y) => x[0] - y[0]).map(x => x[1]).join('')

  const scopes = {
    briefing: {
      name: `Case Briefing — ${courier}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `BRIEFING — COURIER ${courier}, OVERDUE`,
        body: [
          `Berlin. Courier ${courier} missed the ${nightWord.toLowerCase()} handover and the`,
          `${office.doc} he carried are moving without us. Somebody inside`,
          `${office.name} is selling, and ${courier} found out which somebody.`,
          '',
          `SIGNALS holds one intercepted fragment, keyed under ${courier}'s`,
          `workname — find the word, and the desk runs the tables for you:`,
          `report "decode <word>".`,
          '',
          `    INTERCEPT:  ${cipherText}`,
          '',
          `Watch your step around ${herring.name} — ${herring.trade}. He is in`,
          'this somewhere, or wants us to think so.',
          '',
          `— Station. (Courier registry: ${courier}, workname ${workname}.)`,
        ].join('\n'),
      },
    },
    drop: {
      name: `Dead Drop — ${drop.place}`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'station',
        title: `CONTENTS — ${drop.plain}`,
        body: [
          `${courier}'s fallback, untouched since ${nightWord.toLowerCase()}. Inside:`,
          '',
          `- A tally page: payments on ${nightAbbr} nights, initialed "${culprit[0]}."`,
          `  and once "${cleared[0]}." — both initials sign at ${office.name}.`,
          `- A pencil line in ${courier}'s hand: "${informant.name} — ${informant.role}`,
          `  at ${informant.venue} — counts everyone. Ask gently."`,
          '',
          'Two sets of initials. One seller. You need an eye that was there.',
        ].join('\n'),
      },
    },
    ...(herring2 ? {
      herring2: {
        name: `Inquiry — ${herring2.name}`,
        burnable: false,
        payload: {
          kind: 'dossier', scene: 'street',
          title: `INQUIRY — ${herring2.name}`,
          body: [
            `${herring2.name}: ${herring2.trade}. Half an evening settles it —`,
            `he ${herring2.clears}. Another door that opens on a wall.`,
          ].join('\n'),
        },
      },
    } : {}),
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'street',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name}: ${herring.trade}. An hour of his company settles it —`,
          `he ${herring.clears}. Not our man.`,
          '',
          `But he knew ${courier} by sight, and adds one thing for free:`,
          `"Your courier was at ${informant.venue} more than a courier should be."`,
        ].join('\n'),
      },
    },
    informant: {
      name: `Informant — ${informant.name}`,
      burnable: true,
      payload: {
        kind: 'npc', scene: 'cafe',
        title: `STATEMENT — ${informant.name}, ${informant.role.toUpperCase()}, ${informant.venue.toUpperCase()}`,
        body: [
          `The ${informant.role} talks in the pauses of the job, eyes on the room.`,
          '',
          `"${courier}? ${nightWord} nights, always the same corner, always the`,
          `same company — a man from ${office.name} who came straight from the`,
          `evening desk, still carrying its smell of ink and sealing wax.`,
          '',
          'Which one? Names are your trade. But Station watched this room',
          'once — ask them for the watcher log, and check who held the',
          `${nightWord.toLowerCase()} evening desk."`,
          '',
          'Handle this one gently. There is no second pair of eyes.',
        ].join('\n'),
      },
    },
    watcher: {
      name: 'Station Streetwork — Watcher Log',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'WATCHER LOG — EXTRACTS, OUT OF ORDER',
        body: [
          `Three cards survive from ${courier}'s last ${nightWord.toLowerCase()}. Order lost.`,
          'Reconstruct the evening; submit the order (e.g. "timeline C A B").',
          '',
          ...order.map((o, i) =>
            `  [${letters[i]}]  ${beats[o].time} — Subject ${courier} ${beats[o].label}.`),
        ].join('\n'),
      },
    },
    site: {
      name: 'The Last Walk',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: `AFTER ${beats[2].time} — WHERE THE EVENING WENT`,
        body: [
          `Past the last card the trail runs east, and ${courier} with it.`,
          `What he left: a torn corner of ${office.doc} stock, evening-series`,
          `print. The man who met him came from the ${nightWord.toLowerCase()} evening desk`,
          'and went back to it. Paper will tell you whose desk that was.',
        ].join('\n'),
      },
    },
    registry: {
      name: `${office.name} — Desk Register`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `DESK REGISTER — ${office.name.toUpperCase()}, EVENING`,
        body: [
          'Photographed through glass, corner flared, legible:',
          '',
          `  ${nightAbbr} evenings, this month:  ${culprit}`,
          `  (${cleared} traded away every ${nightAbbr} — his initials clear him.)`,
          '',
          `The tally says ${nightAbbr}. The ${informant.role} says the evening desk.`,
          'The register says who sat at it.',
          '',
          'When you are certain, file it: "accuse <name>". Once.',
        ].join('\n'),
      },
    },
    resolution: {
      name: 'Resolution — Case Closed',
      burnable: false,
      payload: {
        kind: 'epilogue', scene: 'epilogue',
        title: 'RESOLUTION',
        body: [
          `${culprit}, ${office.name}, evening desk. He sold the ${office.doc}`,
          `by lamplight and initialed his own tally like a shopkeeper.`,
          `${courier}'s list is recovered; most of it will still be honored.`,
          '',
          'Station notes your handling of the asset in the file.',
          'The file does not say thank you. It never does.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'drop', requires: ['briefing'],
      lead: 'The intercept waits on a key word: "decode <word>" and the desk runs the tables.',
      answerKey: `The decoded intercept reads ${drop.plain} — ${drop.place}.`,
      match: tokenMatch(drop.tokens),
      response: 'The fallback gives, on the second try, the way he taught it to.',
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `Station flagged ${herring.name} — ${herring.trade}. Worth an hour, maybe.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the warmth of a man counting exits.`,
    },
    ...(herring2 ? [{
      to: 'herring2', requires: ['briefing'],
      lead: `A second name floats near this: ${herring2.name}, ${herring2.trade}.`,
      match: (t) => t.includes(herring2.name),
      response: `${herring2.name} keeps his hands visible the whole conversation, which tells you most of it.`,
    }] : []),
    {
      to: 'informant', requires: ['drop'],
      lead: `The courier's pencil line names an eye: ${informant.name}, ${informant.role} at ${informant.venue}.`,
      match: (t) => t.includes(informant.alias) || (t.includes(informant.venue.toUpperCase().replace('THE ', '').split(' ').pop() ?? '')),
      response: `${informant.venue}, the quiet hour. The ${informant.role}, and the eyes ${courier} trusted.`,
    },
    {
      to: 'watcher', requires: ['informant'],
      lead: 'The informant says Station watched that room once. Nobody has pulled the watcher log.',
      match: (t) => t.includes('WATCHER') || t.includes('STREETWORK') || (t.includes('STATION') && t.includes('LOG')),
      response: 'Station is not pleased to be asked, which is how you know the log exists.',
    },
    {
      to: 'site', requires: ['watcher'],
      lead: 'Three watcher cards wait to be put in order: "timeline A B C".',
      match: (t) => {
        const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
        if (!kws.length) return false
        return t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '') === timelineAnswer
      },
      failMatch: (t) => {
        const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
        if (!kws.length) return false
        const a = t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '')
        return a.length >= 2 && a !== timelineAnswer
      },
      failResponse: 'Shuffled that way, the evening argues back: a man cannot leave before he arrives. (Heat rises.)',
      response: 'Arrive, meet, depart — the hours line up, and the trail runs east.',
    },
    {
      to: 'registry', requires: ['informant'],
      lead: `The seller came from ${office.name}'s evening desk. Nobody has checked the desk register.`,
      match: (t) => t.includes('REGISTER') || t.includes('DESK') || (t.includes(nightWord) && (t.includes('CHECK') || t.includes('WHO'))),
      response: 'A friend of a friend owes Station a favor. By morning: a photograph of the register.',
    },
  ]

  const accusation = {
    culprit,
    wrong: [cleared, herring.name, informant.alias, ...(herring2 ? [herring2.name] : [])],
    unlocks: 'resolution',
    correctResponse: 'Station moves before the evening desk opens.',
    wrongResponse: (name) =>
      `Station moves on ${name}, and gets nothing, because there is nothing. ` +
      'By the time the error is plain, the seller has folded his tally and gone. The file closes unresolved.',
  }

  const burnTriggers = {
    press: {
      scope: 'informant',
      match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes(informant.alias),
      reason: 'Asset compromised: subject pressed in a public place. Contact severed. Do not approach.',
      response: 'You lean, and the room notices the temperature change. By nightfall the arrangement is ash.',
    },
    heatThreshold: 80,
    heatReason: 'Asset compromised: surveillance pressure exceeded tolerance. Contact severed.',
  }

  const npcs = {
    informant: {
      aliases: [informant.alias],
      fallback: `The ${informant.role} finds work for idle hands and waits for a better question.`,
      lines: [
        {
          match: (t) => t.includes(courier),
          disposition: 1,
          response: `"${courier} tipped like a man apologizing for something. He asked after my family once. Nobody asks."`,
        },
        {
          match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY'),
          heat: 5,
          response: 'The money is examined like weather, and left where it lies. (Heat rises.)',
        },
      ],
    },
  }

  const hints = [
    {
      match: (t) => t.includes(workname),
      response: `${workname} is the key, not the message. Lay it against the intercept, letter over letter, and subtract.`,
    },
    {
      match: (t) => t.includes('CIPHER') || t.includes('DECODE') || t.includes('INTERCEPT') || t.includes('VIGENERE'),
      response: `${courier} keyed the old way: a running keyword under the text. His workname is in the briefing footer.`,
    },
  ]

  const walkthrough = [
    `the intercept decodes to ${drop.plain.toLowerCase()}`,
    `ask about ${herring.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and ask ${informant.alias.toLowerCase()} about ${courier.toLowerCase()}`,
    'ask station for the watcher log',
    `timeline ${timelineAnswer.split('').join(' ').toLowerCase()}`,
    `check who held the ${nightWord.toLowerCase()} evening desk`,
    `accuse ${culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, scopes, edges, accusation, burnTriggers, npcs, hints,
    cipher: { ciphertext: drop.plain.replace(/[^A-Z]/g, ''), key: workname, to: 'drop' },
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'FIELD PROCEDURE — what Station expects of a report:',
      '',
      '  Speak plainly. GO somewhere, ASK someone, CHECK a thing.',
      '  Found a cipher key word? "decode <word>" — the desk runs the tables.',
      '  Reconstructing an evening? "timeline A B C" in the order you believe.',
      '  Certain? "accuse <name>" — you file that once, and you live with it.',
      '  Lost the thread? "review" — the desk reads the case back.',
      '',
      'Your notebook (right) holds every document you have been handed.',
      'A burned contact is gone for good. Mind the heat.',
    ].join('\n'),
    opening: [
      'BERLIN — NOVEMBER 1938',
      '',
      `A courier is overdue and the city pretends not to notice. The case`,
      'reaches you as a single dossier; everything else is somebody\'s secret.',
      '',
      'Your notebook holds what you have earned. Nothing else is yours.',
      'Read the briefing. Type plainly. Type "help" for field procedure.',
    ].join('\n'),
    openingScene: 'street',
    walkthrough,
    solutionCommitment: {
      salt: `casegen-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit, salt: `casegen-${seed}` }),
    },
  }
}

// -------------------------------------------------- New Orleans 1968 pools
// Per eras/neworleans-1968.md: corruption as climate, the river keeping
// what it's given. The era's cipher is the classified-ad ACROSTIC.

const NOLA = {
  surnames: ['LANDRY', 'MOREAU', 'DUPRE', 'GAUTIER', 'FONTENOT', 'BERGERON', 'THIBAULT', 'CHERAMIE'],
  stringers: ['CALLOU', 'PREJEAN', 'MARTELLO', 'DUFOUR'],
  streets: ['ROYAL', 'CONTI', 'DUMAINE'],   // no repeated letters — clean acrostics
  informants: [
    { name: 'MISS ODILE', role: 'coat-check girl', venue: 'the Bijou Club', alias: 'ODILE' },
    { name: 'AUGUSTIN', role: 'barman', venue: 'the Half Moon Bar', alias: 'AUGUSTIN' },
    { name: 'TANTE ROSE', role: 'cook', venue: 'the Acme lunch counter', alias: 'ROSE' },
  ],
  offices: [
    { name: 'the First District desk', doc: 'route orders' },
    { name: 'the evidence room', doc: 'found-property slips' },
    { name: 'the licensing bureau', doc: 'permit renewals' },
  ],
  herrings: [
    { name: 'FONTANA', trade: 'runs numbers over a laundry', clears: 'was at a Gretna cockfight with forty witnesses' },
    { name: 'BABIN', trade: 'fences cameras and radios', clears: 'moved nothing with film in it all month' },
  ],
  adLines: {
    A: 'Attention shrimpers: nets mended cheap, Ursulines gate.',
    B: 'Banjo, nine-string, left-handed, serious only.',
    C: 'Cool rooms to let, Marigny, no questions.',
    D: 'Darkroom estate sale — enlargers, trays, best offer.',
    E: 'Esplanade rooms by the week, quiet, paid in advance.',
    H: 'House for let, chinaberry shade, ladies preferred.',
    I: 'Iron balcony railings straightened and sold.',
    L: 'Lessons, trumpet or cornet, evenings, your parlor or mine.',
    M: 'Mules, two, gentle, sound, see Amos rear of icehouse.',
    N: 'Notary, discreet, no appointment required.',
    O: 'Oysters opened for parties, ask for Tante Jo.',
    R: 'Rooms papered and painted, references, veteran.',
    S: 'Sewing machine, treadle, sings like new.',
    T: 'Tarot and palms read, Madame Odile the elder, results certain.',
    U: 'Upright piano, tuned, must move before Lent.',
    Y: 'Yardman wanted, mornings, must mind the dog.',
  },
}

function buildNola(seed) {
  const rand = mulberry32(hash('nola|' + String(seed)))
  const ERA = 'neworleans-1968'
  const CASE_ID = `gen:${ERA}:${seed}`

  const [culprit, cleared] = pickN(rand, NOLA.surnames, 2)
  const stringer = pick(rand, NOLA.stringers)
  const street = pick(rand, NOLA.streets)
  const informant = pick(rand, NOLA.informants)
  const office = pick(rand, NOLA.offices)
  const herring = pick(rand, NOLA.herrings)
  const nights = pick(rand, [['MON', 'MONDAY'], ['WED', 'WEDNESDAY'], ['FRI', 'FRIDAY']])
  const [nightAbbr, nightWord] = nights
  const adBlock = [...street].map(L => '  ' + NOLA.adLines[L])
  const beats = [
    { label: 'is seen at the wharf with his camera, advised area after dark', time: '21:30' },
    { label: `is joined by a man from ${office.name}`, time: '22:20' },
    { label: 'appears in no log again; one roll of film is booked "found property"', time: '23:15' },
  ]
  const order = pickN(rand, [0, 1, 2], 3)
  const letters = ['A', 'B', 'C']
  const timelineAnswer = order.map((o, i) => [o, letters[i]]).sort((x, y) => x[0] - y[0]).map(x => x[1]).join('')

  const scopes = {
    briefing: {
      name: `Case File — ${stringer}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `CASE FILE — ${stringer}, STRINGER (MISSING, DAY 3)`,
        body: [
          `Three days since anybody saw ${stringer}. He shot the waterfront`,
          'for the papers and for reasons he kept to himself. His sister pays',
          'for your time in damp tens, and brings one thing: the Picayune',
          'from the day he vanished, one ad circled in grease pencil.',
          `${stringer} read the classifieds like scripture — top to bottom,`,
          'first things first.',
          '',
          ...adBlock,
          '',
          `Word of caution: ${herring.name} — ${herring.trade} — is in this`,
          'somewhere, or wants us to think so.',
          '',
          `(City desk: stringer ${stringer}, last assignment: the wharf.)`,
        ].join('\n'),
      },
    },
    drop: {
      name: `His Room — ${street} Street`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `THE ROOM ON ${street} STREET — WHAT HE LEFT`,
        body: [
          'The landlady lets you in for the rent he owes. Under the floorboard:',
          '',
          `- A tally page: payments on ${nightAbbr} nights, initialed "${culprit[0]}."`,
          `  and once "${cleared[0]}." — both initial at ${office.name}.`,
          `- A pencil line in ${stringer}'s hand: "${informant.name} — ${informant.role}`,
          `  at ${informant.venue} — counts everyone. Ask gently."`,
          '',
          'Two sets of initials. One seller. You need an eye that was there.',
        ].join('\n'),
      },
    },
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'street',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name}: ${herring.trade}. An hour of his company settles it —`,
          `he ${herring.clears}. Not your man.`,
          '',
          `He knew ${stringer} by sight, and gives you one thing for free:`,
          `"Your camera boy was at ${informant.venue} more than thirst explains."`,
        ].join('\n'),
      },
    },
    informant: {
      name: `Informant — ${informant.name}`,
      burnable: true,
      payload: {
        kind: 'npc', scene: 'cafe',
        title: `STATEMENT — ${informant.name}, ${informant.role.toUpperCase()}, ${informant.venue.toUpperCase()}`,
        body: [
          `The ${informant.role} talks in the pauses of the job, eyes on the room.`,
          '',
          `"${stringer}? ${nightWord} nights, same corner, same company — a man`,
          `from ${office.name}, come straight off the evening shift with the`,
          'building still on him.',
          '',
          'Which one? Names don\'t get said over this counter. But patrols',
          'moved that week, and patrols move on paper. Check the dispatch',
          'log; check who signed the route order."',
          '',
          'Handle this one gently. There is no second pair of eyes.',
        ].join('\n'),
      },
    },
    watcher: {
      name: 'Dispatch Log — Extracts',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'DISPATCH EXTRACTS — HIS LAST NIGHT (OUT OF ORDER)',
        body: [
          'Three photostats, crooked, order lost in the copying.',
          'Reconstruct the night; submit the order (e.g. "timeline C A B").',
          '',
          ...order.map((o, i) =>
            `  [${letters[i]}]  ${beats[o].time} — ${stringer} ${beats[o].label}.`),
        ].join('\n'),
      },
    },
    site: {
      name: 'The Wharf — What the River Gave Back',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: 'THE WHARF — WHAT THE RIVER GAVE BACK',
        body: [
          'A crab trap off the pilings holds his camera case, latched,',
          'weighted, empty. The river keeps what it\'s given.',
          '',
          `But he mailed his sister a package the morning he vanished:`,
          'negatives. The frame after the handoff shows a uniform sleeve,',
          `evening-shift braid, ${office.name}'s issue. Paper will tell you`,
          'whose shift that was.',
        ].join('\n'),
      },
    },
    registry: {
      name: `Route Order — ${office.name}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `ROUTE ORDER — WHO MOVED THE WHARF PATROL`,
        body: [
          `The order that pulled the wharf patrol on his last ${nightWord.toLowerCase()}:`,
          '',
          `  Signed: ${culprit}, ${office.name}, evening shift.`,
          `  (${cleared} — the name everyone offers first — was in Biloxi`,
          '  all week. Photographed fishing. The one alibi nobody can buy.)',
          '',
          `The tally says ${nightAbbr}. The ${informant.role} says the evening`,
          'shift. The order says who held the pen.',
          '',
          'When you are certain, file it: "accuse <name>". Once.',
        ].join('\n'),
      },
    },
    resolution: {
      name: 'Resolution — Case Closed',
      burnable: false,
      payload: {
        kind: 'epilogue', scene: 'epilogue',
        title: 'RESOLUTION',
        body: [
          `${culprit}, ${office.name}, evening shift. He moved the patrols`,
          'the way other men move furniture, and the wharf went dark on',
          'schedule. The negatives and the route order and the tally make a',
          'chain even this parish can\'t unlink.',
          '',
          `${stringer} comes out of the river on a Thursday, three miles down.`,
          'His sister buries the fee in the plate at St. Augustine.',
          'Café au lait at dawn, standing up. It never lasts past breakfast.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'drop', requires: ['briefing'],
      lead: 'The circled ad reads like he read: top to bottom, first things first. It spells a street.',
      answerKey: `The circled classified is an acrostic — the first letters spell ${street}. His room is on ${street} Street.`,
      match: (t) => t.includes(street),
      response: `First letters, top to bottom: ${street}. The landlady is sweeping the step like she's been waiting.`,
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `The desk flagged ${herring.name} — ${herring.trade}. Worth an hour, maybe.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the warmth of a man counting exits.`,
    },
    {
      to: 'informant', requires: ['drop'],
      lead: `The pencil line names an eye: ${informant.name}, ${informant.role} at ${informant.venue}.`,
      match: (t) => t.includes(informant.alias) || t.includes(informant.venue.toUpperCase().replace('THE ', '').split(' ').pop() ?? ''),
      response: `${informant.venue}, the quiet hour. The ${informant.role}, and the eyes ${stringer} trusted.`,
    },
    {
      to: 'watcher', requires: ['informant'],
      lead: 'Patrols moved on paper that week. Nobody has pulled the dispatch log.',
      match: (t) => t.includes('DISPATCH') || t.includes('PATROL') || t.includes('LOG'),
      response: 'The records clerk doesn\'t look up. Three photostats appear under the counter glass.',
    },
    {
      to: 'site', requires: ['watcher'],
      lead: 'Three photostats wait to be put in order: "timeline A B C".',
      match: (t) => {
        const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
        if (!kws.length) return false
        return t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '') === timelineAnswer
      },
      failMatch: (t) => {
        const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
        if (!kws.length) return false
        const a = t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '')
        return a.length >= 2 && a !== timelineAnswer
      },
      failResponse: 'Shuffled that way, the night contradicts itself — film gets booked before it\'s found. (Heat rises.)',
      response: 'Seen, met, gone — the hours line up, and the wharf went dark on schedule. You get the river\'s answer.',
    },
    {
      to: 'registry', requires: ['watcher'],
      lead: 'The route order that moved that patrol is on file. Nobody has checked who signed it.',
      match: (t) => t.includes('SIGNED') || t.includes('ROUTE ORDER') || (t.includes('WHO') && t.includes('ORDER')),
      response: 'Pulled from a file drawer that sticks. The signature line is very neat. Careful men are neat.',
    },
  ]

  const accusation = {
    culprit,
    wrong: [cleared, herring.name, informant.alias],
    unlocks: 'resolution',
    correctResponse: 'You hand the chain — negatives, route order, tally — to the federal men before the District hears you\'ve been asking.',
    wrongResponse: (name) =>
      `You put it on ${name}, and the parish is delighted to agree — until the paperwork drowns. ` +
      'The case closes the way the river closes.',
  }

  const burnTriggers = {
    press: {
      scope: 'informant',
      match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes(informant.alias),
      reason: 'Source severed: subject leaned on in view of the room. Contact lost.',
      response: 'You lean, and the room hears it. In the Quarter that travels faster than a siren. The arrangement is over.',
    },
    heatThreshold: 80,
    heatReason: 'Source severed: District attention exceeded tolerance. Contact lost.',
  }

  const npcs = {
    informant: {
      aliases: [informant.alias],
      fallback: `The ${informant.role} finds work for idle hands and waits for a better question.`,
      lines: [
        {
          match: (t) => t.includes(stringer),
          disposition: 1,
          response: `"${stringer} tipped like a man apologizing for something. He asked after my people once. Nobody asks."`,
        },
        {
          match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY') || t.includes('TWENTY'),
          disposition: 1,
          response: 'The bill is gone before you finish sliding it. "Paper moves patrols, podna. Go read paper." Nothing rings up.',
        },
        {
          match: (t) => t.includes(cleared),
          response: `"${cleared}?" A short laugh with no joke in it. "Biloxi all week, pulling redfish, showing everybody the pictures. Wrong tree."`,
        },
      ],
    },
  }

  const hints = [
    {
      match: (t) => t.includes('AD') || t.includes('CLASSIFIED') || t.includes('ACROSTIC') || t.includes('PICAYUNE'),
      response: 'Top to bottom, first things first — the way he read. The first letters spell a street.',
    },
  ]

  const walkthrough = [
    `the ad spells ${street.toLowerCase()}, go to his room on ${street.toLowerCase()} street`,
    `look into ${herring.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and ask ${informant.alias.toLowerCase()} about ${stringer.toLowerCase()}`,
    'check the dispatch log',
    `timeline ${timelineAnswer.split('').join(' ').toLowerCase()}`,
    'who signed the route order',
    `accuse ${culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, scopes, edges, accusation, burnTriggers, npcs, hints,
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: 'Nothing moves. A screen door claps somewhere, and a man on a gallery marks you without looking up. (Heat rises.)',
    helpText: [
      'HOW THIS WORKS — for the record, once:',
      '',
      '  Say it plain. GO somewhere, ASK someone, CHECK a thing.',
      '  Worked the ad? Say the street it spells.',
      '  Reconstructing a night? "timeline A B C" in the order you believe.',
      '  Certain? "accuse <name>" — one accusation to a customer.',
      '  Lost the thread? "review" — the desk reads the case back.',
      '',
      'Your notebook (right) keeps every document you\'ve been handed.',
      'A burned source is burned for good. Mind the heat.',
    ].join('\n'),
    opening: [
      'NEW ORLEANS — 1968',
      '',
      'River humidity you could wring out of the air, and a sister with',
      'damp tens who wants to know why a careful man stopped coming home.',
      '',
      'Your notebook holds what you have earned. Nothing else is yours.',
      'Read the file. Type plainly. Type "help" for the house rules.',
    ].join('\n'),
    openingScene: 'street',
    walkthrough,
    solutionCommitment: {
      salt: `casegen-nola-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit, salt: `casegen-nola-${seed}` }),
    },
  }
}
