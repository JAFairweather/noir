// caseweb.mjs — deep cases: the deduction web (DECISIONS §8, spec §4.2).
//
// The v2 cases are corridors: each door opens the next, and the last door
// names the man. A web case is a novel instead of a novella. Three
// independent trails — the money, the paper, the witness — each end in a
// LIST, not a name:
//
//   the duty rota     — who was in the building on the crime nights
//   the key book      — who could reach the stock that walked
//   the particulars   — who matches the detail the witness saw
//
// Each list clears exactly one different suspect. Only the culprit stands
// on all three. No scope names him; the player performs the intersection.
// Accuse on two lists and you have a coin flip you will lose half the
// time — the file closes unresolved either way.
//
// Same contract as every case module: deterministic per seed, committed
// before play, and a walkthrough array that CI replays through the real
// engine to prove the web solvable at heat zero.

import { hash, mulberry32, pick, pickN, vigenere, tokenMatch, POOL, NOLA } from './casegen.mjs'

const sortNames = (names) => [...names].sort()   // alphabetical — never culprit-first

/** Deal four suspects and the three predicate sets.
 *  A passes all three. B fails access. C fails the detail. D fails the nights. */
function dealSuspects(rand, surnames, roles) {
  const [A, B, C, D] = pickN(rand, surnames, 4)
  const rr = pickN(rand, roles, 4)
  return {
    culprit: A,
    suspects: [A, B, C, D],
    role: Object.fromEntries([A, B, C, D].map((n, i) => [n, rr[i]])),
    nightSet: sortNames([A, B, C]), nightCleared: D,
    accessSet: sortNames([A, C, D]), accessCleared: B,
    detailSet: sortNames([A, B, D]), detailCleared: C,
  }
}

/** Three beats out of order; the player reconstructs the evening. */
function dealTimeline(rand, beats) {
  const order = pickN(rand, [0, 1, 2], 3)
  const letters = ['A', 'B', 'C']
  const answer = order.map((o, i) => [o, letters[i]]).sort((x, y) => x[0] - y[0]).map(x => x[1]).join('')
  const cards = order.map((o, i) => `  [${letters[i]}]  ${beats[o].time} — ${beats[o].label}.`)
  return { cards, answer }
}

const timelineEdge = (answer, { to, requires, lead, response, failResponse, answerKey }) => ({
  to, requires, lead, response, failResponse, answerKey,
  match: (t) => {
    const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
    if (!kws.length) return false
    return t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '') === answer
  },
  failMatch: (t) => {
    const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
    if (!kws.length) return false
    const a = t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '')
    return a.length >= 2 && a !== answer
  },
})

// ------------------------------------------------------------ era extras
// Web-only pools: suspect roles, the locked room, the identifying detail.

const WEB_BERLIN = {
  roles: ['senior clerk', 'night registrar', 'dispatch rider', 'archivist'],
  rooms: { 'the permit office': 'the stamp annex', 'the customs annex': 'the seal room', 'the freight registry': 'the plate room' },
  details: [
    { phrase: 'took the pen with his left hand', column: 'writes left-handed',
      counter: 'fills his forms right-handed; the registry has watched his hand for years' },
    { phrase: 'leaned on a stick, right side', column: 'carries a stick (war knee)',
      counter: 'ran for the last tram in October — two witnesses and a fine' },
    { phrase: 'wore a signet turned in against the palm', column: 'wears a signet ring',
      counter: 'pawned his ring in the spring; the ticket is in his file' },
  ],
  nights: [['MON', 'MONDAY'], ['TUE', 'TUESDAY'], ['THU', 'THURSDAY']],
}

const WEB_NOLA = {
  roles: ['desk sergeant', 'property-room clerk', 'night dispatcher', "the captain's driver"],
  room: 'the property cage',
  details: [
    { phrase: 'signed the bar tab with his left hand', column: 'left-handed',
      counter: 'deals cards right-handed every Friday in Gretna, and wins' },
    { phrase: 'wore a lodge ring on the little finger', column: 'lodge ring',
      counter: 'never got past petition; the lodge keeps lists and grudges' },
    { phrase: 'dragged the left boot on the boards', column: 'walks with a drag (dock injury)',
      counter: "danced at his cousin's wedding in May; there is film" },
  ],
  nights: [['MON', 'MONDAY'], ['WED', 'WEDNESDAY'], ['FRI', 'FRIDAY']],
}

// ---------------------------------------------------------------- builder

export function generateWebCase(seed, era = 'berlin-1938') {
  return era === 'neworleans-1968' ? webNola(seed) : webBerlin(seed)
}

