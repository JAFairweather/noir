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
        kind: 'dossier', scene: 'street',
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
        kind: 'dossier', scene: 'street',
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
          'THE THIRD LIST. Lay it on the desk beside the rota and the key',
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
      'Four names. Three trails — the money, the paper, a pair of eyes.',
      'Work them the way you were taught: quickly, politely, and',
      'without ever once looking like a man in a hurry.',
    ].join('\n'),
    preamble: [
      'Your notebook keeps what you earn; nothing else in this town is',
      'yours. Speak plainly. "help" buys you field procedure — the luck',
      'you bring yourself.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),      // alphabetical — the order tells nothing
      columns: ['nights', 'keys', 'witness'],
    },
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
        kind: 'dossier', scene: 'street',
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
        kind: 'dossier', scene: 'street',
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
          'THE THIRD LIST. Lay it out under the fan beside the roster',
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
      'the money, the paper, and a pair of eyes that never once went',
      'on the payroll.',
    ].join('\n'),
    preamble: [
      'Your notebook keeps what you earn; nothing else here is yours,',
      'and most of it never was. Speak plainly. "help" buys you',
      'procedure — the rest this town will teach you.',
    ].join('\n'),
    openingScene: 'street',
    board: {
      suspects: sortNames(S.suspects),      // alphabetical — the order tells nothing
      columns: ['nights', 'cage', 'witness'],
    },
    walkthrough,
    solutionCommitment: {
      salt: `caseweb-nola-${seed}`,
      canonical: () => JSON.stringify({ case: CASE_ID, culprit: S.culprit, salt: `caseweb-nola-${seed}` }),
    },
  }
}
