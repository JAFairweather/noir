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

import { hash, mulberry32, pick, pickN, vigenere, tokenMatch, venueMatch, POOL, NOLA } from './casegen.mjs'

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

const WEB_PARIS = {
  surnames: ['MERCIER', 'LAVAL', 'ROCHET', 'DUVAL', 'CARPENTIER', 'BLANCHARD', 'MOREL', 'GARNIER'],
  victims: ['DALBAN', 'THIERRY', 'ROUX', 'LEBEL'],
  worknames: ['MERLE', 'HERON', 'PIVERT', 'GRIVE'],
  roles: ['section head', 'night clerk', 'liaison officer', 'archivist'],
  offices: [
    { name: 'the visa section', doc: 'laissez-passer blanks', room: 'the seal cabinet' },
    { name: 'the accreditation office', doc: 'press cards', room: 'the plate drawer' },
    { name: 'the freight bureau', doc: 'customs waybills', room: 'the stamp room' },
  ],
  drops: [
    { plain: 'CLOAKROOM GARE DE LYON', tokens: ['CLOAKROOM', ['LYON', 'GARE']], place: 'the cloakroom at the Gare de Lyon' },
    { plain: 'KIOSK PONT MARIE', tokens: ['KIOSK', ['PONT', 'MARIE']], place: 'the news kiosk by the Pont Marie' },
    { plain: 'BATHS RUE OBERKAMPF', tokens: ['BATHS', 'OBERKAMPF'], place: 'the public baths on the rue Oberkampf' },
  ],
  informants: [
    { name: 'ODETTE', role: 'hat-check girl', venue: 'the Blue Cellar', alias: 'ODETTE' },
    { name: 'MARCEL', role: 'barman', venue: 'Chez Iris', alias: 'MARCEL' },
    { name: 'MME VIGNE', role: 'concierge', venue: 'the Hôtel Corvisart', alias: 'VIGNE' },
  ],
  herrings: [
    { name: 'SARTENE', trade: 'sells army-surplus maps and better rumors', clears: 'spent that whole week in a cell at the Santé, over rumors he had already sold' },
    { name: 'KOVACS', trade: 'moves currency through a bookshop on the quai', clears: 'moved nothing but Balzac all month; his ledgers bored even the examiner' },
  ],
  details: [
    { phrase: 'signed the chit with his left hand', column: 'writes left-handed',
      counter: 'initials the night book right-handed; the book holds years of him' },
    { phrase: 'kept his gloves on indoors', column: 'wears gloves indoors (burned hands)',
      counter: 'shook hands bare down a whole July reception line; there is a photograph' },
    { phrase: 'wore a mourning band on the left sleeve', column: 'wears a mourning band',
      counter: 'his family is intact and his sleeve is plain; concierges notice sleeves' },
  ],
  nights: [['TUE', 'TUESDAY'], ['THU', 'THURSDAY'], ['SAT', 'SATURDAY']],
}

const WEB_MERIDIAN = {
  surnames: ['QUINN', 'MASTERS', 'BOONE', 'CREEL', 'HOLT', 'GRISSOM', 'PARR', 'SLOAN'],
  victims: ['CULLEN', 'TATE', 'HOLLIS', 'VANCE'],
  roles: ['the wagonmaster', 'the claims clerk', 'the powder man', "the captain's scout"],
  room: 'the strongbox tent',
  doc: 'assay certificates',
  words: ['FORGE', 'BLUFF', 'SWALE'],       // unique letters — clean acrostics
  ledger: {
    A: 'Ames & Sons — forfeited. The pan showed color and the man showed nothing.',
    B: 'Burdett claim — abandoned. The wife took fever at the wells.',
    D: 'Dawson stake — sold for a mule, and glad of the mule.',
    E: 'Eastlake survey — crossed out. The line ran through a burying ground.',
    F: 'Fenn brothers — quit. Gone back to preaching.',
    G: 'Garrett dig — drowned when the wash ran in October.',
    L: 'Loring claim — jumped twice and worth neither jumping.',
    O: 'Ordway & Pryor — dissolved over a horse.',
    R: 'Redmond stake — played out. The seam pinched to nothing.',
    S: 'Slocum diggings — burned. None say by whom.',
    U: 'Upshaw claim — forfeit, for taxes no man else ever paid.',
    W: 'Weaver & Kin — gone to California on the strength of a rumor.',
  },
  informants: [
    { name: 'SERENA', role: 'cook', venue: 'the wells kitchen', alias: 'SERENA' },
    { name: 'IRONS', role: 'farrier', venue: 'the farrier line', alias: 'IRONS' },
    { name: 'BROTHER DILL', role: 'circuit preacher', venue: 'the tent meeting', alias: 'DILL' },
  ],
  herrings: [
    { name: 'MCGREW', trade: 'sells whiskey off a freight wagon', clears: 'was three days gone to Socorro with the mule train, and the train agrees' },
    { name: 'LUNA', trade: 'trades in horses of uncertain provenance', clears: "sat those nights in the alcalde's jail over a gray mare" },
  ],
  details: [
    { phrase: 'roped left-handed', column: 'ropes left-handed',
      counter: 'branded all spring right-handed before forty head and forty men' },
    { phrase: 'wore a Mexican spur on the off boot', column: 'wears a single Mexican spur',
      counter: 'sold his spurs at Socorro; the sutler keeps them in the window yet' },
    { phrase: 'was short two fingers on the bridle hand', column: 'missing fingers, bridle hand',
      counter: 'counts coin with all ten, and men watch him do it and grieve' },
  ],
  nights: [['MON', 'MONDAY'], ['THU', 'THURSDAY'], ['SAT', 'SATURDAY']],
}

// ---------------------------------------------------------------- builder

export const SUPPORTED_ERAS = ['berlin-1938', 'neworleans-1968', 'paris-1954', 'meridian-1849']