function webBerlin(seed) {
  const rand = mulberry32(hash('web|' + String(seed)))
  const ERA = 'berlin-1938'
  const CASE_ID = `web:${ERA}:${seed}`

  const S = dealSuspects(rand, POOL.surnames, WEB_BERLIN.roles)
  const victim = pick(rand, POOL.couriers)
  const workname = pick(rand, POOL.worknames)
  const drop = pick(rand, POOL.drops)
  const office = pick(rand, POOL.offices)
  const room = WEB_BERLIN.rooms[office.name]
  const informant = pick(rand, POOL.informants)
  const [herring, herring2] = pickN(rand, POOL.herrings, 2)
  const detail = pick(rand, WEB_BERLIN.details)
  const [nightAbbr, nightWord] = pick(rand, WEB_BERLIN.nights)
  const cipherPlain = drop.plain.replace(/[^A-Z]/g, '')
  const cipherText = vigenere(cipherPlain, workname)
  const T = dealTimeline(rand, [
    { time: '21:40', label: `Subject ${victim} arrives at the canal path, satchel under the coat` },
    { time: '22:25', label: `Subject is joined by a man who walked up from ${office.name}` },
    { time: '23:10', label: 'One man leaves the path. It is not the subject' },
  ])

  const scopes = {
    briefing: {
      name: `Case Briefing — ${victim}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `BRIEFING — COURIER ${victim}, RECOVERED FROM THE LANDWEHR`,
        body: [
          `Berlin. The canal gave ${victim} back at the Möckern bridge on`,
          `${nightWord.toLowerCase()} morning. He had spent a month inside ${office.name},`,
          `feeding us the man who sells its ${office.doc}. He got close enough`,
          'to drown for it.',
          '',
          `Four men had the evening side of ${office.name} that season. Ask the`,
          'desk for the suspect board when you want them laid out.',
          '',
          `SIGNALS holds ${victim}'s last intercept, keyed under his workname —`,
          'find the word and report "decode <word>"; the desk runs the tables.',
          '',
          `    INTERCEPT:  ${cipherText}`,
          '',
          `His lodgings on the Pension Bogler stairs have not been entered.`,
          `Station streetwork watched the canal path that night; the log exists.`,
          `And mind ${herring.name} — ${herring.trade}. He circles this somehow.`,
          '',
          `— Station. (Courier registry: ${victim}, workname ${workname}.)`,
        ].join('\n'),
      },
    },
    board: {
      name: 'The Suspect Board',
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `FOUR MEN — ${office.name.toUpperCase()}, EVENING SIDE`,
        body: [
          'Chalk on slate, four names, no order:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'Every one of them touched the evening side this season. Nothing',
          'here convicts; this board only tells you who the question is about.',
          '',
          'Three things hang a man: the nights, the keys, and what a witness',
          'saw. Bring back a list for each. One name will stand on all three.',
        ].join('\n'),
      },
    },
    room: {
      name: `Lodgings — Pension Bogler`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: `THE ROOM ON THE BOGLER STAIRS — WHAT ${victim} KEPT`,
        body: [
          'A room rented by a careful man: nothing in writing, one exception.',
          'Under the washstand lid, in pencil, his hand:',
          '',
          `  "Paid in person. Always a ${nightWord.toLowerCase()}. Follow the money`,
          `   to the fallback if I stop walking. — ${workname}"`,
          '',
          'The workname is doing more work than a signature there. His',
          'intercept is still keyed under it.',
        ].join('\n'),
      },
    },
    stash: {
      name: `Dead Drop — ${drop.place}`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'station',
        title: `THE FALLBACK — ${drop.plain}`,
        body: [
          `${victim}'s fallback, packed for exactly this morning. Inside:`,
          '',
          `- A tally page in his hand: payments taken in person, in the`,
          `  building, always ${nightAbbr} evenings, past close. Months of them.`,
          `- A note: "Seller stays late. The rota knows. I don't, yet."`,
          '',
          `He never got the rota. You can: ${office.name} keeps a duty book`,
          'for the evening side. Ask the desk to check the rota.',
        ].join('\n'),
      },
    },
    rota: {
      name: `${office.name} — Duty Rota`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `DUTY ROTA — ${office.name.toUpperCase()}, ${nightAbbr} EVENINGS`,
        body: [
          'Photographed at arm\'s length between rounds. The evening column:',
          '',
          `  Present past close, ${nightAbbr} evenings, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: Hamburg train, every ${nightAbbr} without fail —`,
          '  conductor stamps on file. Clear of the evenings entirely.',
          '',
          `THE FIRST LIST. The money moved on ${nightAbbr} nights; these three`,
          'were in the building. Two more lists and the name is arithmetic.',
        ].join('\n'),
      },
    },
    watcherlog: {
      name: 'Station Streetwork — Watcher Log',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'WATCHER LOG — CANAL PATH, THREE CARDS, ORDER LOST',
        body: [
          `The watcher filed three cards on ${victim}'s last evening and then`,
          'filed himself into a beer hall. Order lost. Reconstruct it;',
          'submit "timeline A B C" in the order you believe.',
          '',
          ...T.cards,
        ].join('\n'),
      },
    },
    site: {
      name: 'The Canal Path',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: 'THE PATH ABOVE THE WATER — WHAT THE NIGHT DROPPED',
        body: [
          'Between the second card and the third, the path keeps what fell:',
          `a torn corner of ${office.doc} blank stock — evening series,`,
          'unissued, serial margin still attached.',
          '',
          `Unissued stock does not walk. It lives under lock in ${room},`,
          `and ${office.name} keeps a key book older than the building.`,
          'Ask who holds keys.',
        ].join('\n'),
      },
    },
    keybook: {
      name: `${office.name} — Key Book`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `KEY BOOK — ${room.toUpperCase()}`,
        body: [
          'Copied out by a clerk who did not ask why:',
          '',
          `  Keys to ${room}, issued and live:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: surrendered his key in March; receipt`,
          '  initialed and filed. No access since.',
          '',
          `THE SECOND LIST. The stock on the path came out of ${room}.`,
          'Three keys could have carried it there.',
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
          `${herring.name}: ${herring.trade}. An hour of his company settles`,
          `it — he ${herring.clears}. Not our man.`,
          '',
          `But he traded with ${victim} once and gives you one thing free:`,
          `"Your courier drank where he could watch a door — ${informant.venue}.`,
          `The ${informant.role} there counts everyone twice."`,
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'street',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. Half an evening settles it —`,
          `he ${herring2.clears}. A door that opens on a wall.`,
        ].join('\n'),
      },
    },
    informant: {
      name: `Informant — ${informant.name}`,
      burnable: true,
      payload: {
        kind: 'npc', scene: 'cafe',
        title: `CONTACT — ${informant.name}, ${informant.role.toUpperCase()}, ${informant.venue.toUpperCase()}`,
        body: [
          `The ${informant.role} talks in the pauses of the job, eyes on the room.`,
          '',
          `"${victim}? Sat where he could see the door. Some evenings a man`,
          'came in after him — never together, never quite apart, either.',
          '',
          `Ask me what you actually want to know. Ask about ${victim}'s man`,
          'and I will tell you what these eyes took down."',
          '',
          'Handle this one gently. There is no second pair of eyes.',
        ].join('\n'),
      },
    },
    statement: {
      name: `Statement — What the Eyes Took Down`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'cafe',
        title: `STATEMENT — THE MAN WHO CAME AFTER ${victim}`,
        body: [
          'Given quietly, between coats:',
          '',
          `"Ordinary coat, office shoulders. But twice I watched him settle`,
          `the bill, and both times he ${detail.phrase}. You remember hands`,
          'in my trade. Faces lie; hands pay."',
          '',
          `${office.name} keeps personnel particulars — hands, habits, war`,
          'records. Pull the particulars and see whose file agrees.',
        ].join('\n'),
      },
    },
    personnel: {
      name: `${office.name} — Personnel Particulars`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `PERSONNEL PARTICULARS — EVENING SIDE`,
        body: [
          'Four file cards, the column that matters copied exact:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per file`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'THE THIRD LIST. Lay it beside the rota and the key book.',
          'Three lists, four names, and only one name on all three.',
          'When you are certain, file it: "accuse <name>". Once.',
        ].join('\n'),
      },
    },
    motive: {
      name: 'Registry Archive — The Old Tallies',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'ARCHIVE PULL — WHY THE COURIER STOPPED WALKING',
        body: [
          `${victim} requisitioned the office's old tally books two days`,
          'before the canal. Whoever sold the stock understood what the old',
          'tallies would show once a careful man laid them side by side.',
          '',
          'That is the whole motive: arithmetic, approaching. You are now',
          'doing the same arithmetic. Walk more carefully than he did.',
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
          `${S.culprit}, ${S.role[S.culprit]}, ${office.name}. On the rota for`,
          `the ${nightAbbr} evenings, holding a live key to ${room}, and his`,
          `file card agrees with the ${informant.role}'s eyes. Three lists,`,
          'one name. He understood arithmetic too; he just started it later',
          'than you did.',
          '',
          `${victim}'s month inside will hold up in the quiet rooms where`,
          'this goes next. Station notes your handling of the asset.',
          'The file does not say thank you. It never does.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'board', requires: ['briefing'],
      lead: 'The desk will lay out the suspect board when asked.',
      match: (t) => t.includes('SUSPECT') || t.includes('BOARD') || (t.includes('FOUR') && t.includes('MEN')),
      response: 'The desk turns the slate around.',
    },
    {
      to: 'room', requires: ['briefing'],
      lead: `${victim}'s lodgings at the Pension Bogler have not been entered.`,
      match: (t) => t.includes('BOGLER') || t.includes('LODGING') || t.includes('PENSION'),
      response: 'The landlady takes the coin and forgets the stairs ever creaked.',
    },
    {
      to: 'stash', requires: ['briefing'],
      lead: 'The intercept waits on a key word: "decode <word>" and the desk runs the tables.',
      answerKey: `The decoded intercept reads ${drop.plain} — ${drop.place}.`,
      match: tokenMatch(drop.tokens),
      response: 'The fallback gives, the way he taught it to.',
    },
    {
      to: 'rota', requires: ['stash'],
      lead: `The tally pays ${nightAbbr} evenings; nobody has pulled ${office.name}'s duty rota.`,
      match: (t) => t.includes('ROTA') || t.includes('ROSTER') || t.includes('DUTY'),
      response: 'A clerk who owes Station a quiet favor photographs a page.',
    },
    {
      to: 'watcherlog', requires: ['briefing'],
      lead: 'Station streetwork watched the canal path that night. Nobody has pulled the log.',
      match: (t) => t.includes('WATCHER') || t.includes('STREETWORK') || (t.includes('STATION') && t.includes('LOG')),
      response: 'Station is not pleased to be asked, which is how you know the log exists.',
    },
    timelineEdge(T.answer, {
      to: 'site', requires: ['watcherlog'],
      lead: 'Three watcher cards wait to be put in order: "timeline A B C".',
      answerKey: `The correct order of the watcher cards is ${T.answer.split('').join(' ')}.`,
      response: 'Arrive, meet, and one man walking away — the hours line up, and the path will show you where.',
      failResponse: 'Shuffled that way, the evening argues back: a man cannot leave before he arrives. (Heat rises.)',
    }),
    {
      to: 'keybook', requires: ['site'],
      lead: `Evening-series stock lives locked in ${room}. Nobody has asked who holds keys.`,
      match: (t) => t.includes('KEY'),
      response: 'The key book is older than the building and twice as honest.',
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `Station flagged ${herring.name} — ${herring.trade}. Worth an hour, maybe.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the warmth of a man counting exits.`,
    },
    {
      to: 'herring2', requires: ['briefing'],
      lead: `A second name floats near this: ${herring2.name}, ${herring2.trade}.`,
      match: (t) => t.includes(herring2.name),
      response: `${herring2.name} keeps his hands visible the whole conversation, which tells you most of it.`,
    },
    {
      to: 'informant', requires: ['herring'],
      lead: `${herring.name} pointed at ${informant.venue}: the ${informant.role} counts everyone twice.`,
      match: (t) => t.includes(informant.alias) || t.includes(informant.venue.toUpperCase().replace('THE ', '').split(' ').pop() ?? ''),
      response: `${informant.venue}, the quiet hour. The ${informant.role}, and the eyes ${victim} trusted.`,
    },
    {
      to: 'statement', requires: ['informant'],
      lead: `The ${informant.role} is waiting to be asked about ${victim}'s man.`,
      match: (t) => t.includes(victim),
      response: 'The room empties by one table, and the statement comes out slow and exact.',
    },
    {
      to: 'personnel', requires: ['statement'],
      lead: `A witness detail wants checking: pull ${office.name}'s personnel particulars.`,
      match: (t) => t.includes('PERSONNEL') || t.includes('PARTICULARS') || t.includes('STAFF'),
      response: 'Four file cards, copied by lamplight, returned before the drawer was missed.',
    },
    {
      to: 'motive', requires: ['rota', 'keybook'],
      lead: 'Two lists in hand. The archive can still say why the courier had to stop walking.',
      match: (t) => t.includes('ARCHIVE') || t.includes('MOTIVE') || t.includes('WHY'),
      response: 'The archive clerk finds the requisition slip exactly where a dead man filed it.',
    },
  ]

  const accusation = {
    culprit: S.culprit,
    wrong: [
      ...S.suspects.slice(1), herring.name, herring2.name, informant.alias,
    ],
    unlocks: 'resolution',
    correctResponse: 'Station moves before the evening desk opens.',
    wrongResponse: (name) =>
      `Station moves on ${name}, and gets nothing, because there is nothing — ` +
      'one list is not three. By the time the error is plain, the seller has ' +
      'folded his tally and gone. The file closes unresolved.',
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
          match: (t) => t.includes(victim),
          disposition: 1,
          response: `"${victim} tipped like a man apologizing for something. He asked after my family once. Nobody asks."`,
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
      response: `${workname} is the key, not the message. Lay it against the intercept, letter over letter: "decode ${workname.toLowerCase()}".`,
    },
    {
      match: (t) => t.includes('CIPHER') || t.includes('INTERCEPT') || t.includes('VIGENERE'),
      response: `${victim} keyed the old way: a running keyword under the text. His workname is in the briefing footer.`,
    },
    {
      match: (t) => t.includes('LIST') || t.includes('INTERSECT') || t.includes('CROSS'),
      response: 'Three lists: the rota, the key book, the particulars. Four names. The seller is the one name standing on all three.',
    },
  ]

  const walkthrough = [
    'show me the suspect board',
    'enter the lodgings at the pension bogler',
    `decode ${workname.toLowerCase()}`,
    `check the duty rota for ${nightWord.toLowerCase()} evenings`,
    'pull the watcher log from station streetwork',
    `timeline ${T.answer.split('').join(' ').toLowerCase()}`,
    `who holds keys to ${room}`,
    `ask about ${herring.name.toLowerCase()}`,
    `ask about ${herring2.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and find ${informant.alias.toLowerCase()}`,
    `ask about ${victim.toLowerCase()}'s man`,
    'pull the personnel particulars',
    'archive: why did he stop walking',
    `accuse ${S.culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, TITLE: 'The Canal Keeps Nothing', scopes, edges, accusation, burnTriggers, npcs, hints,
    cipher: { ciphertext: cipherPlain, key: workname, to: 'stash' },
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'FIELD PROCEDURE — what Station expects of a report:',
      '',
      '  Speak plainly. GO somewhere, ASK someone, CHECK a thing.',
      '  Found a cipher key word? "decode <word>" — the desk runs the tables.',
      '  Reconstructing an evening? "timeline A B C" in the order you believe.',
      '  This one is a web, not a corridor: three trails, three lists.',
      '  The man you want is the one name standing on all three.',
      '  Certain? "accuse <name>" — you file that once, and you live with it.',
      '  Lost the thread? "review" — the desk reads the case back.',
      '',
      'Your notebook (right) holds every document you have been handed.',
      'A burned contact is gone for good. Mind the heat.',
    ].join('\n'),
    opening: [
      'BERLIN — NOVEMBER 1938',
      '',
      'This time the courier came back, and the canal carried him.',
      'Four names had the evening side. Three trails will cut the four',
      'down to one: the money, the paper, and a pair of eyes.',
      '',
      'Your notebook holds what you have earned. Nothing else is yours.',
      'Read the briefing. Type plainly. Type "help" for field procedure.',
    ].join('\n'),
    openingScene: 'street',
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-${seed}` }),
    },
  }
}

