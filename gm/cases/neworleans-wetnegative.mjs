// neworleans-wetnegative.mjs — hand-authored case: "The Wet Negative".
// New Orleans, 1968, per eras/neworleans-1968.md: corruption as climate,
// implication over spectacle, the river keeping what it's given.
//
// Eight scopes, one red herring, one burnable informant, a classified-ad
// acrostic, a dispatch-log timeline, and an accusation endgame.
// Skeleton fixed; prose becomes the Director's job in M3.

export const CASE_ID = 'neworleans-wet-negative'
export const ERA = 'neworleans-1968'

// The classified ad is an acrostic: first letters, top to bottom, DAUPHINE.
export const scopes = {
  briefing: {
    name: 'Case File — T. Thibodeaux',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'office',
      title: 'CASE FILE — THIBODEAUX, T., PHOTOGRAPHER (MISSING, DAY 4)',
      body: [
        'Four days since anybody saw Thibodeaux. He shot weddings for money',
        'and the waterfront for reasons he kept to himself. His sister pays',
        'for four days of your time, in advance, in damp tens.',
        '',
        'One thing she brought: the Picayune from the day he vanished,',
        'folded to the classifieds, one ad circled in grease pencil.',
        'Thibodeaux read the classifieds like scripture — top to bottom,',
        'first things first.',
        '',
        '  Darkroom estate sale — enlargers, trays, best offer.',
        '  Attention shrimpers: nets mended cheap, Ursulines gate.',
        '  Upright piano, tuned, must move before Lent.',
        '  Portraits while you wait, Jackson Square, ask for Lou.',
        '  House for let, Marigny, cool rooms, no questions.',
        '  Iron balcony railings straightened and sold.',
        '  Nine-string banjo, left-handed, serious only.',
        '  Esplanade rooms by the week, quiet, paid in advance.',
        '',
        'Find where the ad points. Report plainly when you\'re there.',
      ].join('\n'),
    },
  },

  darkroom: {
    name: 'Darkroom — Rue Dauphine',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'office',
      title: 'THE DARKROOM, DAUPHINE STREET — WHAT THE TRAYS KEPT',
      body: [
        'The landlady lets you in for the smell of the chemicals, which she',
        'wants gone. Everything in its place except one thing: the negative',
        'file for the last week is empty. He developed, printed a contact',
        'sheet, and took the negatives somewhere safer.',
        '',
        'The contact sheet is still pinned over the sink. Frame 14:',
        'the Esplanade wharf at night. Two men by a patrol car, unit 12.',
        'An envelope passing between them. Faces lost to the dark.',
        '',
        'In the margin, his grease pencil again: "Remy pours at the Blue',
        'Room. Remy knows who drives 12."',
      ].join('\n'),
    },
  },

  remy: {
    name: 'Informant — Remy, the Blue Room',
    burnable: true,
    payload: {
      kind: 'npc',
      scene: 'cafe',
      title: 'REMY — BEHIND THE ZINC AT THE BLUE ROOM',
      body: [
        'He polishes a glass that is already clean and talks to it, not you.',
        '',
        '"Unit 12 worked the wharf for years. Same two faces. Then last week',
        'somebody moved the route — pulled 12 off Esplanade altogether.',
        'Route changes come down on paper, podna. Only a desk sergeant',
        'signs that paper.',
        '',
        'Your photographer was in here Tuesday asking the same thing.',
        'I told him what I\'m telling you: check the dispatch log, check',
        'who signed the route order. And watch your camera by the river."',
        '',
        'A man at the end of the bar — FONTAINE, owns the club upstairs —',
        'is listening harder than a man should.',
        '',
        'Remy talks because Thibodeaux photographed his daughter\'s wedding',
        'for free. Lean on him and he stops for good.',
      ].join('\n'),
    },
  },

  fontaine: {
    name: 'Club Owner — Fontaine',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'street',
      title: 'FONTAINE — UPSTAIRS AT THE BLUE ROOM',
      body: [
        'Fontaine receives you like a man expecting a subpoena and relieved',
        'to get only a question. Yes, vice money crosses his bar. No, he',
        'didn\'t touch the photographer, and he can prove it: Baton Rouge,',
        'all that night, a liquor board hearing with his name in the minutes.',
        '',
        'But he leans in, because gossip is his real currency:',
        '"Your boy photographed the wrong policeman. Not the ones who take —',
        'everybody takes. The one who ARRANGES. The paper man."',
        '',
        'He will not say a name. He looks at the floor, which is to say:',
        'somebody below the rank of captain, above the rank of the street.',
      ].join('\n'),
    },
  },

  patrol: {
    name: 'Dispatch Log — First District',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'street',
      title: 'DISPATCH LOG EXTRACTS — NIGHT THIBODEAUX VANISHED (OUT OF ORDER)',
      body: [
        'A records clerk owes your late partner a favor that outlived him.',
        'Three entries, photostatted crooked, order lost in the copying.',
        'Reconstruct the night; submit the order (e.g. "timeline C A B").',
        '',
        '  [A]  22:05 — Unit 12 logs OFF Esplanade wharf. Reassigned',
        '       Rampart & Dumaine per route order 44-C. No incident noted.',
        '',
        '  [B]  21:30 — Foot patrol notes civilian with camera equipment,',
        '       Esplanade wharf, advised area after dark. Subject polite.',
        '',
        '  [C]  23:15 — Evidence room signature: one (1) roll exposed film,',
        '       "found property," logged personal by desk. No case number.',
      ].join('\n'),
    },
  },

  dutybook: {
    name: 'Route Order 44-C — Signature',
    burnable: false,
    payload: {
      kind: 'dossier',
      scene: 'office',
      title: 'ROUTE ORDER 44-C — AND WHO HELD THE PEN',
      body: [
        'The order that moved Unit 12 off the wharf, the night a camera',
        'was pointed at it. Signed: SGT. E. BROUSSARD, desk, First District.',
        '',
        'Cross-checked, because you cross-check:',
        '- Evidence room key holders that shift: BROUSSARD.',
        '- Det. ARCENEAUX (vice) — the name everyone gives you first —',
        '  on leave in Biloxi all week. Fishing. Photographed fishing,',
        '  which is the only alibi in this town nobody can buy.',
        '',
        'The paper man. Fontaine\'s floor-look has a name on it now.',
        'What the paper can\'t tell you is what happened at the river.',
      ].join('\n'),
    },
  },

  levee: {
    name: 'Esplanade Wharf — The Wet Negative',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'yard',
      title: 'THE WHARF — WHAT THE RIVER GAVE BACK',
      body: [
        'A crab trap off the pilings holds his camera case, latched,',
        'weighted, empty. The river keeps what it\'s given; it gave this',
        'back on purpose, the way a card player shows one card.',
        '',
        'But Thibodeaux mailed his sister a package the morning he vanished.',
        'She hands it over now that you can tell her what it is: negatives.',
        'One frame, water-spotted at the corner — the wet negative — is',
        'frame 15. The one after the envelope.',
        '',
        'It shows the second man\'s face, quarter-turned into the patrol',
        'car\'s dome light. Desk sergeant\'s stripes. Broussard.',
        '',
        'Of Thibodeaux himself the river says nothing. It never does.',
      ].join('\n'),
    },
  },

  resolution: {
    name: 'Resolution — Case Closed',
    burnable: false,
    payload: {
      kind: 'epilogue',
      scene: 'epilogue',
      title: 'RESOLUTION — THE WET NEGATIVE',
      body: [
        'BROUSSARD, desk sergeant, First District. He moved the patrols the',
        'way other men move furniture, and the wharf went dark on schedule.',
        'The negative and the route order and the evidence log make a chain',
        'even this parish can\'t unlink. The federal men take it gladly;',
        'they\'ve wanted a door into the First District for years.',
        '',
        'Thibodeaux comes out of the river on a Thursday, three miles down.',
        'The parish buries him; his sister buries the case fee in the plate',
        'at St. Augustine. You keep the contact sheet. Frame 14, two men,',
        'an envelope. Proof that he was exactly as good as he thought he was.',
        '',
        'Café au lait at dawn, standing up, watching the street get honest',
        'for an hour. It never lasts past breakfast.',
      ].join('\n'),
    },
  },
}