export function generateWebCase(seed, era = 'berlin-1938') {
  const make = {
    'berlin-1938': webBerlin,
    'neworleans-1968': webNola,
    'paris-1954': webParis,
    'meridian-1849': webMeridian,
  }[era] ?? webBerlin
  return make(seed)
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
          'Berlin, November. Rain since Tuesday, the slow kind, filing the',
          `city down to its gray. They took ${victim} out of the Landwehr at`,
          `the Möckern bridge on ${nightWord.toLowerCase()} morning — coat buttoned to the`,
          'collar, pockets emptied by somebody with time and a lamp. The',
          'canal does not take men who button their coats. It was handed him.',
          '',
          `For a month ${victim} was ours inside ${office.name}, wearing a`,
          `nobody's face, counting which of its ${office.doc} left by the`,
          'front ledger and which left after dark. Somebody in that building',
          'sells. He got close enough to name the man. The canal is what',
          'closing that last meter cost.',
          '',
          'Four men had the evening side that season. Ask the desk for the',
          'suspect board when you want the four laid out plain.',
          '',
          'SIGNALS holds his final intercept, keyed under his workname the',
          'old way — a keyword walked letter by letter beneath the text.',
          'Find the word and report "decode <word>"; the desk runs the',
          'tables. You supply the insight. That division of labor is the',
          'whole trade.',
          '',
          `    INTERCEPT:  ${cipherText}`,
          '',
          'His lodgings on the Pension Bogler stairs have not been entered;',
          'the landlady notices coins more than questions. Station',
          'streetwork had eyes on the canal path that night — the log',
          `exists, whatever streetwork pretends. And mind ${herring.name} —`,
          `${herring.trade}. He keeps turning up at the edge of this`,
          'like a ring left by a wet glass.',
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
          'The desk keeps a slate for cases like this, and keeps it turned',
          'to the wall. Chalk, four names, no order — order would be an',
          'opinion, and the desk does not spend those:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'Every one of them touched the evening side this season. Every',
          'one of them has a salary that ends on the twentieth of the month',
          'and habits that do not. Nothing on this slate convicts; it only',
          'tells you who the question is about.',
          '',
          'Three things hang a man in this town: the nights, the keys, and',
          'what a witness saw. Bring back a list for each. Lay the three',
          'side by side and one name will stand on all of them — and then',
          'you will wish it were still four names, because a list is clean',
          'and a man is not.',
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
          'Third floor rear, one window on an airshaft, a bed made with',
          'army corners. The landlady takes the coin without looking at it,',
          'which tells you she has been paid in worse currencies. A room',
          'rented by a careful man: no letters, no photographs, a razor and',
          'a clothes brush and a Baedeker with nothing underlined.',
          '',
          'Nothing in writing anywhere. One exception. Under the washstand',
          'lid, in pencil, in a hand that did not hurry:',
          '',
          `  "Paid in person. Always a ${nightWord.toLowerCase()}. Follow the money`,
          `   to the fallback if I stop walking. — ${workname}"`,
          '',
          'If I stop walking. He wrote that and then dried his hands and',
          'went back out into the rain to keep walking, for a while.',
          '',
          'The workname is doing more work than a signature down there.',
          'His intercept is still keyed under it.',
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
          'A dead man\'s fallback is a letter he mailed to whoever proved',
          `smart enough to collect it. ${victim} packed this one for exactly`,
          'this morning — the morning after the canal — and the packing is',
          'as neat as the room on the Bogler stairs. Inside:',
          '',
          '- A tally page in his hand. Payments taken in person, in the',
          `  building, always ${nightAbbr} evenings, past close. Months of them,`,
          '  entered like weather readings: date, amount, initial. A man',
          '  selling his office one drawer at a time, on a schedule, the',
          '  way clerks do everything.',
          `- A note beneath: "Seller stays late. The rota knows. I don't,`,
          '  yet."',
          '',
          'Yet. The word a careful man uses when he can already hear the',
          `water. He never got the rota. You can. ${office.name} keeps a`,
          'duty book for the evening side, and duty books are the last',
          'honest literature in Germany. The desk can reach the rota;',
          'tell it to.',
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
          'A records clerk who owes Station a silence photographed the page',
          'at arm\'s length between rounds, and her arm was steady. You can',
          'see the ruled lines, the initials, the little tyranny of a book',
          'that has been kept the same way since the Kaiser. The evening',
          'column reads:',
          '',
          `  Present past close, ${nightAbbr} evenings, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: Hamburg train, every ${nightAbbr} without fail —`,
          '  conductor stamps on file. Clear of the evenings entirely.',
          '  Whatever he is guilty of, and everyone is guilty of something,',
          '  it did not happen in that building on those nights.',
          '',
          `THE FIRST LIST. The money moved on ${nightAbbr} nights, and these`,
          'three were in the building when it moved. Hold the page',
          'lightly. Two more lists and the name stops being an opinion.',
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
          'Streetwork watchers are paid to be furniture with eyes, and the',
          `one on the canal path was good furniture. He filed three cards on`,
          `${victim}'s last evening, in pencil, in the rain — and then filed`,
          'himself into a beer hall and let the cards ride loose in a coat',
          'pocket for two days. The order is gone. The evening is not.',
          '',
          'A man arrives somewhere before he is met. He is met before one',
          'of the two walks away. Put the cards back in the order the',
          'night spent them, and when you can hear the evening run',
          'straight — "timeline A B C" — say so. The desk will believe you.',
          '',
          ...T.cards,
          '',
          'Read the third card twice. Then read it once more.',
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
          'The canal path in November: black branches, black railing, the',
          'water underneath moving like something that has already been',
          'paid. You walk it at the hour the third card names and the city',
          'obliges with the same rain.',
          '',
          'Between where the second card puts the meeting and where the',
          'third card puts one man walking away, the path kept what the',
          `night dropped: a torn corner of ${office.doc} blank stock —`,
          'evening series, unissued, the serial margin still attached like',
          'a hangnail. It has been rained on for days and it is still',
          'stiffer and whiter than anything the canal path grows on its own.',
          '',
          'Unissued stock does not walk. It does not go out for air. It',
          `lives under lock in ${room}, and ${office.name} keeps a key book`,
          'older than the building and twice as honest. Somebody carried',
          'that paper through a lock. Ask who holds keys, and let the',
          'book do the accusing for a while.',
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
          'There is always one honest book in a dishonest building, and it',
          'is always the dullest one. Nobody falsifies a key book; nobody',
          'believes anyone would ever read it. A clerk copied the page out',
          'for a favor he thinks was about something else, in a hand that',
          'did not ask why:',
          '',
          `  Keys to ${room}, issued and live:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: surrendered his key in March; receipt`,
          '  initialed and filed. No access since — and the receipt is the',
          '  kind of paper a nervous man keeps, which tells its own story,',
          '  none of it yours tonight.',
          '',
          `THE SECOND LIST. The stock on the canal path came out of ${room}`,
          'behind one of three live keys. Set this page beside the rota.',
          'Watch the four names start to thin.',
        ].join('\n'),
      },
    },
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name} receives you in the back of a shop that sells`,
          'nothing anyone buys, with the hospitality of a man who has',
          'rehearsed being innocent so long he is almost good at it.',
          `${herring.trade} — that is his weather, and an hour of his`,
          `company settles the only question that matters: he ${herring.clears}.`,
          'Not our man. Wrong shape of guilt entirely.',
          '',
          `But he traded with ${victim} once, and men like him pay for the`,
          'hour with the one true thing they can spare: "Your courier drank',
          `where he could watch a door — ${informant.venue}. The`,
          `${informant.role} there counts everyone twice and forgets nothing.`,
          'Tell them I did not send you, because I did not."',
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. He keeps both hands where`,
          'you can see them for the whole conversation, which is the',
          'tell of a man whose hands have been elsewhere. Even so, half',
          `an evening closes the question. He ${herring2.clears}.`,
          '',
          'A door that opens on a wall. Every case has two or three, and',
          'the file does not apologize for them. Neither does the city.',
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
          `${informant.venue} at the quiet hour, when the help outnumbers`,
          `the trade. The ${informant.role} works while talking and talks`,
          'in the pauses of the job, eyes making their slow circuit of the',
          'room the way a lighthouse does it — habit, not hope.',
          '',
          `"${victim}? Sat where he could see the door. Tipped like a man`,
          'apologizing for something. Some evenings another man came in',
          'after him — never together, never quite apart either, the way',
          'two boats share a current.',
          '',
          `Ask me what you actually want to know. Ask about ${victim}'s`,
          'man and I will tell you what these eyes took down. They have',
          'been taking things down for thirty years and nobody has ever',
          'paid the storage on it."',
          '',
          'Handle this one gently. There is no second pair of eyes, and',
          'the city is short on thirty-year memories that still work.',
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
          'Given quietly, between coats, in the voice people save for',
          'things they have decided to be rid of:',
          '',
          '"Ordinary coat. Office shoulders — you know them, shoulders',
          'that have carried nothing heavier than a superior\'s mood. He',
          'never gave a name and I never charged him one. But twice I',
          `watched him settle the bill, and both times he ${detail.phrase}.`,
          'You remember hands in my trade. Faces lie for a living.',
          'Hands pay."',
          '',
          `${office.name} keeps personnel particulars on its people —`,
          'hands, habits, war records, the small print of a body. Pull',
          'the particulars and see whose file agrees with thirty years',
          'of eyes.',
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
          'The Reich writes everything down; that is its vanity and,',
          'tonight, your good fortune. Four file cards borrowed by',
          'lamplight and returned before the drawer missed them, the',
          'column that matters copied exact:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per file`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'ONE OF THE THREE LISTS. Lay it on the desk beside the rota and',
          'book. Straighten the pages. Pour whatever is left in the bottle.',
          '',
          'Three lists. Four names. One name standing on all three — and',
          'now you know why the desk keeps the slate turned to the wall:',
          'because the next line on it is a man\'s name, and you are the',
          'one holding the chalk.',
          '',
          'When you are certain, file it: "accuse <name>". Once. The city',
          'does not sell second chances at any counter you can reach.',
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
          'The archive clerk finds the requisition slip exactly where a',
          `dead man filed it, because the dead man filed everything. ${victim}`,
          'requisitioned the office\'s old tally books two days before the',
          'canal — years of evening entries, initialed, the long dull',
          'sediment of a sale that thought itself invisible.',
          '',
          'Whoever sold the stock understood precisely what those old',
          'tallies would show once a careful man laid them side by side',
          'under a good lamp. Two days is about how long it takes to',
          'arrange a canal.',
          '',
          'That is the whole motive. Not passion, not ideology — just',
          'arithmetic, approaching, in a borrowed coat. You are doing the',
          'same arithmetic now, with better cover and the same rain.',
          'Walk more carefully than he did.',
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
          'They take him at his desk, in the morning, before the building',
          'has had its coffee — Station prefers arrests that look like',
          `appointments. ${S.culprit}, ${S.role[S.culprit]}, ${office.name}.`,
          `On the rota for the ${nightAbbr} evenings. Holding a live key to`,
          `${room}. And his file card agrees, in the Reich's own exact`,
          `handwriting, with thirty years of a ${informant.role}'s eyes.`,
          '',
          'Three lists, one name. He understood arithmetic too — he simply',
          'started the sum later than you did, and the man he put in the',
          'canal had already carried the remainder out of the building.',
          '',
          `${victim}'s month inside will hold up in the quiet rooms where`,
          'this goes next; his tally page turns out to be the neatest',
          'evidence anyone in that building ever produced. Station notes',
          'your handling of the asset in the file.',
          '',
          'The file does not say thank you. It never does. Outside, the',
          'rain has moved on to some other quarter of the city, and the',
          'evening desk opens on time, under new management.',
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
      match: (t) => t.includes(informant.alias) || venueMatch(informant.venue)(t),
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
    {
      match: (t) => t.includes(victim),
      response: `${victim} is the case, and the desk answers for its dead: a courier, a careful one, which is why the canal is the loudest thing he ever did. What is known of him you hold in the briefing. Who put him there is four names on a board.`,
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
      'FIELD PROCEDURE — such as it is:',
      '',
      'Write your reports in plain language: go somewhere, ask someone,',
      'check a thing. The desk is literal-minded. The city is not.',
      '',
      'A cipher wants its key word — "decode <word>" — and the tables do',
      'the long division. An evening in pieces wants an order: "timeline',
      'A B C". This case is a web, not a corridor: three trails, three',
      'lists, and the man you want is the one name standing on all',
      'three. When you finally know him, "accuse <name>" — you get to',
      'be certain exactly once. On the bad nights, "review" makes the',
      'desk read the case back to you like a patient bartender.',
      '',
      'Your notebook, on the right, keeps every page you have earned.',
      'Burned contacts stay burned. Mind the heat; this city keeps',
      'its receipts.',
    ].join('\n'),
    opening: [
      'BERLIN — NOVEMBER 1938',
      '',
      'The city wears its lights like a dare. Somewhere under the rain',
      'a courier you trained is being lifted out of a canal by men in',
      'rubber capes, and the man who put him there is keeping office',
      'hours, initialing forms, drinking his coffee while it is hot.',
      '',
      'Four names. Three trails — the money, the paper, and the one',
      'witness nobody ever thought to buy.',
      'Work them the way you were taught: quickly, politely, and',
      'without ever once looking like a man in a hurry.',
    ].join('\n'),
    preamble: [
      'Every document you earn goes into your Case Notebook, on the',
      'right, and nothing you have read can be taken from you. The',
      'people who talk to you are less permanent: handle a source',
      'badly and he is gone for good, along with everything he still',
      'had to say.',
      '',
      'A name set in CAPITALS belongs to the case, the dead man',
      'included — the desk answers for them all. Ask about them, or',
      'go to them. Lowercase names are scenery, or history.',
      '',
      'Write your reports in plain language. Type "help" at any time',
      'for field procedure. Berlin supplies the rest.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),      // alphabetical — the order tells nothing
      columns: ['nights', 'keys', 'witness'],
    },
    lists: { rota: 'the duty rota', keybook: 'the key book', personnel: 'the personnel particulars' },
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
          'New Orleans in summer. Heat that leans on you like a cop with',
          'time to spare, and by late afternoon the light comes off the',
          'river like hammered tin while the palms along Esplanade make',
          `the sound of rain that never shows. The river gave ${victim}`,
          'back at Chalmette after three days of keeping him, which for',
          'that river is sentiment.',
          'Camera gone. Shoes on. Nobody drowns in this town with their',
          'shoes on unless they had help getting to the water.',
          '',
          `He was a stringer — sold pictures to whoever printed first and`,
          'asked questions after. Except the last season he stopped',
          `selling. He spent it photographing what moves through`,
          `${office.name} after midnight, and he saved every frame like a`,
          'man building a church. Men who build churches in this town',
          'get baptized in that river.',
          '',
          `Four men ran the night side of ${office.name}. Ask for the`,
          'suspect board when you want the four laid out plain under the',
          'ceiling fan.',
          '',
          'His last classified column ran the morning he went in the',
          'water. He circled it at the counter, paid for his coffee, and',
          'wrote one line beneath: "first letters, first."',
          '',
          ...ads,
          '',
          'He kept a room on Esplanade, rent paid ahead — a man who paid',
          `ahead knew something about his schedule. And mind ${herring.name}`,
          `— ${herring.trade}. He floats near this the way grease floats,`,
          'without ever quite being the meal.',
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
          'Grease pencil on the glass of a door marked PRIVATE, in an',
          'office where the fan stirs the same heat in circles. Four',
          'names, no order — order costs extra in this town:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'All four had the night side while the river was busy. All four',
          'have city salaries, and two of them have boats. The board',
          'convicts nobody; it only says who the question is about, and',
          'in the First District that is already more than anyone asks',
          'out loud.',
          '',
          'Three things hang a man here: the nights, the cage, and what',
          'a witness saw. Bring back a list for each. Lay the three side',
          'by side under the lamp and one name will hold — the way a',
          'fingerprint holds, whether or not anybody wants it to.',
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
          'A rooming house with a gallery sagging like an old promise,',
          'and a landlady who takes the folded bill and develops a sudden',
          'errand. His room smells of fixer and cigarettes — the cologne',
          'of every man who ever told the truth for a living at the wrong',
          'salary. Developing trays stacked clean. No film anywhere.',
          'A careful man. The film lived somewhere the room did not.',
          '',
          'Behind the armoire mirror, taped flat, in his hand:',
          '',
          `  "Paid in person, always a ${nightWord.toLowerCase()}, always inside.`,
          '   If I go quiet, the ads know the way to the film."',
          '',
          'The ads. First letters, first — his own instruction, left',
          'where only a searcher would find it, mirrored behind the glass',
          'he shaved by. He looked at that tape every morning and went',
          'out anyway. That is either courage or arithmetic, and in his',
          'trade there was never much difference.',
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
          `The camera exchange on ${street} Street sells used Leicas out`,
          'front and privacy out back. The counterman knew him as a',
          'Tuesday face, and in the Quarter a Tuesday face is a character',
          'reference. He slides Box 9 across the counter like it is',
          'nothing, because to him it is, and that is the entire service',
          'he sells. In the box:',
          '',
          `- A payment tally in ${victim}'s hand. Cash, taken in person,`,
          `  inside the District, always ${nightAbbr} nights. A season of it,`,
          '  logged the way he logged exposures: date, amount, light.',
          '- One line beneath, pressed hard enough to tear: "Seller works',
          `  the ${nightAbbr} shift. Duty roster would prove it. Can't reach`,
          '  the roster. — T."',
          '',
          'Can\'t reach the roster. A stringer couldn\'t. You can. The',
          'desk knows a records girl who will go further than the roster',
          'for the memory of a sweet boy who tipped.',
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
          'The records girl believes in overtime and very little else,',
          'which in the First District makes her the closest thing to',
          'clergy. She copies the page in a back stairwell in the time it',
          'takes a cigarette to die, and asks for nothing but silence and',
          'gets both:',
          '',
          `  On the ${nightAbbr} night shift, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: detailed to Baton Rouge every ${nightAbbr}`,
          '  since spring — travel vouchers on file, signed, stamped,',
          '  reimbursed at the state rate. Clear of the nights. Whatever',
          '  he does in Baton Rouge is Baton Rouge\'s problem.',
          '',
          `THE FIRST LIST. The money moved on ${nightAbbr} nights, and these`,
          'three were inside the building when it moved. Fold the page',
          'small. Two more lists and it stops being gossip and starts',
          'being evidence — which in this District is the rarer weather.',
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
          'The radio room keeps carbons the way the river keeps what it',
          'is given — indifferently, and forever. Three entries survive',
          `from the wharf detail on ${victim}'s last night out; the desk`,
          'sergeant\'s coffee got the rest, and the carbons have been',
          'shuffled by every hand that wanted to look busy since.',
          '',
          'A man leaves a bar before he reaches a wharf. A lamp is lit',
          'before it goes dark. Put the night back in the order it was',
          'actually spent; submit "timeline A B C" as you believe it.',
          '',
          ...T.cards,
          '',
          'One set of footsteps leaves the boards. Count the sets that',
          'arrived.',
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
          'The wharf at the Esplanade end, at the hour the carbons name.',
          'The river works its pilings like a jaw. The lamp somebody',
          'reported dark is burning again, which means somebody else',
          'reported it, which means nobody wants to talk about the night',
          'it rested.',
          '',
          'Between where the second entry puts the meeting and where the',
          'third puts one set of footsteps leaving, the boards kept what',
          'the night dropped: a torn evidence sleeve, wax-stamped,',
          `numbered in the District's own series — the kind of paper that`,
          `never leaves ${room}, because the whole point of the cage is`,
          'that its paper stays inside it.',
          '',
          'It left. Paper does not swim, and it did not walk on its own.',
          `${office.name} logs every man with a key to the cage, in a book`,
          'nobody ever bothered to corrupt because nobody ever believed',
          'it would matter. Ask who holds keys, and let it matter.',
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
          'Every dirty building keeps one honest book, and it is always',
          'the one bolted to the dullest wall. Nobody fixes the cage log.',
          'Fixing it would mean admitting it could matter, and the men',
          'who matter in this District have never once been asked to',
          'produce it. Photographed whole, page and all:',
          '',
          `  Keys to ${room}, issued and live:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: key pulled in March after the audit;`,
          '  surrender slip signed. No access since — the audit was',
          '  somebody\'s idea of a warning shot, and he heard it.',
          '',
          `THE SECOND LIST. The sleeve on the boards came out of ${room}`,
          'behind one of three live keys. Set it beside the roster and',
          'watch four names start sweating down to fewer.',
        ].join('\n'),
      },
    },
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name} holds court in the back of a laundry that has`,
          'never washed a shirt, under a fan, behind a sweating glass of',
          `something pale. ${herring.trade} — that is his parish, and he`,
          'ministers to it with the serenity of a man who pays retail',
          'for exactly one cop and gets wholesale service from three.',
          '',
          `An hour of his hospitality settles the question that brought`,
          `you: he ${herring.clears}. Not our man. Wrong pew, wrong church.`,
          '',
          `But he knew ${victim} by sight, and men like him tip in`,
          'information because it is the only currency that never has to',
          `clear a bank: "Your shutterbug drank at ${informant.venue},`,
          `always facing the door. The ${informant.role} there forgets`,
          'nothing. And nobody ever thinks to buy a memory until it is',
          'testifying."',
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. He keeps both hands flat`,
          'on the bar for the whole conversation, which is what a man',
          'does when his hands are usually the subject. Even so, half an',
          `evening closes it out — he ${herring2.clears}.`,
          '',
          'A door that opens on a wall. The Quarter is built out of',
          'them, and the heat makes every one look like it might go',
          'somewhere. It doesn\'t. Buy the beer, thank the man, move.',
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
          `${informant.venue} in the slow hour, when the ice melts faster`,
          `than it sells. The ${informant.role} works while talking and`,
          'keeps both eyes on the room out of a habit older than the',
          'liquor license.',
          '',
          `"${victim}? Sweet boy. Sat where he could see the door — they`,
          'all do, the ones who end up in the river. Tipped like he was',
          'apologizing for the size of his dreams. Some nights a man came',
          'in after him. Never with him. Never far, either. Like a tug',
          'behind a barge.',
          '',
          `Ask me about ${victim}'s man and I will tell you what I saw.`,
          'These eyes are the only thing in this town that still works',
          'for free — everything else went on the city payroll years',
          'ago."',
          '',
          'Handle this one gently. There is no second pair of eyes, and',
          'what the river thinks of witnesses you already know.',
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
          'Given low, over the register, while a glass that was already',
          'clean got polished into a career:',
          '',
          '"City clothes, careful face — the kind of face that practices',
          'being forgettable and almost makes it. He never ordered the',
          'same drink twice, which is its own kind of memorable. But',
          `twice I watched him pay, and both times he ${detail.phrase}.`,
          'Faces lie, cher. Faces lie for a living down here. Hands pay."',
          '',
          'The District keeps personnel jackets on its people — hands,',
          'habits, injuries, the fine print of a body in a city uniform.',
          'Pull the personnel jackets and see whose fine print agrees',
          'with the bar.',
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
          'The city writes its people down the way it does everything —',
          'lazily, in triplicate, and forever. Four jackets borrowed for',
          'the length of one cigarette and returned to the drawer that',
          'never knew, the column that matters copied exact:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per jacket`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'ONE OF THE THREE LISTS. Lay it out under the fan beside the',
          'and the cage log. Weight the corners with the bottle and the',
          'glass. Let the fan turn a few times.',
          '',
          'Three lists. Four names. One name on all three — and it has',
          'been on all three since before you got here; all you did was',
          'stop the paper from being strangers to each other.',
          '',
          'When you are certain, file it: "accuse <name>". Once. In this',
          'town the second chance is the thing that floats.',
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
          'The Item\'s morgue clerk finds the request slips exactly where',
          'a dead man filed them, because the dead man filed everything —',
          'that is what got him killed and it is also what is going to',
          `convict somebody. ${victim} had queried the morgue for every`,
          'unloading logged at the Esplanade wharf this season, dates and',
          'tonnage, the paper\'s own gray record of what officially came',
          'off the river.',
          '',
          'He was two nights from laying his payment tally against the',
          'shipping columns and watching the dates shake hands. Two',
          'nights is about how long it takes to borrow a boat.',
          '',
          'That is the whole motive. Not hate. Not a woman. Just a sum',
          'coming due, in city shoes. You are running the same numbers',
          'now with better protection and the same river. Run them',
          'faster than he did.',
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
          'The federal men take him at shift change, in the parking lot,',
          'between his car and the door — the one stretch of ground in',
          `this town the District doesn't own. ${S.culprit},`,
          `${S.role[S.culprit]}, ${office.name}. On the roster for the`,
          `${nightAbbr} nights. Holding a live key to ${room}. And his jacket`,
          'agrees, in the city\'s own lazy triplicate, with what a pair of',
          `thirty-year eyes watched his hands do at the bar.`,
          '',
          'Three lists, one name. He ran the arithmetic too — he just',
          'assumed the paper would stay strangers, because in this town',
          'it always had.',
          '',
          `${victim}'s film comes up out of Box 9 and into the federal`,
          'record, every frame a church window. The case might even hold,',
          'which in New Orleans qualifies as weather worth remarking on.',
          '',
          'The river keeps what it is given. So, it turns out, do you.',
          'Somewhere on Esplanade a landlady re-lets a room that smells',
          'faintly of fixer, and the fan keeps turning the same heat.',
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
      match: (t) => t.includes(informant.alias) || venueMatch(informant.venue)(t),
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
    {
      match: (t) => t.includes(victim),
      response: `${victim} shot the Quarter for anyone who paid and a few who never did, and the river kept his camera to prove a point. What the desk holds on him is in your briefing. Who put him in the water is four names, and three trails will thin them.`,
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
      'PROCEDURE — as much of it as survives the humidity:',
      '',
      'Write your reports in plain language: go somewhere, ask someone,',
      'check a thing. The desk is literal-minded. The Quarter is not.',
      '',
      'His ads are a message — first letters, first — read the column',
      'down its left edge. A night in pieces wants an order: "timeline',
      'A B C". This case is a web, not a corridor: three trails, three',
      'lists, and your man is the one name standing on all three. When',
      'you finally know him, "accuse <name>" — you get to be certain',
      'exactly once. On the slow afternoons, "review" makes the desk',
      'read the case back like a bartender who has heard worse.',
      '',
      'Your notebook, on the right, keeps every page you have earned.',
      'Burned contacts stay burned. Mind the heat; in this town it',
      'has a badge.',
    ].join('\n'),
    opening: [
      'NEW ORLEANS — SUMMER 1968',
      '',
      'Evening comes off the river the color of a bruise going yellow,',
      'and the Quarter lights its neon the way a man lights the next',
      'cigarette off the last one. Cicadas in the crepe myrtles. Rain',
      'somewhere that never quite arrives.',
      '',
      'The river gave back a photographer this week, which is more',
      'than this town usually returns. It kept his camera. Four names',
      'ran the night side; three trails will cut them down to one —',
      'the money, the paper, and one witness who never once went on',
      'anybody\'s payroll.',
    ].join('\n'),
    preamble: [
      'Every document you earn goes into your Case Notebook, on the',
      'right, and what you have read stays yours. The people who talk',
      'to you are not so durable: mishandle a source and they are gone',
      'for good, with everything they still had to say.',
      '',
      'A name in CAPITALS belongs to the case, the dead included:',
      'ask about them, or go find them. The rest is history.',
      '',
      'Write your reports in plain language. Type "help" at any time',
      'for the house rules. The Quarter teaches the rest of it, and',
      'collects tuition nightly.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),      // alphabetical — the order tells nothing
      columns: ['nights', 'cage', 'witness'],
    },
    lists: { rota: 'the duty roster', keybook: 'the cage log', personnel: 'the personnel jackets' },
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-nola-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-nola-${seed}` }),
    },
  }
}

// ------------------------------------------------------------ Paris 1954
// The voice: lucid, unhurried, a little pitiless — a man describing his
// own city as though he had just been acquitted of it.

function webParis(seed) {
  const rand = mulberry32(hash('webparis|' + String(seed)))
  const ERA = 'paris-1954'
  const CASE_ID = `web:${ERA}:${seed}`

  const S = dealSuspects(rand, WEB_PARIS.surnames, WEB_PARIS.roles)
  const victim = pick(rand, WEB_PARIS.victims)
  const workname = pick(rand, WEB_PARIS.worknames)
  const drop = pick(rand, WEB_PARIS.drops)
  const office = pick(rand, WEB_PARIS.offices)
  const room = office.room
  const informant = pick(rand, WEB_PARIS.informants)
  const [herring, herring2] = pickN(rand, WEB_PARIS.herrings, 2)
  const detail = pick(rand, WEB_PARIS.details)
  const [nightAbbr, nightWord] = pick(rand, WEB_PARIS.nights)
  const cipherPlain = drop.plain.replace(/[^A-Z]/g, '')
  const cipherText = vigenere(cipherPlain, workname)
  const T = dealTimeline(rand, [
    { time: '23:20', label: `Subject ${victim} leaves the Blue Cellar, satchel carried like a thought` },
    { time: '23:55', label: `Subject is met under the viaduct arches by a man who came from ${office.name}` },
    { time: '00:40', label: 'One man walks back toward the lights. The river does not remark on it' },
  ])

  const scopes = {
    briefing: {
      name: `Case Briefing — ${victim}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `BRIEFING — ${victim}, RECOVERED AT THE PONT DE BERCY`,
        body: [
          'Paris, winter. The light comes late and leaves early, as if it',
          `too were owed money. The river returned ${victim} at the Pont de`,
          `Bercy on ${nightWord.toLowerCase()} morning, and the Seine was neither cruel`,
          'nor kind about it. Rivers are honest that way. It is one of the',
          'few honest things left in this arrondissement.',
          '',
          `${victim} had spent the autumn inside ${office.name}, quietly`,
          `counting which of its ${office.doc} were sold after hours and by`,
          'whom. He was not a brave man. He was something rarer — an exact',
          'one. The exactness is what they could not forgive.',
          '',
          'Four men kept the evening side that season. Ask the desk for',
          'the suspect board when you are ready to look at them without',
          'blinking.',
          '',
          'His last intercept is keyed under his workname, the old way — a',
          'keyword walked beneath the text. Find the word and report',
          '"decode <word>"; the desk runs the tables without an opinion.',
          '',
          `    INTERCEPT:  ${cipherText}`,
          '',
          'He kept a room at the Hôtel Corvisart; nobody has been in. The',
          'DST kept a watch on the viaduct arches that night — their log',
          `exists, whatever they say at lunch. And mind ${herring.name} —`,
          `${herring.trade}. He appears in this story the way a stain`,
          'appears on a good coat: noticed, resented, probably innocent.',
          '',
          `— The desk. (Registry: ${victim}, workname ${workname}.)`,
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
          'Four names on a card, in no order. Order would be a verdict,',
          'and verdicts are cheap here; the city hands them out at every',
          'café table by ten in the morning:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'Each of them held the evening side. Each of them is, in the',
          'usual sense, a decent man — which is to say the question has',
          'never before been put to him with the lights on.',
          '',
          'Three things will put it plainly: the nights, the keys, and',
          'what a witness saw. Bring back a list for each. One name will',
          'remain when the others have finished excusing themselves.',
        ].join('\n'),
      },
    },
    room: {
      name: 'The Room — Hôtel Corvisart',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: `THE ROOM AT THE CORVISART — WHAT ${victim} KEPT`,
        body: [
          'A hotel room in winter, rented by the month: a bed, a basin, a',
          'window giving onto a courtyard where the light arrives secondhand.',
          'The concierge accepts the folded note the way the river accepts',
          'the rain — without comment, without memory.',
          '',
          'He owned almost nothing, and what he owned was clean. Nothing in',
          'writing anywhere, except once, in pencil, inside the wardrobe door:',
          '',
          `  "Paid in person. Always a ${nightWord.toLowerCase()}. If I stop coming`,
          `   back, the money knows the way. — ${workname}"`,
          '',
          'If I stop coming back. A man writes that, closes the wardrobe,',
          'and goes out to keep his appointments anyway. There is a word',
          'for that. It is not courage and it is not despair. It is',
          'lucidity, and it does not save anyone.',
          '',
          'The workname is still the key to his intercept.',
        ].join('\n'),
      },
    },
    stash: {
      name: `The Fallback — ${drop.place}`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'station',
        title: `THE FALLBACK — ${drop.plain}`,
        body: [
          `${drop.place}: a numbered ticket, a shelf, the smell of other`,
          "people's luggage. A dead man's fallback is a letter addressed",
          'to whoever proves patient enough to deserve it. Inside:',
          '',
          '- A tally in his exact hand: payments taken in person, in the',
          `  building, always ${nightAbbr} evenings, after the doors were`,
          '  locked. A season of entries, dated like small verdicts.',
          `- Beneath, one line: "The seller stays late. The duty roster`,
          '  would say who. I have not managed the roster."',
          '',
          'He had not managed the roster. You can manage it: the desk',
          'knows a clerk in that building who prefers arithmetic to',
          'loyalty. Tell the desk to check the roster.',
        ].join('\n'),
      },
    },
    rota: {
      name: `${office.name} — Duty Roster`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `DUTY ROSTER — ${office.name.toUpperCase()}, ${nightAbbr} EVENINGS`,
        body: [
          'Copied in a stairwell in the time it takes to smoke half a',
          'cigarette and regret the other half. The evening column:',
          '',
          `  Present after close, ${nightAbbr} evenings, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: the Lyon train, every ${nightAbbr} without`,
          '  exception — conductor stamps on file. Whatever he is guilty',
          '  of, and no one here is guilty of nothing, it happened in',
          '  another city.',
          '',
          `THE FIRST LIST. The money moved on ${nightAbbr} nights; these`,
          'three were in the building. Do not decide anything yet. The',
          'temptation to decide early is how this city stays crowded',
          'with wrong verdicts.',
        ].join('\n'),
      },
    },
    watcherlog: {
      name: 'DST Watch Log',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'WATCH LOG — VIADUCT ARCHES, THREE ENTRIES, ORDER LOST',
        body: [
          'The DST watcher wrote three entries in the rain and then went',
          'somewhere drier to be discreet about them. The order is lost;',
          'the night is not. A man leaves a cellar before he is met under',
          'an arch. He is met before one of the two walks away.',
          '',
          'Put the entries back in the order the night spent them, and',
          'when you can hear it run straight — "timeline A B C" — say so.',
          '',
          ...T.cards,
          '',
          'Read the last one again. The river does not remark on it.',
          'Somebody must.',
        ].join('\n'),
      },
    },
    site: {
      name: 'The Arches',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: 'UNDER THE VIADUCT — WHAT THE NIGHT LEFT',
        body: [
          'The arches at the hour the log names. Wet stone, the smell of',
          'trains, the particular silence of a place where the city has',
          'agreed not to look. You stand where he stood. The lights across',
          'the river go on being beautiful, which feels, tonight, like a',
          'lack of tact.',
          '',
          'Between the meeting and the walking-away, the stones kept what',
          `fell: a torn corner of ${office.doc} stock — unissued, the`,
          'serial margin still attached, whiter than anything the arches',
          'grow on their own.',
          '',
          `Unissued stock does not go for walks. It lives locked in ${room},`,
          `and ${office.name} keeps a key register older than the Republic`,
          'and considerably more stable. Ask who holds keys.',
        ].join('\n'),
      },
    },
    keybook: {
      name: `${office.name} — Key Register`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `KEY REGISTER — ${room.toUpperCase()}`,
        body: [
          'Every institution keeps one honest book, and it is always the',
          'one nobody thought worth corrupting. The key register, copied',
          'entire by a clerk who asked no questions because he preferred',
          'not to own the answers:',
          '',
          `  Keys to ${room}, issued and live:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: surrendered his key in March; the receipt`,
          '  is initialed, dated, filed. He kept the receipt\'s carbon in',
          '  his wallet — a man who knows what cities do to the unproven.',
          '',
          `THE SECOND LIST. The stock under the arches came out of ${room}`,
          'behind one of three live keys. Lay this beside the roster and',
          'watch the four begin to be fewer.',
        ].join('\n'),
      },
    },
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name} receives you above a shuttered shop, among`,
          `maps of countries that have changed their names. ${herring.trade}`,
          '— that is his trade, and he practices innocence the way other',
          'men practice the violin: daily, badly, with feeling.',
          '',
          `An hour settles the question you brought: he ${herring.clears}.`,
          'Not your man. The wrong shape of guilt entirely.',
          '',
          `But he knew ${victim}, and he pays for the hour with the one`,
          `true thing he has: "Your exact friend drank at ${informant.venue},`,
          `always facing the door. The ${informant.role} there has eyes`,
          'that do not forgive and do not forget, which in this city',
          'makes her a kind of saint."',
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. He answers every question`,
          'a beat too quickly, the way innocent men do when they have',
          'been innocent before and found it insufficient. Even so, half',
          `an evening closes it: he ${herring2.clears}.`,
          '',
          'A door that opens on a wall. The city is full of them, and',
          'the city does not apologize. It has never once apologized.',
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
          `${informant.venue} in the dead hour, when the saxophone has`,
          'gone home and the chairs are up and the room admits what it',
          `is. The ${informant.role} works while she talks, eyes making`,
          'their circuit of the room without hope and without rest.',
          '',
          `"${victim}? He sat where he could see the door. He tipped like`,
          'a man settling accounts before a journey. Some evenings',
          'another man came in after him — never with him, never far.',
          'Two men pretending not to share a secret look exactly like',
          'two men sharing one. It is the first thing this job teaches.',
          '',
          `Ask me about ${victim}'s man and I will tell you what I saw.`,
          'I have no reason to lie. Having no reason to lie is the only',
          'luxury this cloakroom affords."',
          '',
          'Handle her gently. There is no second pair of eyes like these.',
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
          'Given at the counter, in the voice of someone laying down a',
          'small burden she has carried longer than she meant to:',
          '',
          '"A gray coat, a careful face — the kind of face that has',
          'practiced being no one and nearly graduated. He never gave a',
          'name. But twice I watched him settle his bill, and both times',
          `he ${detail.phrase}. Faces are compositions, monsieur. Hands`,
          'are confessions."',
          '',
          `${office.name} keeps personnel particulars — hands, habits,`,
          'the small clauses of a body in a government suit. Pull the',
          'particulars and see whose file confesses along with him.',
        ].join('\n'),
      },
    },
    personnel: {
      name: `${office.name} — Personnel Particulars`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'PERSONNEL PARTICULARS — EVENING SIDE',
        body: [
          'The Republic files its servants in triplicate and forgets',
          'where it put them. Four cards, borrowed and returned between',
          'rounds of the corridor clock, the column that matters copied',
          'exact:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per file`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'ONE OF THE THREE LISTS. Lay it beside the roster and the register.',
          'Three lists, four names, one name on all three — and it was',
          'on all three before you ever came to this city. All you have',
          'done is refuse to look away, which is more than most manage.',
          '',
          'When you are certain, file it: "accuse <name>". Once. Be',
          'exact. Exactness is what the dead man paid for; spend it well.',
        ].join('\n'),
      },
    },
    motive: {
      name: 'The Registry — Old Counterfoils',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'REGISTRY PULL — WHY THE EXACT MAN STOPPED COMING BACK',
        body: [
          `The registry clerk finds ${victim}'s requisition slips exactly`,
          'where he filed them, because he filed everything; exactness',
          'was his whole rebellion. Two days before the river, he called',
          'up the old counterfoils — years of evening issues, initialed,',
          'the long sediment of a sale that believed itself invisible.',
          '',
          'Whoever sold understood what the counterfoils would show once',
          'an exact man laid them side by side under a good lamp. Two',
          'days is roughly what it costs, in this city, to arrange a',
          'river.',
          '',
          'That is the entire motive. Not passion. Not politics, though',
          'politics will be blamed. Merely a sum, approaching, in a gray',
          'coat. You are the sum now. Approach faster than he did.',
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
          'They take him at his desk in the gray of the morning, between',
          'the first coffee and the second, which is when men of habit',
          `are most easily led away. ${S.culprit}, ${S.role[S.culprit]},`,
          `${office.name}. On the roster for the ${nightAbbr} evenings.`,
          `Holding a live key to ${room}. His file card agreeing, in the`,
          `Republic's own patient ink, with what a ${informant.role}'s`,
          'unforgiving eyes watched his hands confess.',
          '',
          'He does not protest. Men like him have spent so long not being',
          'asked that when the question finally arrives they greet it',
          'almost with relief, like a train that is merely late.',
          '',
          `${victim}'s tally holds. His exactness convicts where outrage`,
          'could not have. The desk notes your handling in the file, and',
          'the file, as always, says nothing further.',
          '',
          'Outside, the lights along the river go on being beautiful.',
          'The Seine remains neither cruel nor kind. One goes home. One',
          'imagines, with some effort, that justice and the winter light',
          'are enough. Some mornings they very nearly are.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'board', requires: ['briefing'],
      lead: 'The desk will lay out the suspect board when asked.',
      match: (t) => t.includes('SUSPECT') || t.includes('BOARD') || (t.includes('FOUR') && t.includes('MEN')),
      response: 'The desk lays the card flat and turns it toward you.',
    },
    {
      to: 'room', requires: ['briefing'],
      lead: `${victim} kept a room at the Hôtel Corvisart. Nobody has been in.`,
      match: (t) => t.includes('CORVISART') || t.includes('HOTEL') || t.includes('LODGING'),
      response: 'The concierge accepts the note and develops a sudden interest in her ledger.',
    },
    {
      to: 'stash', requires: ['briefing'],
      lead: 'The intercept waits on a key word: "decode <word>" and the desk runs the tables.',
      answerKey: `The decoded intercept reads ${drop.plain} — ${drop.place}.`,
      match: tokenMatch(drop.tokens),
      response: 'The ticket is honored without a glance. Some machinery in this city still works.',
    },
    {
      to: 'rota', requires: ['stash'],
      lead: `The tally pays ${nightAbbr} evenings; nobody has managed the duty roster.`,
      match: (t) => t.includes('ROSTER') || t.includes('ROTA') || t.includes('DUTY'),
      response: 'The clerk who prefers arithmetic to loyalty copies the page between rounds.',
    },
    {
      to: 'watcherlog', requires: ['briefing'],
      lead: 'The DST watched the viaduct arches that night. Their log exists.',
      match: (t) => t.includes('DST') || t.includes('WATCH') || t.includes('ARCHES'),
      response: 'The log arrives by a route it would be indelicate to describe.',
    },
    timelineEdge(T.answer, {
      to: 'site', requires: ['watcherlog'],
      lead: 'Three watch entries wait to be put in order: "timeline A B C".',
      answerKey: `The correct order of the watch entries is ${T.answer.split('').join(' ')}.`,
      response: 'Leaves, is met, and one man walking back toward the lights — the night runs straight, and the arches will show you where.',
      failResponse: 'Ordered so, the night contradicts itself: a man cannot be met before he arrives. (Heat rises.)',
    }),
    {
      to: 'keybook', requires: ['site'],
      lead: `Unissued stock lives locked in ${room}. Nobody has asked who holds keys.`,
      match: (t) => t.includes('KEY'),
      response: 'The register is produced with the pride of the one honest book in the building.',
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `The desk flagged ${herring.name} — ${herring.trade}. Worth an hour, possibly.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} receives you with the composure of a man who has rehearsed this visit.`,
    },
    {
      to: 'herring2', requires: ['briefing'],
      lead: `A second name circles this: ${herring2.name}, ${herring2.trade}.`,
      match: (t) => t.includes(herring2.name),
      response: `${herring2.name} answers everything a beat too quickly, which answers most of it.`,
    },
    {
      to: 'informant', requires: ['herring'],
      lead: `${herring.name} pointed at ${informant.venue}: the ${informant.role} there forgets nothing.`,
      match: (t) => t.includes(informant.alias) || venueMatch(informant.venue)(t),
      response: `${informant.venue}, the dead hour. The chairs are up, and the eyes ${victim} trusted are waiting.`,
    },
    {
      to: 'statement', requires: ['informant'],
      lead: `The ${informant.role} is waiting to be asked about ${victim}'s man.`,
      match: (t) => t.includes(victim),
      response: 'She sets down what she is holding, and the statement comes out level and exact.',
    },
    {
      to: 'personnel', requires: ['statement'],
      lead: `A witness detail wants checking: pull ${office.name}'s personnel particulars.`,
      match: (t) => t.includes('PERSONNEL') || t.includes('PARTICULARS') || t.includes('STAFF'),
      response: 'Four cards, copied between rounds of the corridor clock, returned unmissed.',
    },
    {
      to: 'motive', requires: ['rota', 'keybook'],
      lead: 'Two lists in hand. The registry can still say why the exact man stopped coming back.',
      match: (t) => t.includes('REGISTRY') || t.includes('COUNTERFOIL') || t.includes('MOTIVE') || t.includes('WHY'),
      response: 'The registry clerk finds the slips exactly where a dead man filed them.',
    },
  ]

  const accusation = {
    culprit: S.culprit,
    wrong: [...S.suspects.slice(1), herring.name, herring2.name, informant.alias],
    unlocks: 'resolution',
    correctResponse: 'The desk moves before the second coffee.',
    wrongResponse: (name) =>
      `They take ${name} in the gray of the morning, and by noon he has ` +
      'proven what you could have proven: one list is not three. The seller ' +
      'reads about it over lunch, pays exactly, and leaves no tip. The file ' +
      'closes unresolved.',
  }

  const burnTriggers = {
    press: {
      scope: 'informant',
      match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes(informant.alias),
      reason: 'Contact compromised: subject pressed at her place of work. Do not approach again.',
      response: 'You lean, and the room goes quiet in the particular way of rooms that have decided about you. By closing time the arrangement is over.',
    },
    heatThreshold: 80,
    heatReason: 'Contact compromised: attention exceeded what the quarter tolerates. Severed.',
  }

  const npcs = {
    informant: {
      aliases: [informant.alias],
      fallback: `The ${informant.role} continues her work and waits, without hope and without impatience, for a better question.`,
      lines: [
        {
          match: (t) => t.includes(victim),
          disposition: 1,
          response: `"${victim} once asked whether I was happy. Nobody asks the cloakroom. I have thought about him since more than the question deserved."`,
        },
        {
          match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY'),
          heat: 5,
          response: 'She looks at the money the way one looks at weather through glass, and leaves it on the counter. (Heat rises.)',
        },
      ],
    },
  }

  const hints = [
    {
      match: (t) => t.includes(workname),
      response: `${workname} is the key, not the message. Lay it under the intercept, letter by letter: "decode ${workname.toLowerCase()}".`,
    },
    {
      match: (t) => t.includes('CIPHER') || t.includes('INTERCEPT') || t.includes('VIGENERE'),
      response: `${victim} keyed the old way — a running keyword beneath the text. His workname is in the briefing's last line.`,
    },
    {
      match: (t) => t.includes('LIST') || t.includes('INTERSECT') || t.includes('CROSS'),
      response: 'Three lists: the roster, the register, the particulars. Four names. Your man is the one name that remains on all three.',
    },
    {
      match: (t) => t.includes(victim),
      response: `${victim} was an exact man, and the Seine returned him exactly. What is known of him, you hold already. What is owed him is a name — four kept the evening side, and the board has them.`,
    },
  ]

  const walkthrough = [
    'show me the suspect board',
    'go to the hotel corvisart',
    `decode ${workname.toLowerCase()}`,
    `check the duty roster for ${nightWord.toLowerCase()} evenings`,
    'pull the dst watch log',
    `timeline ${T.answer.split('').join(' ').toLowerCase()}`,
    `who holds keys to ${room}`,
    `ask about ${herring.name.toLowerCase()}`,
    `ask about ${herring2.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and find ${informant.alias.toLowerCase()}`,
    `ask about ${victim.toLowerCase()}'s man`,
    'pull the personnel particulars',
    'registry: why did he stop coming back',
    `accuse ${S.culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, TITLE: 'The Blue Hour', scopes, edges, accusation, burnTriggers, npcs, hints,
    cipher: { ciphertext: cipherPlain, key: workname, to: 'stash' },
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'PROCEDURE — what little of it survives the winter:',
      '',
      'Write your reports plainly: go somewhere, ask someone, check a',
      'thing. The desk is literal-minded. The city is not, and never',
      'claimed to be.',
      '',
      'A cipher wants its key word — "decode <word>" — and the tables',
      'do the arithmetic. A night in pieces wants an order: "timeline',
      'A B C". This case is a web: three trails, three lists, and your',
      'man is the one name standing on all three. When you are certain,',
      '"accuse <name>" — certainty is spent exactly once. On the gray',
      'afternoons, "review" makes the desk read the case back to you',
      'without reproach.',
      '',
      'Your notebook, on the right, keeps every page you have earned.',
      'Burned contacts stay burned. Mind the heat; this city notices',
      'everything and forgives at its own rates.',
    ].join('\n'),
    opening: [
      'PARIS — WINTER 1954',
      '',
      'The light comes late and leaves early, and between those hours',
      'the city conducts its real business. The river returned an exact',
      'man at the Pont de Bercy this week, and the Seine was neither',
      'cruel nor kind about it — rivers are honest; it is one of the',
      'few honest things left here.',
      '',
      'Four names kept the evening side. Three trails will reduce them',
      'to one: the money, the paper, and a witness in a cloakroom who',
      'does not forgive and does not forget.',
    ].join('\n'),
    preamble: [
      'Every document you earn goes into your Case Notebook, on the',
      'right, and what you have read is yours for good. The people who',
      'talk to you are more fragile than paper: mishandle a source and',
      'she is lost, along with everything she still had to say.',
      '',
      'A name in CAPITALS belongs to the case, the dead man not',
      'least — ask about them, or call on them. The rest belong to',
      'the past.',
      '',
      'Write your reports in plain language. Type "help" at any time',
      'for procedure. The city supplies everything else, at its rates.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),
      columns: ['nights', 'keys', 'witness'],
    },
    lists: { rota: 'the duty roster', keybook: 'the key register', personnel: 'the personnel particulars' },
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-paris-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-paris-${seed}` }),
    },
  }
}

