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

export function generateCase(seed) {
  const rand = mulberry32(hash(String(seed)))
  const ERA = 'berlin-1938'
  const CASE_ID = `gen:${seed}`

  const [culprit, cleared] = pickN(rand, POOL.surnames, 2)
  const courier = pick(rand, POOL.couriers)
  const workname = pick(rand, POOL.worknames)
  const drop = pick(rand, POOL.drops)
  const informant = pick(rand, POOL.informants)
  const office = pick(rand, POOL.offices)
  const herring = pick(rand, POOL.herrings)
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
          `workname. Decode it and you have his fallback drop.`,
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
      answerKey: `The decoded intercept reads ${drop.plain} — ${drop.place}.`,
      match: tokenMatch(drop.tokens),
      response: 'The fallback gives, on the second try, the way he taught it to.',
    },
    {
      to: 'herring', requires: ['briefing'],
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the warmth of a man counting exits.`,
    },
    {
      to: 'informant', requires: ['drop'],
      match: (t) => t.includes(informant.alias) || (t.includes(informant.venue.toUpperCase().replace('THE ', '').split(' ').pop() ?? '')),
      response: `${informant.venue}, the quiet hour. The ${informant.role}, and the eyes ${courier} trusted.`,
    },
    {
      to: 'watcher', requires: ['informant'],
      match: (t) => t.includes('WATCHER') || t.includes('STREETWORK') || (t.includes('STATION') && t.includes('LOG')),
      response: 'Station is not pleased to be asked, which is how you know the log exists.',
    },
    {
      to: 'site', requires: ['watcher'],
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
      match: (t) => t.includes('REGISTER') || t.includes('DESK') || (t.includes(nightWord) && (t.includes('CHECK') || t.includes('WHO'))),
      response: 'A friend of a friend owes Station a favor. By morning: a photograph of the register.',
    },
  ]

  const accusation = {
    culprit,
    wrong: [cleared, herring.name, informant.alias],
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
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'FIELD PROCEDURE — what Station expects of a report:',
      '',
      '  Speak plainly. GO somewhere, ASK someone, CHECK a thing.',
      '  Decoded a cipher? Submit the plaintext.',
      '  Reconstructing an evening? "timeline A B C" in the order you believe.',
      '  Certain? "accuse <name>" — you file that once, and you live with it.',
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
