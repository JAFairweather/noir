// berlin-minicase.mjs — the hand-authored M1 case: "The Last Visa".
// Eight scopes, two red herrings, one burnable informant, a cipher, a
// timeline reconstruction, and an accusation endgame.
//
// This file is the *skeleton* in spec §4 terms: topology, documents, answers,
// culprit — all fixed. The stub GM serves it verbatim; from M3 the director
// re-fleshes the prose per playthrough while this graph stays the law.
//
// Scope ids are opaque on the wire (spec §4/SPEC.md): the human names below
// never appear in a d tag — the GM maps them to random ids per session.

export const CASE_ID = 'berlin-last-visa'
export const TITLE = 'The Last Visa'
export const ERA = 'berlin-1938'

// Vigenère, key SILBER (Weiss's workname, stated in the briefing footer):
// plaintext ZOOLOCKERNINE → RWZMS TCMCO MEW
export const scopes = {
  briefing: {
    name: 'Case Briefing — REISEBÜRO',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'office',
      title: 'BRIEFING — OPERATION REISEBÜRO',
      body: [
        'Berlin. November 1938. The city smells of coal smoke and wet wool,',
        'and everyone at the embassy queue has learned not to look up.',
        '',
        'Our courier WEISS did not make Tuesday\'s drop. He carried exit-visa',
        'blanks — forty of them — and a list of the names they were meant for.',
        'If the blanks are moving without us, someone is selling them.',
        '',
        'SIGNALS intercepted one fragment, keyed the old way. Weiss always',
        'ciphered under his workname — find the word he keyed under, and',
        'the desk will run the tables for you: report "decode <word>".',
        '',
        '    INTERCEPT 11/8:  RWZMS TCMCO MEW',
        '',
        'The trail may also touch the travel office on Kantstrasse — VOSS,',
        'the proprietor, sells more than tickets. Tread there if you must.',
        '',
        'Everything you need to break the intercept is on this page.',
        '',
        '— Station. (Courier registry: WEISS, workname SILBER, route 7.)',
      ].join('\n'),
    },
  },

  locker: {
    name: 'Zoo Bahnhof — Locker Nine',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'station',
      title: 'CONTENTS — LOCKER 9, ZOO BAHNHOF',
      body: [
        'A courier satchel, empty of blanks. Inside the lining:',
        '',
        '- A ledger page. Six entries, all Tuesdays, all initialed "B." or "K."',
        '  Sums in Reichsmarks that a clerk\'s salary does not explain.',
        '- A cloakroom ticket, Café Josty, stamped twice.',
        '- A pencil note in Weiss\'s hand: "If I go quiet ask the coat-check',
        '  at Josty — ADLER. She counts everyone."',
        '',
        'The ledger initials belong to somebody in the visa section.',
        'Two clerks sign with those letters. You need an eye that was there.',
      ].join('\n'),
    },
  },

  kasse: {
    name: 'Reisebüro Voss — Kantstrasse',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'office',
      title: 'VISIT — REISEBÜRO VOSS, KANTSTRASSE 112',
      body: [
        'Voss sells queue-jumping: an appointment at the visa section window',
        'for triple the official fee, cash, no receipt. Shabby, profitable,',
        'and — you conclude after an hour of his sweating — not our man.',
        'He buys access. He has none of his own to sell.',
        '',
        'One thing sticks. His appointment book, Thursday last:',
        '"WEISS — 16:00 — single passage, Hamburg–New York, paid in full."',
        '',
        'The courier bought himself a ticket out. Three days before he',
        'went quiet. A man planning to run keeps his own schedule.',
      ].join('\n'),
    },
  },

  adler: {
    name: 'Informant — Frau Adler',
    burnable: true,
    payload: {
      kind: 'npc',
      scene: 'cafe',
      title: 'STATEMENT — FRAU ADLER, CAFÉ JOSTY (COAT-CHECK)',
      body: [
        'She talks with her hands below the counter, where hands can\'t be seen.',
        '',
        '"Your man Weiss. Tuesdays, last table, always the same company —',
        'a man from the embassy visa section. Armband, ink on the thumb.',
        'Weiss passed him papers twice. The second time, the man paid.',
        '',
        'Which one? I never learned his name. But he was DUTY those nights —',
        'they come straight from the evening window, still wearing the badge.',
        'Check who held the Tuesday window. That is your seller.',
        '',
        'And you are not the first to watch this room. Your own people kept',
        'streetwork on Josty for a month. Ask Station for the watcher log."',
        '',
        'Handle her gently. She is the only pair of eyes we have.',
      ].join('\n'),
    },
  },

  watcher: {
    name: 'Station Streetwork — Watcher Log',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'street',
      title: 'WATCHER LOG — JOSTY DETAIL (EXTRACTS, OUT OF ORDER)',
      body: [
        'Three index cards survive from the last Tuesday. The clerk who',
        'filed them dropped the box. Reconstruct the evening; submit the',
        'order (e.g. "timeline C A B").',
        '',
        '  [A]  23:40 — Subject WEISS departs Josty alone. Carrying nothing.',
        '       Turns east, toward the freight side of Anhalter.',
        '',
        '  [B]  21:15 — Subject WEISS arrives Josty. Courier satchel,',
        '       left hand. Takes the last table. Orders nothing.',
        '',
        '  [C]  22:30 — Second man joins last table. Armband, embassy',
        '       cut. Satchel moves under the table. An envelope crosses it.',
      ].join('\n'),
    },
  },

  freight: {
    name: 'Anhalter Freight Sidings',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'yard',
      title: 'FINDINGS — ANHALTER BAHNHOF, FREIGHT SIDE',
      body: [
        'A yard man found him Wednesday, between the coal wagons.',
        'The satchel was gone. The list was not — Weiss kept it separate,',
        'sewn into his coat, the way he was trained to.',
        '',
        'Forty names, safe. The blanks are still moving.',
        '',
        'In his breast pocket, a torn corner of visa stock. Printed edge:',
        'evening-window series. Whoever met him at Josty came straight',
        'from the Tuesday duty window — and went back to it.',
        '',
        'He was running, and he stayed one more Tuesday to finish the job.',
        'Remember that, whatever the file ends up saying about him.',
      ].join('\n'),
    },
  },

  roster: {
    name: 'Embassy Visa Section — Duty Roster',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'office',
      title: 'DUTY ROSTER — VISA SECTION, EVENING WINDOW (NOV)',
      body: [
        'Photographed through glass; the corner is flared but legible.',
        '',
        '  Tue  1 Nov   evening window:  BRANDT',
        '  Tue  8 Nov   evening window:  BRANDT',
        '  Tue 15 Nov   evening window:  KELLER (crossed out) → BRANDT',
        '  Tue 22 Nov   evening window:  BRANDT',
        '',
        'Keller traded away every Tuesday this month. Brandt volunteered',
        'for a window nobody wants. The ledger says Tuesdays. Adler says',
        'the duty man. The roster says who the duty man was.',
        '',
        'When you are certain, file it: "accuse <name>". Once.',
      ].join('\n'),
    },
  },

  resolution: {
    name: 'Resolution — Case Closed',
    burnable: false,
    payload: {
      kind: 'epilogue',
      scene: 'epilogue',
      title: 'RESOLUTION — OPERATION REISEBÜRO',
      body: [
        'BRANDT, visa section, second window. He sold the blanks by the',
        'Tuesday lamplight and initialed his own ledger like a shopkeeper.',
        'The forty names are recovered. Thirty-one of the visas will still',
        'be honored. That is the arithmetic you get to keep.',
        '',
        'Weiss had a ticket out — Hamburg to New York, paid in full — and',
        'he stayed one more Tuesday anyway. The list is why thirty-one',
        'families board a train this winter.',
        '',
        'Station notes your handling of the Adler asset in the file.',
        'The file does not say thank you. It never does.',
      ].join('\n'),
    },
  },
}