// --------------------------------------------------------- Meridian 1849
// The voice: spare and geologic. The country itself is the witness and
// it testifies slowly and it has never once been cross-examined.

function webMeridian(seed) {
  const rand = mulberry32(hash('webmeridian|' + String(seed)))
  const ERA = 'meridian-1849'
  const CASE_ID = `web:${ERA}:${seed}`

  const S = dealSuspects(rand, WEB_MERIDIAN.surnames, WEB_MERIDIAN.roles)
  const victim = pick(rand, WEB_MERIDIAN.victims)
  const word = pick(rand, WEB_MERIDIAN.words)
  const room = WEB_MERIDIAN.room
  const informant = pick(rand, WEB_MERIDIAN.informants)
  const [herring, herring2] = pickN(rand, WEB_MERIDIAN.herrings, 2)
  const detail = pick(rand, WEB_MERIDIAN.details)
  const [nightAbbr, nightWord] = pick(rand, WEB_MERIDIAN.nights)
  const ledgerLines = word.split('').map(L => `  ${WEB_MERIDIAN.ledger[L]}`)
  const T = dealTimeline(rand, [
    { time: '21:00', label: `Subject ${victim} passes the pickets outbound, assay pouch on the belt` },
    { time: '22:10', label: 'Subject is met at the dry wash by a man come down from the company tents' },
    { time: '23:30', label: 'One man comes back through the pickets. The pouch does not' },
  ])

  const scopes = {
    briefing: {
      name: `Company Letter — ${victim}`,
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: `COMPANY LETTER — ${victim}, ASSAYER. FOUND IN THE DRY WASH.`,
        body: [
          'The buzzards told it first, wheeling over the wash below the',
          `survey stakes, and the men who rode out found ${victim} face`,
          'down in the country he had spent a year measuring. The desert',
          'had already begun its bookkeeping. It keeps the only honest',
          'ledger out here and it balances every night.',
          '',
          `${victim} assayed for the company and signed what he weighed.`,
          `Someone in the company tents has been selling ${WEB_MERIDIAN.doc}`,
          'against ore that never was, and the assayer had taken to',
          'weighing more than ore. A man who counts what other men would',
          'rather not have counted is a man walking out his string.',
          '',
          'Four men held the company side this season. Ask for the',
          'suspect board and look at them in the light there is.',
          '',
          'His claims ledger sits with this letter. He crossed out dead',
          'claims all season and beneath the crossings he wrote: first',
          'letters, first. The ledger reads so:',
          '',
          ...ledgerLines,
          '',
          `He bunked in the survey tent, rent owed to no man. And mind`,
          `${herring.name} — ${herring.trade}. He rides the edge of this`,
          'the way coyotes ride the edge of a fire.',
        ].join('\n'),
      },
    },
    board: {
      name: 'The Suspect Board',
      burnable: false,
      payload: {
        kind: 'dossier', scene: 'office',
        title: 'FOUR MEN — THE COMPANY SIDE',
        body: [
          'Charcoal on the back of a survey sheet. Four names and no',
          'order to them, for the country confers no order on men, it',
          'only receives them:',
          '',
          ...S.suspects.map(n => `  ${n} — ${S.role[n]}`),
          '',
          'All four held the company side while the certificates moved.',
          'All four have eaten at the same fire as the dead man. Out',
          'here that means less than it would anywhere else and it never',
          'meant much anywhere.',
          '',
          'Three things will name a man: the nights, the strongbox, and',
          'what a witness saw. Bring back a list for each. One name will',
          'stand when the wind has taken the others.',
        ].join('\n'),
      },
    },
    room: {
      name: 'The Survey Tent',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: `THE SURVEY TENT — WHAT ${victim} KEPT`,
        body: [
          'A cot, a transit, a bible unread and a ledger read to pieces.',
          'The tent smells of tallow and iron gall ink. Whatever a man',
          'owns out here he owns against the wind\'s opinion, and the',
          'wind had been through before you.',
          '',
          'Sewn inside the cot canvas, in his surveyor\'s hand:',
          '',
          `  "Paid in coin, in camp, always a ${nightWord.toLowerCase()}. If I`,
          '   do not come back the ledger knows the way. First letters,',
          '   first."',
          '',
          'If I do not come back. He sewed that into his bed and lay',
          'down on it every night thereafter and rose every morning and',
          'went out to his stakes. Call that what you will. The country',
          'does not call it anything.',
        ].join('\n'),
      },
    },
    stash: {
      name: `The Cairn — the ${word} claim`,
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: `THE CAIRN ON THE ${word} CLAIM — WHAT HE BURIED`,
        body: [
          `The ${word.toLowerCase()} claim, dead since the ledger says so, and on`,
          'its high corner a cairn no prospector built — the stones too',
          'neat, the packrat gone from under them. Beneath:',
          '',
          '- A tally in the assayer\'s hand. Coin taken in camp, in',
          `  person, always ${nightAbbr} nights, the season long. Entered`,
          '  like weights: date, amount, the same one initial he would',
          '  not commit to a name.',
          '- One line beneath: "Seller keeps the night watch. The work',
          '  rolls would show it. The clerk keeps the rolls from me."',
          '',
          'The clerk cannot keep the rolls from you. Ask the company',
          'for the work rolls and see who held the watch.',
        ].join('\n'),
      },
    },
    rota: {
      name: 'The Company — Work Rolls',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `WORK ROLLS — ${nightAbbr} NIGHTS, THE SEASON`,
        body: [
          'The rolls, copied by lantern while the copyist\'s conscience',
          'and his fear of God fought to a draw. The night-watch column:',
          '',
          `  Holding the camp watch, ${nightAbbr} nights, this season:`,
          ...S.nightSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.nightCleared}: rode escort to Socorro every ${nightAbbr}`,
          '  since the spring muster — the manifests carry his name in',
          '  three hands. Whatever he owes God it was not owed here on',
          '  those nights.',
          '',
          `THE FIRST LIST. The coin moved on ${nightAbbr} nights and these`,
          'three kept the camp while it moved. Fold the page against',
          'the dust. Two lists more and the name is no longer yours to',
          'choose.',
        ].join('\n'),
      },
    },
    watcherlog: {
      name: 'The Picket Log',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'street',
        title: 'PICKET LOG — HIS LAST NIGHT. THE PAGES LOOSE.',
        body: [
          'The pickets keep a log because the captain requires it and',
          'they keep it badly because the desert requires nothing. Three',
          'entries survive from the assayer\'s last night, the pages',
          'loose and the order gone with whatever wind took it.',
          '',
          'A man goes out before he is met. He is met before one of the',
          'two comes back. Set the entries in the order the night spent',
          'them — "timeline A B C" — and say it plain.',
          '',
          ...T.cards,
          '',
          'Read the last entry twice. The pouch does not come back.',
          'Neither does the man who carried it. Only one thing returns',
          'and it walks on two legs through your pickets.',
        ].join('\n'),
      },
    },
    site: {
      name: 'The Dry Wash',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'yard',
        title: 'THE DRY WASH — WHAT THE COUNTRY KEPT',
        body: [
          'The wash at the hour the log names, the light gone red along',
          'the survey line and the stakes standing their small crooked',
          'watch. The country keeps what falls on it. It has kept bones',
          'older than any flag men have carried across it and it will',
          'keep this too.',
          '',
          'In the sand where the meeting stood: a certificate blank,',
          `torn at the corner — company stock, unissued, the seal margin`,
          'still on it. Paper that white has no business in that wash.',
          `Unissued certificates live in ${room} under lock, and the`,
          'company logs every key in the strongbox ledger.',
          '',
          'Ask who holds keys. The ledger has no reason to lie. Nothing',
          'out here has a reason to lie except men.',
        ].join('\n'),
      },
    },
    keybook: {
      name: 'The Strongbox Ledger',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: `STRONGBOX LEDGER — ${room.toUpperCase()}`,
        body: [
          'The one book in camp no man ever thought to fear, copied',
          'entire:',
          '',
          `  Keys to ${room}, issued and carried:`,
          ...S.accessSet.map(n => `    ${n} — ${S.role[n]}`),
          '',
          `  ${S.accessCleared}: gave up his key at the spring audit;`,
          '  the surrender is entered and witnessed. He has not been',
          '  inside the tent since and has said so often enough that',
          '  men have begun to believe him, which out here is evidence',
          '  of a kind.',
          '',
          'THE SECOND LIST. The blank in the wash came out of that tent',
          'behind one of three keys. Set this beside the rolls. Watch',
          'the four names weather down.',
        ].join('\n'),
      },
    },
    herring: {
      name: `Inquiry — ${herring.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring.name}`,
        body: [
          `${herring.name} does his trade off the tail of a freight`,
          `wagon in the shade the wagon makes. ${herring.trade} — and he`,
          'greets you the way men of his calling greet all questions,',
          'with a jug and an alibi in the same hand.',
          '',
          `An afternoon settles it: he ${herring.clears}. Not your man.`,
          '',
          `But he knew ${victim} and he pays what such men pay, which is`,
          `the one true thing they carry: "Your assayer ate at ${informant.venue}`,
          `whenever the watch changed. ${informant.name} sees every man`,
          'in this camp twice a day and has buried opinions of all of',
          'them. Nobody asks the cook. That is the cook\'s whole power."',
        ].join('\n'),
      },
    },
    herring2: {
      name: `Inquiry — ${herring2.name}`,
      burnable: false,
      payload: {
        kind: 'dossier',
        title: `INQUIRY — ${herring2.name}`,
        body: [
          `${herring2.name}: ${herring2.trade}. He keeps his hands in`,
          'plain sight the whole time you talk, which is the habit of a',
          'man whose hands have been discussed at law. Even so, half a',
          `day closes it: he ${herring2.clears}.`,
          '',
          'A door that opens on rimrock. The country is made of them.',
          'It apologizes for nothing and it is not going to start with',
          'you.',
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
          `${informant.venue} between meals, the fires banked, the`,
          `coffee thickening toward tar. ${informant.name} works while`,
          'talking, eyes on the flap of the tent, on the line, on',
          'everything, out of a habit older than the company.',
          '',
          `"${victim}? Ate quiet. Thanked me. Nobody thanks the cook.`,
          'Some nights another man came through after him — never with',
          'him. Never far behind him neither. Like a dog that does not',
          'want the man to know whose dog it is.',
          '',
          `Ask me about ${victim}'s man and I will tell you what these`,
          'eyes took down. They are the only pair in this camp that',
          'nobody has ever thought to buy."',
          '',
          'Go gentle. There is no second pair of eyes between here and',
          'Socorro.',
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
          'Given over the coffee, low, in the voice of somebody setting',
          'down a sack they have carried uphill:',
          '',
          '"Company clothes. A face that gave nothing, and I have fed',
          'faces that gave nothing since before this camp had a name.',
          `But twice I watched him take his plate and his coin, and both`,
          `times he ${detail.phrase}. Faces are for other men. Hands are`,
          'for work, and work tells."',
          '',
          'The company keeps a book on its men — hands, marks, what the',
          'war and the trail left of them. Open the company book to the',
          'particulars and see whose flesh agrees with the record.',
        ].join('\n'),
      },
    },
    personnel: {
      name: 'The Company Book — Particulars',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'THE COMPANY BOOK — PARTICULARS OF THE MEN',
        body: [
          'The company writes its men down when it hires them and reads',
          'the writing only when it buries them. Four entries, the',
          'column that matters copied whole:',
          '',
          `  ${detail.column}:`,
          ...S.detailSet.map(n => `    ${n} — yes, per the book`),
          `    ${S.detailCleared} — no: ${detail.counter}.`,
          '',
          'ONE OF THE THREE LISTS. Lay it by the rolls and the strongbox',
          'and weight the pages with stones. Three lists. Four names.',
          'One name on all three, and it was on all three before the',
          'buzzards rose. The country knew. The country is a slow',
          'witness but it does not recant.',
          '',
          'When you are certain, say it: "accuse <name>". Once. Out',
          'here a thing said twice is a thing doubted.',
        ].join('\n'),
      },
    },
    motive: {
      name: 'The Assay Returns',
      burnable: false,
      payload: {
        kind: 'evidence', scene: 'office',
        title: 'THE ASSAY RETURNS — WHY THE ASSAYER WENT TO THE WASH',
        body: [
          `${victim} had called for the season's assay returns two days`,
          'before the wash — every certificate the company issued set',
          'against every sample he had weighed. Paper against rock.',
          'The rock does not negotiate.',
          '',
          'Whoever sold certificates against ore that never was',
          'understood what that comparison would show a man who signed',
          'only what he weighed. Two days is what it takes out here to',
          'arrange a meeting nobody walks back from.',
          '',
          'That is the whole of the motive. Not hatred. Not a woman.',
          'A sum, riding toward him at a walk, in company clothes. You',
          'are the sum now. Ride faster.',
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
          'They take him at morning muster, in front of the men, because',
          `the captain understands what examples are for. ${S.culprit},`,
          `${S.role[S.culprit]}. On the rolls for the ${nightAbbr} watch.`,
          `Carrying a live key to ${room}. And the company book agreeing,`,
          'in the company\'s own dry hand, with what the cook\'s unbought',
          'eyes watched his hands do twice.',
          '',
          'He says nothing on the ride to Socorro. The country says',
          'nothing back. They understand one another at last.',
          '',
          `The assayer's tally goes into the record, and the record for`,
          'once holds, because he weighed it before he wrote it. The',
          'company notes your service in a letter you will never see.',
          '',
          'The stakes stand their crooked watch along the survey line.',
          'The wash fills with red light in the evening and empties',
          'again by dark, the way it has since before there were men to',
          'name it, and will after. The country keeps what it is given.',
          'It was the witness the whole time. You were only the voice.',
        ].join('\n'),
      },
    },
  }

  const edges = [
    {
      to: 'board', requires: ['briefing'],
      lead: 'The company will lay out the suspect board when asked.',
      match: (t) => t.includes('SUSPECT') || t.includes('BOARD') || (t.includes('FOUR') && t.includes('MEN')),
      response: 'The survey sheet is turned over and the charcoal names look back at you.',
    },
    {
      to: 'room', requires: ['briefing'],
      lead: `${victim} bunked in the survey tent. Nobody has gone through it.`,
      match: (t) => t.includes('SURVEY') && (t.includes('TENT') || t.includes('BUNK')),
      response: 'The tent flap gives. The wind has been through before you, but the wind cannot read.',
    },
    {
      to: 'stash', requires: ['briefing'],
      lead: 'His crossed-out claims are a message: first letters, first.',
      answerKey: `The first letters of the crossed-out claims spell ${word} — the cairn on the ${word} claim.`,
      match: (t) => t.includes(word),
      response: 'The stones come away neat as they were laid. He built it to be found by a reader.',
    },
    {
      to: 'rota', requires: ['stash'],
      lead: `The coin moved ${nightAbbr} nights; nobody has pulled the company work rolls.`,
      match: (t) => t.includes('ROLLS') || t.includes('ROSTER') || t.includes('DUTY') || t.includes('WATCH BILL'),
      response: 'The copyist copies by lantern and asks his God to call it honest work.',
    },
    {
      to: 'watcherlog', requires: ['briefing'],
      lead: 'The pickets kept a log on his last night. The pages are loose but they exist.',
      match: (t) => t.includes('PICKET') || t.includes('GUARD') || (t.includes('NIGHT') && t.includes('LOG')),
      response: 'The corporal hands over the loose pages like a man glad to be rid of scripture.',
    },
    timelineEdge(T.answer, {
      to: 'site', requires: ['watcherlog'],
      lead: 'Three picket entries wait on their order: "timeline A B C".',
      answerKey: `The correct order of the picket entries is ${T.answer.split('').join(' ')}.`,
      response: 'Out, met, and one man walking back — the night sets true, and the wash will show you where.',
      failResponse: 'Set so, the night breaks its own spine: a man cannot return before he has gone out. (Heat rises.)',
    }),
    {
      to: 'keybook', requires: ['site'],
      lead: `Unissued certificates live in ${room}. Nobody has asked who carries keys.`,
      match: (t) => t.includes('KEY') || t.includes('STRONGBOX'),
      response: 'The strongbox ledger opens. The one book in camp no man thought to fear.',
    },
    {
      to: 'herring', requires: ['briefing'],
      lead: `The company flagged ${herring.name} — ${herring.trade}. Worth an afternoon, maybe.`,
      match: (t) => t.includes(herring.name),
      response: `${herring.name} greets you with a jug and an alibi in the same hand.`,
    },
    {
      to: 'herring2', requires: ['briefing'],
      lead: `A second name rides the edge of this: ${herring2.name}, ${herring2.trade}.`,
      match: (t) => t.includes(herring2.name),
      response: `${herring2.name} keeps his hands where the sun can find them, which tells most of it.`,
    },
    {
      to: 'informant', requires: ['herring'],
      lead: `${herring.name} pointed at ${informant.venue}: nobody asks the cook, and that is the cook's whole power.`,
      match: (t) => t.includes(informant.alias) || venueMatch(informant.venue)(t),
      response: `${informant.venue} between meals. The eyes nobody thought to buy look up from the work.`,
    },
    {
      to: 'statement', requires: ['informant'],
      lead: `${informant.name} is waiting to be asked about ${victim}'s man.`,
      match: (t) => t.includes(victim),
      response: 'The coffee is poured unasked, and the statement comes out slow and level as a survey line.',
    },
    {
      to: 'personnel', requires: ['statement'],
      lead: 'A witness mark wants checking: open the company book to the particulars.',
      match: (t) => t.includes('PARTICULARS') || t.includes('PERSONNEL') || (t.includes('BOOK') && !t.includes('KEY')),
      response: 'The book opens where books like it always open: at what the trail left of the men.',
    },
    {
      to: 'motive', requires: ['rota', 'keybook'],
      lead: 'Two lists in hand. The assay returns can still say why the assayer went to the wash.',
      match: (t) => t.includes('ASSAY') || t.includes('RETURNS') || t.includes('MOTIVE') || t.includes('WHY'),
      response: 'The returns come out of the chest in their season order, exactly as a careful man left them.',
    },
  ]

  const accusation = {
    culprit: S.culprit,
    wrong: [...S.suspects.slice(1), herring.name, herring2.name, informant.alias],
    unlocks: 'resolution',
    correctResponse: 'The captain moves at morning muster, in front of the men.',
    wrongResponse: (name) =>
      `They put ${name} on a horse for Socorro and the country watches him ` +
      'go and offers no opinion, for it knows what you did not: one list is ' +
      'not three. By the time the error rides back, the seller and the season ' +
      'are gone. The letter closes unresolved.',
  }

  const burnTriggers = {
    press: {
      scope: 'informant',
      match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes(informant.alias),
      reason: 'Contact compromised: pressed before the camp. The kitchen is closed to you.',
      response: 'You lean, and the camp sees you lean, and by supper the coffee is poured for every man but one.',
    },
    heatThreshold: 80,
    heatReason: 'Contact compromised: the camp has taken notice past bearing. Severed.',
  }

  const npcs = {
    informant: {
      aliases: [informant.alias],
      fallback: `${informant.name} goes on working and lets the silence ask your question better than you did.`,
      lines: [
        {
          match: (t) => t.includes(victim),
          disposition: 1,
          response: `"${victim} thanked me every meal of the season. Nobody thanks the cook. I have thought on that more than a man's thanks deserves."`,
        },
        {
          match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY') || t.includes('COIN'),
          heat: 5,
          response: 'The coin sits on the board between you like something that crawled there to die. It is not taken. (Heat rises.)',
        },
      ],
    },
  }

  const hints = [
    {
      match: (t) => t.includes('ACROSTIC') || t.includes('LEDGER') || t.includes('LETTERS') || t.includes('CLAIMS'),
      response: 'His own instruction, sewn into his bed: first letters, first. Read the crossed-out claims down their left edge.',
    },
    {
      match: (t) => t.includes('LIST') || t.includes('INTERSECT') || t.includes('CROSS'),
      response: 'Three lists: the work rolls, the strongbox ledger, the company book. Four names. Your man is the one name standing on all three.',
    },
    {
      match: (t) => t.includes(victim),
      response: `${victim} assayed for the company and signed what he weighed, and the wash took him for it. The desk answers for its dead: what it knows of him you hold in the briefing. Who gained by him gone is four names, and three trails will thin them to one.`,
    },
  ]

  const walkthrough = [
    'show me the suspect board',
    'go through the survey tent',
    `the claims spell ${word.toLowerCase()} — open the cairn on the ${word.toLowerCase()} claim`,
    `pull the company work rolls for ${nightWord.toLowerCase()} nights`,
    'get the picket log from the corporal',
    `timeline ${T.answer.split('').join(' ').toLowerCase()}`,
    'who carries keys to the strongbox tent',
    `ask about ${herring.name.toLowerCase()}`,
    `ask about ${herring2.name.toLowerCase()}`,
    `go to ${informant.venue.toLowerCase()} and find ${informant.alias.toLowerCase()}`,
    `ask about ${victim.toLowerCase()}'s man`,
    'open the company book to the particulars',
    'the assay returns: why did he go to the wash',
    `accuse ${S.culprit.toLowerCase()}`,
  ]

  return {
    CASE_ID, ERA, TITLE: 'The Dry Wash', scopes, edges, accusation, burnTriggers, npcs, hints,
    heat: { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 },
    missResponse: undefined,
    helpText: [
      'PROCEDURE — the rules of this country:',
      '',
      'Say it plain: go somewhere, ask someone, check a thing. The',
      'desk is literal. The country is not anything at all; it merely',
      'waits.',
      '',
      'His ledger is a message: first letters, first. A night in',
      'pieces wants an order — "timeline A B C". This letter is a web:',
      'three trails, three lists, and your man is the one name on all',
      'three. Certain? "accuse <name>" — a thing said twice out here',
      'is a thing doubted, so you say it once. Lost? "review" and the',
      'desk reads it back without judgment, which is more than the',
      'country will do.',
      '',
      'Your notebook keeps every page you have earned. A burned',
      'contact stays burned. Mind the heat. The camp is small and',
      'the desert is not.',
    ].join('\n'),
    opening: [
      'THE MERIDIAN — 1849',
      '',
      'The country runs west in lines no man drew and the company is',
      'drawing them anyway. The buzzards rose over the dry wash this',
      'week and what they rose from was the assayer, the one man in',
      'camp who signed only what he weighed.',
      '',
      'Four names held the company side. Three trails will bring them',
      'down to one: the coin, the paper, and the cook, who watched',
      'the whole camp from her tent and was never bought, because no',
      'one ever thought her worth the buying.',
    ].join('\n'),
    preamble: [
      'Every document you earn goes into your Case Notebook, on the',
      'right, and what you have read no one can take from you. People',
      'are another matter. Out here they are few, and easily lost:',
      'mishandle one and he is gone for good, with everything he still',
      'had to say.',
      '',
      'A name printed in CAPITALS belongs to the case, and the desk',
      'will answer for it — the dead man first among them. Ask about',
      'a name, or ride out to it. The rest of the names in this',
      'country are history.',
      '',
      'Write your reports in plain language. Type "help" at any time',
      'and the rules of this country will be read back to you.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),
      columns: ['nights', 'strongbox', 'witness'],
    },
    lists: { rota: 'the company work rolls', keybook: 'the strongbox ledger', personnel: 'the company book' },
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-meridian-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-meridian-${seed}` }),
    },
  }
}