// ------------------------------------------------------------ New Orleans

function webNola(seed) {
  const rand = mulberry32(hash('webnola|' + String(seed)))
  const ERA = 'neworleans-1968'
  const CASE_ID = `web:${ERA}:${seed}`

  const S = dealSuspects(rand, NOLA.surnames, WEB_NOLA.roles)
  const victim = pick(rand, NOLA.stringers)
  const street = pick(rand, NOLA.streets)
  const office = pick(rand, NOLA.offices)
  const room = WEB_NOLA.room
  const informant = pick(rand, NOLA.informants)
  const [herring, herring2] = pickN(rand, NOLA.herrings, 2)
  const detail = pick(rand, WEB_NOLA.details)
  const [nightAbbr, nightWord] = pick(rand, WEB_NOLA.nights)
  const ads = street.split('').map(L => `  ${NOLA.adLines[L]}`)
  const T = dealTimeline(rand, [
    { time: '23:05', label: `Unit logs ${victim} leaving the Blue Room, camera bag on the shoulder` },
    { time: '23:40', label: 'Unit logs subject meeting a man under the wharf lamp, Esplanade end' },
    { time: '00:15', label: 'Lamp reported dark. One set of footsteps leaves the boards' },
  ])

  const scopes = {
    briefing: {
      name: `Case File — ${victim}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `CASE FILE — ${victim}, STRINGER. THE RIVER GAVE HIM BACK.`,
        body: [
          `New Orleans. The river returned ${victim} at Chalmette, three days`,
          `quiet. He had spent a season photographing what moves through`,
          `${office.name} after midnight, and selling none of it — saving it.`,
          '',
          `Four men ran the night side of ${office.name}. Ask for the suspect`,
          'board when you want the four laid out plain.',
          '',
          'His last classified column ran the morning he went in the water.',
          'He circled it and wrote beneath: "first letters, first."',
          '',
          ...ads,
          '',
          `He kept a room on Esplanade, rent paid ahead. And mind`,
          `${herring.name} — ${herring.trade}. He floats near this somehow.`,
        ].join('\n'),
      },
    },
    board: {
      name: 'The Suspect Board',
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `FOUR MEN — ${office.name.toUpperCase()}, NIGHT SIDE`,
        body: [
          'Grease pencil on glass, four names, no order:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'All four had the night side while the river was busy. The board',
          'convicts nobody; it only says who the question is about.',
          '',
          'Three things hang a man here: the nights, the cage, and what a',
          'witness saw. Bring back a list for each. One name will hold.',
        ].join('\n'),
      },
    },
    room: {
      name: 'Rooming House — Esplanade',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: `THE ROOM ON ESPLANADE — WHAT ${victim} KEPT`,
        body: [
          'A room rented by a careful man. Behind the armoire mirror,',
          'taped, in his hand:',
          '',
          `  "Paid in person, always a ${nightWord.toLowerCase()}, always inside.`,
          `   If I go quiet, the ads know the way to the film."`,
          '',
          'The ads. First letters, first — his own instruction, left where',
          'only a searcher would find it.',
        ].join('\n'),
      },
    },
    stash: {
      name: `The Lockbox — ${street} Street`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: `THE CAMERA EXCHANGE, ${street} STREET — BOX 9`,
        body: [
          `The counterman knew him as a Tuesday face and asks nothing.`,
          'In the box:',
          '',
          `- A payment tally in ${victim}'s hand: cash, taken in person,`,
          `  inside the District, always ${nightAbbr} nights. A season of it.`,
          `- One line beneath: "Seller works the ${nightAbbr} shift. Duty roster`,
          '  would prove it. Can\'t reach the roster. — T."',
          '',
          'You can reach the roster. Ask the desk to check it.',
        ].join('\n'),
      },
    },
    rota: {
      name: `${office.name} — Duty Roster`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `DUTY ROSTER — ${office.name.toUpperCase()}, ${nightAbbr} NIGHTS`,
        body: [
          'Copied by a records girl who believes in overtime and little else:',
          '',
          `  On the ${nightAbbr} night shift, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: detailed to Baton Rouge every ${nightAbbr}`,
          '  since spring — travel vouchers on file. Clear of the nights.',
          '',
          `THE FIRST LIST. The money moved ${nightAbbr} nights; these three`,
          'were in the building. Two more lists and it is arithmetic.',
        ].join('\n'),
      },
    },
    watcherlog: {
      name: 'Radio Dispatch Log',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'DISPATCH LOG — WHARF, LAST NIGHT OUT. ORDER LOST.',
        body: [
          'Three radio entries survive the desk sergeant\'s coffee. The',
          'carbons are shuffled. Reconstruct the night; submit',
          '"timeline A B C" in the order you believe.',
          '',
          ...T.cards,
        ].join('\n'),
      },
    },
    site: {
      name: 'The Wharf Boards',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: 'UNDER THE WHARF LAMP — WHAT THE BOARDS KEPT',
        body: [
          'Between the meeting and the dark lamp, the boards kept this:',
          'a torn evidence sleeve, wax-stamped, numbered in the District\'s',
          `own series — the kind that never leaves ${room}.`,
          '',
          `${office.name} logs every man with a key to the cage.`,
          'Ask who holds keys.',
        ].join('\n'),
      },
    },
    keybook: {
      name: `${office.name} — Cage Log`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `KEY LOG — ${room.toUpperCase()}`,
        body: [
          'The cage log, photographed page and all:',
          '',
          `  Keys to ${room}, issued and live:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: key pulled in March after the audit;`,
          '  surrender slip signed. No access since.',
          '',
          `THE SECOND LIST. The sleeve on the boards came out of ${room}.`,
          'Three keys could have walked it there.',
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
          `${herring.name}: ${herring.trade}. An hour settles it — he`,
          `${herring.clears}. Not our man.`,
          '',
          `But he knew ${victim} by sight and gives you one thing free:`,
          `"Your shutterbug drank at ${informant.venue}, always facing the`,
          `door. The ${informant.role} there forgets nothing."`,
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'street',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. Half an evening settles it —`,
          `he ${herring2.clears}. A door that opens on a wall.`,
        ].join('\n'),
      },
    },
    informant: {
      name: `Informant — ${informant.name}`,
      burnable: true,
      payload: {
        kind: 'npc', scene: 'cafe',
        title: `CONTACT — ${informant.name}, ${informant.role.toUpperCase()}, ${informant.venue.toUpperCase()}`,
        body: [
          `The ${informant.role} talks between customers, eyes on the room.`,
          '',
          `"${victim}? Sweet boy. Sat where he could see the door. Some`,
          'nights a man came in after him — never with him, never far.',
          '',
          `Ask me about ${victim}'s man and I will tell you what I saw.`,
          'These eyes are the only thing in this town that works for free."',
          '',
          'Handle this one gently. There is no second pair of eyes.',
        ].join('\n'),
      },
    },
    statement: {
      name: 'Statement — What the Eyes Took Down',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'cafe',
        title: `STATEMENT — THE MAN WHO CAME AFTER ${victim}`,
        body: [
          'Given low, over the register:',
          '',
          `"City clothes, careful face. But twice I watched him pay, and`,
          `both times he ${detail.phrase}. Faces lie, cher. Hands pay."`,
          '',
          `The District keeps personnel jackets — hands, habits, injuries.`,
          'Pull the personnel jackets and see whose agrees.',
        ].join('\n'),
      },
    },
    personnel: {
      name: `${office.name} — Personnel Jackets`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'PERSONNEL JACKETS — NIGHT SIDE, THE COLUMN THAT MATTERS',
        body: [
          'Four jackets, one column copied exact:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per jacket`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'THE THIRD LIST. Lay it beside the roster and the cage log.',
          'Three lists, four names, one name on all three.',
          'When you are certain, file it: "accuse <name>". Once.',
        ].join('\n'),
      },
    },
    motive: {
      name: 'The Item — Newspaper Morgue',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'MORGUE PULL — WHY THE STRINGER WENT IN THE RIVER',
        body: [
          `${victim} had queried the Item's morgue for every unloading`,
          'logged at the Esplanade wharf this season. He was two nights',
          'from laying his tally against the paper\'s shipping columns.',
          '',
          'That is the whole motive: arithmetic, approaching. You are',
          'doing the same arithmetic now. Do it faster than he did.',
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
          `${S.culprit}, ${S.role[S.culprit]}, ${office.name}. On the roster`,
          `for the ${nightAbbr} nights, holding a live key to ${room}, and his`,
          `jacket agrees with the ${informant.role}'s eyes. Three lists, one`,
          'name. The federal men take it from here, which in this town',
          'means it might even hold.',
          '',
          `${victim}'s film comes up out of Box 9 and into the record.`,
          'The river keeps what it is given. So, it turns out, do you.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'board', requires: ['briefing'],
      lead: 'The desk will lay out the suspect board when asked.',
      match: (t) => t.includes('SUSPECT') || t.includes('BOARD') || (t.includes('FOUR') && t.includes('MEN')),
      response: 'The desk turns the glass around.',
    },
    {
      to: 'room', requires: ['briefing'],
      lead: `${victim} kept a room on Esplanade, rent paid ahead. Nobody has been in.`,
      match: (t) => t.includes('ESPLANADE') || t.includes('LODGING') || t.includes('ROOMING'),
      response: 'The landlady takes the folded bill and remembers a sudden errand.',
    },
    {
      to: 'stash', requires: ['briefing'],
      lead: 'His circled ads are a message: first letters, first.',
      answerKey: `The first letters of the ad lines spell ${street} — the camera exchange on ${street} Street.`,
      match: (t) => t.includes(street),
      response: 'The counterman slides Box 9 across like it is nothing, because to him it is.',
    },
    {
      to: 'rota', requires: ['stash'],
      lead: `The tally pays ${nightAbbr} nights; nobody has pulled the District's duty roster.`,
      match: (t) => t.includes('ROSTER') || t.includes('ROTA') || t.includes('DUTY'),
      response: 'The records girl copies the page and asks for nothing but silence.',
    },
    {
      to: 'watcherlog', requires: ['briefing'],
      lead: 'A unit worked the wharf the night he vanished. The dispatch log exists.',
      match: (t) => t.includes('DISPATCH') || t.includes('RADIO') || (t.includes('WHARF') && t.includes('LOG')),
      response: 'The carbons come out of a drawer that officially does not exist.',
    },
    timelineEdge(T.answer, {
      to: 'site', requires: ['watcherlog'],
      lead: 'Three dispatch carbons wait to be put in order: "timeline A B C".',
      answerKey: `The correct order of the dispatch entries is ${T.answer.split('').join(' ')}.`,
      response: 'Leaves, meets, and one set of footsteps — the night lines up, and the boards will show you where.',
      failResponse: 'Shuffled that way, the night argues back: a lamp cannot go dark before it is lit. (Heat rises.)',
    }),
    {
      to: 'keybook', requires: ['site'],
      lead: `Evidence sleeves live in ${room}. Nobody has asked who holds keys.`,
      match: (t) => t.includes('KEY') || t.includes('CAGE'),
      response: 'The cage log is the one honest book in the building.',
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `The District flagged ${herring.name} — ${herring.trade}. Worth an hour, maybe.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the hospitality of a man rehearsing his alibi.`,
    },
    {
      to: 'herring2', requires: ['briefing'],
      lead: `A second name floats near this: ${herring2.name}, ${herring2.trade}.`,
      match: (t) => t.includes(herring2.name),
      response: `${herring2.name} keeps both hands on the bar the whole time, which tells you most of it.`,
    },
    {
      to: 'informant', requires: ['herring'],
      lead: `${herring.name} pointed at ${informant.venue}: the ${informant.role} forgets nothing.`,
      match: (t) => t.includes(informant.alias) || t.includes(informant.venue.toUpperCase().replace('THE ', '').split(' ').pop() ?? ''),
      response: `${informant.venue}, the slow hour. The ${informant.role}, and the eyes ${victim} trusted.`,
    },
    {
      to: 'statement', requires: ['informant'],
      lead: `The ${informant.role} is waiting to be asked about ${victim}'s man.`,
      match: (t) => t.includes(victim),
      response: 'A glass gets polished that was already clean, and the statement comes out slow and exact.',
    },
    {
      to: 'personnel', requires: ['statement'],
      lead: 'A witness detail wants checking: pull the personnel jackets.',
      match: (t) => t.includes('PERSONNEL') || t.includes('JACKET') || t.includes('STAFF'),
      response: 'Four jackets, borrowed for one cigarette\'s length and returned.',
    },
    {
      to: 'motive', requires: ['rota', 'keybook'],
      lead: 'Two lists in hand. The Item\'s morgue can still say why the stringer went in the river.',
      match: (t) => t.includes('MORGUE') || t.includes('MOTIVE') || t.includes('WHY') || t.includes('ITEM'),
      response: 'The morgue clerk finds the request slips exactly where a dead man filed them.',
    },
  ]

  const accusation = {
    culprit: S.culprit,
    wrong: [
      ...S.suspects.slice(1), herring.name, herring2.name, informant.alias,
    ],
    unlocks: 'resolution',
    correctResponse: 'The federal men move at dawn, before the shift change.',
    wrongResponse: (name) =>
      `The federal men move on ${name}, and get nothing, because there is ` +
      'nothing — one list is not three. By the time the error is plain, the ' +
      'seller has cleaned the cage and gone. The file closes unresolved.',
  }

  const burnTriggers = {
    press: {
      scope: 'informant',
      match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes(informant.alias),
      reason: 'Contact compromised: subject pressed at the workplace. Do not approach again.',
      response: 'You lean, and the room goes quiet the way a street goes quiet. By closing time the arrangement is ash.',
    },
    heatThreshold: 80,
    heatReason: 'Contact compromised: attention exceeded tolerance. Severed.',
  }

  const npcs = {
    informant: {
      aliases: [informant.alias],
      fallback: `The ${informant.role} polishes something and waits for a better question.`,
      lines: [
        {
          match: (t) => t.includes(victim),
          disposition: 1,
          response: `"${victim} tipped like a man apologizing for something. Asked after my mother once. Nobody asks."`,
        },
        {
          match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY'),
          heat: 5,
          response: 'The bill is looked at like weather, and left on the wood. (Heat rises.)',
        },
      ],
    },
  }

  const hints = [
    {
      match: (t) => t.includes('ACROSTIC') || t.includes('ADS') || t.includes('CLASSIFIED') || t.includes('LETTERS'),
      response: 'His own instruction: first letters, first. Read the ad column down its left edge.',
    },
    {
      match: (t) => t.includes('LIST') || t.includes('INTERSECT') || t.includes('CROSS'),
      response: 'Three lists: the roster, the cage log, the jackets. Four names. The seller is the one name standing on all three.',
    },
  ]

  const walkthrough = [
    'show me the suspect board',
    'enter the rooming house on esplanade',
    `the ads spell ${street.toLowerCase()} — the camera exchange on ${street.toLowerCase()} street`,
    `check the duty roster for ${nightWord.toLowerCase()} nights`,
    'pull the radio dispatch log',
    `timeline ${T.answer.split('').join(' ').toLowerCase()}`,
    'who holds a key to the property cage',
    `ask about ${herring.name.toLowerCase()}`,
    `ask about ${herring2.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and find ${informant.alias.toLowerCase()}`,
    `ask about ${victim.toLowerCase()}'s man`,
    'pull the personnel jackets',
    'the item morgue: why did he go in the river',
    `accuse ${S.culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, TITLE: 'What the River Returned', scopes, edges, accusation, burnTriggers, npcs, hints,
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'PROCEDURE — what the desk expects of a report:',
      '',
      '  Speak plainly. GO somewhere, ASK someone, CHECK a thing.',
      '  His ads are a message: first letters, first.',
      '  Reconstructing a night? "timeline A B C" in the order you believe.',
      '  This one is a web, not a corridor: three trails, three lists.',
      '  The man you want is the one name standing on all three.',
      '  Certain? "accuse <name>" — you file that once, and you live with it.',
      '  Lost the thread? "review" — the desk reads the case back.',
      '',
      'Your notebook (right) holds every document you have been handed.',
      'A burned contact is gone for good. Mind the heat.',
    ].join('\n'),
    opening: [
      'NEW ORLEANS — SUMMER 1968',
      '',
      'The river gave the stringer back, which is more than this town',
      'usually returns. Four names ran the night side. Three trails will',
      'cut the four down to one: the money, the paper, and a pair of eyes.',
      '',
      'Your notebook holds what you have earned. Nothing else is yours.',
      'Read the case file. Type plainly. Type "help" for procedure.',
    ].join('\n'),
    openingScene: 'street',
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-nola-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-nola-${seed}` }),
    },
  }
}