// Timeline reconstruction (§5.6): the true order of the watcher cards.
const timelineAnswer = 'BCA'
const timelineAttempt = (t) => {
  const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
  if (!kws.length) return null
  return t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '')
}

// The case graph: how field reports unlock scopes. `match` runs against a
// normalized command (uppercased, punctuation stripped). First hit wins.
// `failMatch`/`failResponse`: a recognizable wrong attempt at this edge.
export const edges = [
  {
    to: 'locker',
    requires: ['briefing'],
    lead: 'The intercept waits on a key word: "decode <word>" and the desk runs the tables.',
    answerKey: 'The decoded intercept reads ZOO LOCKER NINE — locker 9 at Zoo Bahnhof (the Zoo railway station), Berlin.',
    match: (t) => t.includes('ZOO') && t.includes('LOCKER') && (t.includes('NINE') || /\b9\b/.test(t)),
    response: 'The attendant takes your pfennigs without looking. Locker nine opens on the second key.',
  },
  {
    to: 'kasse',
    requires: ['briefing'],
    lead: 'Station flagged the travel office on Kantstrasse — VOSS sells more than tickets.',
    match: (t) => t.includes('VOSS') || t.includes('REISEBURO') || t.includes('KANTSTRASSE') || (t.includes('TRAVEL') && (t.includes('OFFICE') || t.includes('AGENT'))),
    response: 'Kantstrasse 112. Dust on the model liners in the window, none on the appointment book.',
  },
  {
    to: 'adler',
    requires: ['locker'],
    lead: 'Weiss\'s pencil note names an eye at Café Josty: ADLER, the coat-check.',
    match: (t) => t.includes('ADLER') || (t.includes('JOSTY') && (t.includes('COAT') || t.includes('ASK') || t.includes('TICKET'))),
    response: 'Café Josty, four in the afternoon. The coat-check counter, and the woman Weiss trusted behind it.',
  },
  {
    to: 'watcher',
    requires: ['adler'],
    lead: 'Adler says Station kept streetwork on Josty. Nobody has pulled the watcher log.',
    match: (t) => t.includes('WATCHER') || t.includes('STREETWORK') || (t.includes('STATION') && t.includes('LOG')),
    response: 'Station is not pleased to be asked, which is how you know the log exists. A box of index cards, dropped once.',
  },
  {
    to: 'freight',
    requires: ['watcher'],
    lead: 'Three watcher cards wait to be put in order: "timeline A B C".',
    match: (t) => timelineAttempt(t) === timelineAnswer,
    failMatch: (t) => {
      const a = timelineAttempt(t)
      return a !== null && a.length >= 2 && a !== timelineAnswer
    },
    failResponse: 'You shuffle the cards that way and the evening argues back: a man cannot leave before he arrives. (Heat rises.)',
    response: 'Arrive, meet, depart — 21:15, 22:30, 23:40. He walked east toward the freight side, and now so do you.',
  },
  {
    to: 'roster',
    requires: ['adler'],
    lead: 'Adler\'s seller held the Tuesday evening window. Nobody has checked the duty roster.',
    match: (t) => t.includes('ROSTER') || (t.includes('TUESDAY') && (t.includes('DUTY') || t.includes('WINDOW') || t.includes('CHECK'))),
    response: 'A friend in the registry owes Station a favor. By morning you have a photograph of the roster.',
  },
]