// Timeline reconstruction: the true order of the dispatch entries.
const timelineAnswer = 'BAC'
const timelineAttempt = (t) => {
  const kws = ['TIMELINE', 'ORDER', 'SEQUENCE'].map(k => t.indexOf(k)).filter(i => i >= 0)
  if (!kws.length) return null
  return t.slice(Math.min(...kws) + 5).replace(/[^ABC]/g, '')
}

export const edges = [
  {
    to: 'darkroom',
    requires: ['briefing'],
    match: (t) => t.includes('DAUPHINE') || t.includes('DARKROOM'),
    response: 'First letters, top to bottom, the way he read: DAUPHINE. The landlady is sweeping the step like she\'s been waiting.',
  },
  {
    to: 'remy',
    requires: ['darkroom'],
    match: (t) => t.includes('REMY') || (t.includes('BLUE') && t.includes('ROOM')),
    response: 'The Blue Room, off-hours. Ceiling fan stirring the smoke of people who left. Remy sees you and reaches for the clean glass.',
  },
  {
    to: 'fontaine',
    requires: ['remy'],
    match: (t) => t.includes('FONTAINE'),
    response: 'Upstairs, where the carpet starts. Fontaine waves you into a chair a lawyer should be sitting in.',
  },
  {
    to: 'patrol',
    requires: ['remy'],
    match: (t) => t.includes('DISPATCH') || t.includes('PATROL') || (t.includes('CAR') && /\b12\b/.test(t)) || t.includes('LOG'),
    response: 'The records clerk doesn\'t look up. Three photostats appear under the counter glass, crooked as the parish itself.',
  },
  {
    to: 'levee',
    requires: ['patrol'],
    match: (t) => timelineAttempt(t) === timelineAnswer,
    failMatch: (t) => {
      const a = timelineAttempt(t)
      return a !== null && a.length >= 2 && a !== timelineAnswer
    },
    failResponse: 'Shuffle it that way and the night contradicts itself — film gets logged before it\'s found, patrols leave before they\'re seen. (Heat rises.)',
    response: 'Seen at 21:30. Patrol pulled at 22:05. Film logged "found" at 23:15. Ninety minutes of dark, all of it on the wharf. You get the car.',
  },
  {
    to: 'dutybook',
    requires: ['patrol'],
    match: (t) => t.includes('SIGNED') || t.includes('ROUTE ORDER') || t.includes('44') || (t.includes('WHO') && t.includes('ORDER')),
    response: 'Route order 44-C, pulled from a file that sticks. The signature line is very neat. Careful men are neat.',
  },
]