// The accusation endgame (§5.8). Culprit fixed by the skeleton.
export const accusation = {
  culprit: 'BRANDT',
  wrong: ['KELLER', 'VOSS', 'ADLER', 'WEISS'],
  unlocks: 'resolution',
  correctResponse: 'Station moves before the evening window opens.',
  wrongResponse: (name) =>
    `Station moves on ${name}. The interrogation gives them nothing, because there is nothing to give. ` +
    'By the time the error is plain, the blanks are gone and so is the seller. The case file closes unresolved.',
}

// Interrogation (§5.3): multi-turn, scripted. Disposition opens doors;
// money closes this one. Pressing is handled by burnTriggers below.
export const npcs = {
  adler: {
    aliases: ['ADLER', 'COAT CHECK', 'COATCHECK'],
    fallback: 'She wipes a counter that is already clean and waits for a better question.',
    lines: [
      {
        match: (t) => t.includes('WEISS'),
        disposition: 1,
        response: '"He tipped like a man apologizing for something. Always the coat, never the hat — ' +
          'a man who keeps his hat is a man planning to leave quickly." She almost smiles. ' +
          '"He asked after my son once. Nobody asks after my son."',
      },
      {
        match: (t) => t.includes('SELLER') || t.includes('ARMBAND') || t.includes('INK') || t.includes('MAN'),
        response: '"Ink on the right thumb, here—" she presses her own, "—the stamping hand. A man who stamps ' +
          'all evening and then comes to drink where nobody outranks him. That is all the face I have for you."',
      },
      {
        match: (t) => t.includes('BRANDT') || t.includes('KELLER'),
        minDisposition: 1,
        response: '"Names are your trade. Faces were mine." She glances at the door once. ' +
          '"But the one who came — he came FROM somewhere, still wearing the evening on him. ' +
          'Find out who the evening belonged to."',
      },
      {
        match: (t) => t.includes('BRIBE') || t.includes('PAY') || t.includes('MONEY') || t.includes('REICHSMARK'),
        heat: 5,
        response: 'She looks at the money the way you look at weather. "The visa section pays better, ' +
          'and I do not talk to them either." The coins stay on the counter, and so does a little of your standing. (Heat rises.)',
      },
    ],
  },
}

// Near-miss nudges: the desk answers a bad guess with tradecraft, not silence.
export const hints = [
  {
    match: (t) => t.includes('SILBER'),
    response: 'SILBER is the key, not the message. Lay it against the intercept, letter over letter, and subtract.',
  },
  {
    match: (t) => t.includes('CIPHER') || t.includes('DECODE') || t.includes('VIGENERE') || t.includes('INTERCEPT'),
    response: 'Weiss keyed the old way: a running keyword under the text. His workname is printed at the bottom of the briefing. Six letters.',
  },
  {
    requires: ['locker'],
    match: (t) => t.includes('LEDGER') || t.includes('INITIALS'),
    response: 'Two clerks sign B. and K. The ledger tells you WHEN. You still need an eye that saw WHO — and paper that says WHERE they stood.',
  },
  {
    requires: ['watcher'],
    match: (t) => t.includes('CARD') || t.includes('INDEX') || t.includes('RECONSTRUCT'),
    response: 'Read the hours on the cards. A man arrives before he meets; he meets before he leaves. Submit it as "timeline" and three letters.',
  },
]

// Pressing the informant burns her (§5.3): real rotation, permanent this run.
export const burnTriggers = {
  press: {
    scope: 'adler',
    match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes('ADLER'),
    reason: 'Asset compromised: subject pressed in a public place. Contact severed. Do not approach.',
    response: 'You lean on her, and her hands come up above the counter, and that is the end of it. ' +
      'A regular in a good coat has noticed the temperature change. By nightfall the arrangement is ash.',
  },
  heatThreshold: 80,
  heatReason: 'Asset compromised: surveillance pressure exceeded tolerance. Contact severed.',
}

// Heat deltas (§5.4, mini version).
export const heat = { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 }

// The intercept: the desk runs any key the player names ("decode silber").
export const cipher = { ciphertext: 'RWZMSTCMCOMEW', key: 'SILBER', to: 'locker' }

export const helpText = [
  'FIELD PROCEDURE — what Station expects of a report:',
  '',
  '  Speak plainly. The desk reads intent, not syntax.',
  '  GO somewhere, ASK someone, CHECK a thing, OPEN what is closed.',
  '  Found a cipher key word? "decode <word>" — the desk runs the tables.',
  '  Reconstructing an evening? "timeline A B C" in the order you believe.',
  '  Certain? "accuse <name>" — you file that once, and you live with it.',
  '  Lost the thread? "review" — the desk reads the case back.',
  '',
  'Your notebook (right) holds every document you have been handed.',
  'Click an entry to reread it on the drum. A burned contact is gone for',
  'good — you keep exactly what you already read. Mind the heat.',
].join('\n')

// Fair-play commitment (§4.3): sha256 of this canonical string is published
// in the case's public kind-0 before play begins.
export const solutionCommitment = {
  salt: 'reisebuero-1938-salz',
  canonical: () => JSON.stringify({ case: CASE_ID, culprit: accusation.culprit, salt: solutionCommitment.salt }),
}

export const openingScene = 'street'

// data-driven happy path, used by the smoke suite
export const walkthrough = [
  'the intercept decodes to zoo locker nine',
  'visit voss at the travel office',
  'ask adler at josty about weiss',
  'ask station for the watcher log',
  'timeline b c a',
  'check who held the tuesday duty window',
  'accuse brandt',
]

export const opening = [
  'BERLIN — NOVEMBER 1938',
  '',
  'The case reaches you as a single dossier and a courier who has gone',
  'quiet. Everything else in this city is somebody\'s secret, held close,',
  'and the city sells its secrets for the price of the coal.',
  '',
].join('\n')

export const preamble = [
  'Your notebook holds what you have earned. Nothing else is yours.',
  'Speak plainly. "help" buys you field procedure.',
].join('\n')