export const accusation = {
  culprit: 'BROUSSARD',
  wrong: ['ARCENEAUX', 'FONTAINE', 'REMY'],
  unlocks: 'resolution',
  correctResponse: 'You hand the chain — negative, route order, evidence log — to the federal men before the District hears you\'ve been asking.',
  wrongResponse: (name) =>
    `You put it on ${name}, and the parish is delighted to agree — for exactly as long as it takes the paperwork to drown. ` +
    'The wet negative goes into an evidence room whose keys you now know better than to trust. The case closes the way the river closes.',
}

// Interrogation (§5.3): Remy warms if you talk about the right people;
// a bribe works on him — this is New Orleans. Fontaine performs.
export const npcs = {
  remy: {
    aliases: ['REMY', 'BARTENDER', 'BARKEEP'],
    fallback: 'Remy finds a spot on the glass that isn\'t there and works it. The fan turns. You can wait him out; the beer can\'t.',
    lines: [
      {
        match: (t) => t.includes('THIBODEAUX') || t.includes('PHOTOGRAPHER'),
        disposition: 1,
        response: '"Shot my girl\'s wedding for nothing but the meal. Man had a way of being invisible in a room ' +
          'until you saw the pictures and realized he\'d seen everything." He sets the glass down gently. ' +
          '"Whatever he pointed that camera at, it wasn\'t worth him."',
      },
      {
        match: (t) => t.includes('BRIBE') || t.includes('TWENTY') || t.includes('PAY') || t.includes('MONEY'),
        disposition: 1,
        response: 'The twenty is gone before you finish sliding it. "Route order. That\'s the church key, podna — ' +
          'patrols move when paper moves. And paper doesn\'t move for less than a sergeant." He rings nothing up.',
      },
      {
        match: (t) => t.includes('BROUSSARD') || t.includes('SERGEANT'),
        minDisposition: 1,
        response: 'The rag stops. "Some names don\'t get said over this bar." He says it to the taps, quietly. ' +
          '"You want that name, get it off paper. Paper can\'t get hurt."',
      },
      {
        match: (t) => t.includes('ARCENEAUX') || t.includes('VICE'),
        response: '"Arceneaux?" A short laugh with no joke in it. "Takes with both hands, sure. But that man ' +
          'was in Biloxi pulling redfish all week and showing everybody the pictures. Wrong tree, podna."',
      },
    ],
  },
  fontaine: {
    aliases: ['FONTAINE'],
    fallback: 'Fontaine spreads his hands: the gesture of a man who has already told you everything he intends to.',
    lines: [
      {
        match: (t) => t.includes('PAYOFF') || t.includes('VICE') || t.includes('LAUNDER') || t.includes('MONEY'),
        response: '"Commerce," he corrects, pained. "This city runs on tribute like the river runs downhill. ' +
          'I am a landmark, not a criminal." He relights a cigar that was not out.',
      },
      {
        match: (t) => (t.includes('PRESS') || t.includes('THREATEN')) && t.includes('FONTAINE'),
        heat: 10,
        response: 'He listens to your leverage the way a man listens to rain. "My attorney enjoys this kind of ' +
          'conversation more than I do." The room cools by a lawyer\'s degree. (Heat rises.)',
      },
      {
        match: (t) => t.includes('PAPER') || t.includes('POLICEMAN') || t.includes('WHO'),
        response: '"I told you: the paper man." He examines his ring. "In this parish, murder is occasionally ' +
          'forgiven. Filing the wrong form, never. Go read forms, detective."',
      },
    ],
  },
}

export const hints = [
  {
    match: (t) => t.includes('AD') || t.includes('CLASSIFIED') || t.includes('ACROSTIC') || t.includes('PICAYUNE'),
    response: 'Top to bottom, first things first — the way he read. Eight lines, eight letters. They spell a street.',
  },
  {
    requires: ['darkroom'],
    match: (t) => t.includes('FRAME') || t.includes('CONTACT SHEET') || t.includes('NEGATIVE'),
    response: 'Frame 14 is the handoff. The frame AFTER the handoff left town in a mail sack. Find where the negatives went — or who they show.',
  },
  {
    requires: ['patrol'],
    match: (t) => t.includes('PHOTOSTAT') || t.includes('ENTRIES') || t.includes('RECONSTRUCT'),
    response: 'Put the night in order: seen, then moved, then "found." Submit it as "timeline" and three letters.',
  },
]

export const missResponse = 'Nothing moves. A screen door claps somewhere, and a man on a gallery marks you without looking up. (Heat rises.)'

export const burnTriggers = {
  press: {
    scope: 'remy',
    match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes('REMY'),
    reason: 'Source severed: subject leaned on in his own bar, in view of the room. Contact lost.',
    response: 'You lean, and the clean glass goes down on the zinc with a click the whole room hears. ' +
      'In the Quarter that click travels faster than a siren. By last call, Remy pours and says nothing, forever.',
  },
  heatThreshold: 80,
  heatReason: 'Source severed: District attention exceeded tolerance. Contact lost.',
}

export const heat = { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 }

export const helpText = [
  'HOW THIS WORKS — for the record, once:',
  '',
  '  Say it plain. GO somewhere, ASK someone, CHECK a thing.',
  '  Worked out the ad? Say where it points.',
  '  Reconstructing a night? "timeline A B C" in the order you believe.',
  '  Sure? "accuse <name>" — one accusation to a customer.',
  '',
  'Your notebook (right) keeps every document you\'ve been handed.',
  'Click one to reread it. A burned source is burned for good — you keep',
  'exactly what you already heard. Mind the heat; this is a small town',
  'wearing a city\'s clothes.',
].join('\n')

export const solutionCommitment = {
  salt: 'vieux-carre-1968-sel',
  canonical: () => JSON.stringify({ case: CASE_ID, culprit: accusation.culprit, salt: solutionCommitment.salt }),
}

export const opening = [
  'NEW ORLEANS — 1968',
  '',
  'River humidity you could wring out of the air, café au lait going cold',
  'on a zinc counter, and a sister with damp tens who wants to know why',
  'a careful man stopped coming home.',
  '',
  'Your notebook holds what you have earned. Nothing else is yours.',
  'Read the file. Type plainly. Type "help" for the house rules.',
].join('\n')

export const openingScene = 'street'

// data-driven happy path, used by the smoke suite
export const walkthrough = [
  'the ad spells dauphine, go to the darkroom',
  'ask remy at the blue room about unit 12',
  'talk to fontaine upstairs',
  'check the dispatch log',
  'timeline b a c',
  'who signed the route order',
  'accuse broussard',
]
