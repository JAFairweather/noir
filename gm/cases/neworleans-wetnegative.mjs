// neworleans-wetnegative.mjs — hand-authored case: "The Wet Negative".
// New Orleans, 1968, per eras/neworleans-1968.md: corruption as climate,
// implication over spectacle, the river keeping what it's given.
//
// Nine scopes, one red herring, one burnable informant, a classified-ad
// acrostic, a dispatch-log timeline, a photo-analysis gate (§5.5 — the
// wet negative itself), and an accusation endgame.
// Skeleton fixed; prose becomes the Director's job in M3.

export const CASE_ID = 'neworleans-wet-negative'
export const TITLE = 'The Wet Negative'
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
        '',
        'When you are certain, file it: "accuse <name>". Once.',
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
        'The print is behind these words now, hanging on the dark: the',
        'second man, quarter-turned into the patrol car\'s dome light,',
        'his face gone to the water spot. The frame kept one thing the',
        'parish can\'t talk its way around. Study the print. Report what',
        'the near sleeve wears.',
        '',
        'Of Thibodeaux himself the river says nothing. It never does.',
      ].join('\n'),
      // §5.5: the puzzle detail — composited into the scene image by the
      // client, deterministically, in code. It appears in NO document
      // body: the photograph is the only witness that says it.
      photo: {
        id: 'frame-15',
        caption: 'FRAME 15 — ESPLANADE WHARF, NIGHT',
        mark: 'chevrons',
        text: '1ST DIST',
        style: 'stencil',
        spot: true,
        alt: 'A water-spotted photographic print: a man quarter-turned into a patrol car\'s ' +
          'dome light, his face lost under the water damage. On his near sleeve, three ' +
          'sergeant\'s chevrons. A door panel behind him is stenciled 1ST DIST.',
      },
    },
  },

  blowup: {
    name: 'The Blow-Up — Frame 15',
    burnable: false,
    payload: {
      kind: 'evidence',
      scene: 'office',
      title: 'THE ENLARGEMENT — FRAME 15, NEAR SLEEVE, DETAIL',
      body: [
        'A portrait man on Chartres owes you a favor and asks no',
        'questions, which in this town is the whole favor. Under the',
        'enlarger the sleeve comes up like a confession: three chevrons.',
        'Desk sergeant\'s stripes.',
        '',
        'Not vice. Not the street. The desk — the rank that signs route',
        'orders, holds evidence-room keys, and never gets its shoes wet.',
        'Set the enlargement beside route order 44-C and the parish runs',
        'out of coincidences: the signature line hands you the name, if',
        'it hasn\'t already.',
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
    lead: 'The circled ad reads like he read: top to bottom, first things first. It spells a street.',
    answerKey: 'The classified ad is an acrostic spelling DAUPHINE — it points to Thibodeaux\'s darkroom on Dauphine Street.',
    match: (t) => t.includes('DAUPHINE') || t.includes('DARKROOM'),
    response: 'First letters, top to bottom, the way he read: DAUPHINE. The landlady is sweeping the step like she\'s been waiting.',
  },
  {
    to: 'remy',
    requires: ['darkroom'],
    lead: 'The contact-sheet margin says it plain: Remy pours at the Blue Room, and Remy knows who drives 12.',
    match: (t) => t.includes('REMY') || (t.includes('BLUE') && t.includes('ROOM')),
    response: 'The Blue Room, off-hours. Ceiling fan stirring the smoke of people who left. Remy sees you and reaches for the clean glass.',
  },
  {
    to: 'fontaine',
    requires: ['remy'],
    lead: 'Fontaine, upstairs at the Blue Room, was listening harder than a man should.',
    match: (t) => t.includes('FONTAINE'),
    response: 'Upstairs, where the carpet starts. Fontaine waves you into a chair a lawyer should be sitting in.',
  },
  {
    to: 'patrol',
    requires: ['remy'],
    lead: 'Remy said it twice: check the dispatch log for Unit 12.',
    match: (t) => t.includes('DISPATCH') || t.includes('PATROL') || (t.includes('CAR') && /\b12\b/.test(t)) || t.includes('LOG'),
    response: 'The records clerk doesn\'t look up. Three photostats appear under the counter glass, crooked as the parish itself.',
  },
  {
    to: 'levee',
    requires: ['patrol'],
    lead: 'Three photostats wait to be put in order: "timeline A B C".',
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
    lead: 'Route order 44-C moved that patrol. Nobody has checked who signed it.',
    match: (t) => t.includes('SIGNED') || t.includes('ROUTE ORDER') || t.includes('44') || (t.includes('WHO') && t.includes('ORDER')),
    response: 'Route order 44-C, pulled from a file that sticks. The signature line is very neat. Careful men are neat.',
  },
  {
    // Photo analysis (§5.5): the answer is IN the image. The client
    // composites the chevrons into frame 15 (levee payload.photo); no
    // document names them until the player has read the print and said
    // so. Naming the scope never springs the gate — answerKey rules.
    to: 'blowup',
    requires: ['levee'],
    puzzle: 'photo',
    lead: 'Frame 15 hangs behind the words. Study the print and report what the near sleeve wears.',
    answerKey: 'Frame 15 shows the second man wearing desk sergeant\'s stripes — three chevrons on the near sleeve.',
    match: (t) => t.includes('STRIPE') || t.includes('CHEVRON') ||
      ((t.includes('SERGEANT') || t.includes('DESK')) &&
        (t.includes('FRAME') || t.includes('PHOTO') || t.includes('PRINT') || t.includes('NEGATIVE') || t.includes('SLEEVE'))),
    response: 'You take the frame to a portrait man on Chartres, and under the enlarger the sleeve gives it up.',
  },
]

// Photo analysis (§5.5): the wet negative IS the puzzle. The detail —
// three chevrons on the second man's sleeve — is composited into the
// scene image by the client (levee payload.photo), never printed in a
// document body. The desk can only point the loupe; the reading itself
// is verified through the blowup edge's answer key above.
export const photo = {
  scope: 'levee',
  to: 'blowup',
  study: 'You put the loupe on frame 15. The face stays lost to the water spot — the river kept ' +
    'that much for itself. But the dome light holds the near sleeve plain enough to count. ' +
    'Report what the sleeve wears.',
}

export const accusation = {
  culprit: 'BROUSSARD',
  wrong: ['ARCENEAUX', 'FONTAINE', 'REMY'],
  unlocks: 'resolution',
  // §5.8: the chain the resolution names — negative, route order,
  // dispatch log. Two of the three, cited from the notebook, or the
  // desk hands the file back.
  evidence: ['levee', 'dutybook', 'patrol'],
  proofResponse: 'A name is not a case, podna — not in this parish. Show the work: "accuse broussard ' +
    'with <the papers that hold him>". Two pieces, minimum, out of your own notebook.',
  contradictions: {
    ARCENEAUX: {
      requires: 'dutybook',
      response: 'Your own cross-check answers you: Arceneaux was in Biloxi all week pulling redfish, ' +
        'photographed doing it — the one alibi in this town nobody can buy. File it again and it goes.',
    },
    FONTAINE: {
      requires: 'fontaine',
      response: 'Baton Rouge, all that night, a liquor board hearing with his name in the minutes — you read ' +
        'them yourself. Put Fontaine at the wharf and the minutes argue back. File it again and it goes.',
    },
  },
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
    fallbacks: [
      { response: 'Remy finds a spot on the glass that isn\'t there and works it. The fan turns. You can wait him out; the beer can\'t.' },
      { response: 'He draws a beer nobody ordered and sets it in front of nobody. The Quarter\'s way of saying the well is dry tonight.' },
      { minDisposition: 1, response: '"Podna." He says it kindly, which is how you know it\'s a door closing. "I pour. I don\'t narrate."' },
      { minDisposition: 2, response: '"Go read your paper trail." He nods at the door, almost fond. "Come back when you can drink to something."' },
    ],
    reactiveMiss: [
      '"That\'s a question for the paper, not the pourer. Paper doesn\'t lose its liquor license for answering."',
      '"I see who drinks and who watches who drinks. Past that, podna, the zinc is my whole parish."',
    ],
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
      {
        // gentle tell: remember why he talks at all (+1)
        match: (t) => t.includes('WEDDING') || t.includes('DAUGHTER'),
        disposition: 1,
        response: 'The rag stops on the zinc. "She danced till the band quit and he never once put the camera ' +
          'between her and the room. That\'s the whole reason you\'re getting words instead of weather." He ' +
          'pours you one you didn\'t order.',
      },
      {
        // blunt tell: hurrying the Quarter costs (−1)
        match: (t) => t.includes('HURRY') || t.includes('QUICKLY') || t.includes('RIGHT NOW'),
        disposition: -1,
        response: '"Quickly." He lets the word sit on the bar until it sweats. "Nothing good in this parish ever ' +
          'happened quickly except a flood." The glass he was polishing gets polished again.',
      },
      {
        match: (t) => t.includes('WHARF') || t.includes('RIVER') || (t.includes('UNIT') && /\b12\b/.test(t)),
        response: '"The wharf after dark belongs to whoever the route order says it belongs to." He tips his head ' +
          'at the ceiling fan. "Used to be Unit 12\'s. Then it was nobody\'s, for exactly one night. Ask the paper whose idea that was."',
      },
      {
        match: (t) => t.includes('CAMERA') || t.includes('NEGATIVES') || t.includes('FILM'),
        minDisposition: 1,
        response: '"He mailed something the morning of." Quiet, to the taps. "Post office on Royal, first window. ' +
          'A man who mails a package before a meeting knows what kind of meeting it is."',
      },
    ],
  },
  fontaine: {
    aliases: ['FONTAINE'],
    fallback: 'Fontaine spreads his hands: the gesture of a man who has already told you everything he intends to.',
    fallbacks: [
      { response: 'Fontaine spreads his hands: the gesture of a man who has already told you everything he intends to.' },
      { response: 'He consults his watch, which is to say he shows you the watch. It cost more than your retainer.' },
      { response: '"Detective." A benediction and a dismissal in one word. He is very good at that word.' },
    ],
    reactiveMiss: [
      '"You mistake my establishment for the records room. Easy error — ours has better lighting and worse paper."',
      '"Ask me about music, tribute, or the liquor board. On all other subjects I am a very expensive mirror."',
    ],
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
    unless: ['levee'],
    match: (t) => t.includes('FRAME') || t.includes('CONTACT SHEET') || t.includes('NEGATIVE'),
    response: 'Frame 14 is the handoff. The frame AFTER the handoff left town in a mail sack. Find where the negatives went — or who they show.',
  },
  {
    requires: ['levee'],
    unless: ['blowup'],
    match: (t) => t.includes('FRAME') || t.includes('NEGATIVE') || t.includes('PRINT') || t.includes('PHOTO'),
    response: 'The frame hangs behind the words on the drum. The face is gone to the water spot; the near sleeve is not. Count what the dome light holds, and report it.',
  },
  {
    requires: ['patrol'],
    match: (t) => t.includes('PHOTOSTAT') || t.includes('ENTRIES') || t.includes('RECONSTRUCT'),
    response: 'Put the night in order: seen, then moved, then "found." Submit it as "timeline" and three letters.',
  },
]

export const missResponse = 'Nothing moves. A screen door claps somewhere, and a man on a gallery marks you without looking up.'

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

export const heat = { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, layLow: 25, max: 100, tail: 60 }

// The tail (§5.7): at heat 60 the District puts a car on you. Flag what
// repeats and the desk folds him — a real cooldown, bought with eyes.
export const tail = {
  open: [
    'The heat has a shape now. Three sightings, one afternoon:',
    '',
    '  Across from the Blue Room — a green Falcon sedan, parish plates,',
    '  idling with the windows up in ninety-degree wet.',
    '  On Dauphine, opposite the darkroom — the same green Falcon,',
    '  driver reading a menu from a place that closed last Lent.',
    '  At the wharf gates — the Falcon again, nose out, engine running.',
    '',
    'Something in that picture repeats. Flag it for the desk and the',
    'District loses its driver.',
  ].join('\n'),
  match: (t) => t.includes('FALCON') || t.includes('SEDAN') || (t.includes('GREEN') && (t.includes('CAR') || t.includes('PLATES'))),
  response: 'You walk a slow square around the block and come up on the driver\'s window from behind, and tap ' +
    'the glass, and ask him for a light. In the Quarter that is a funeral for a tail. The Falcon pulls off ' +
    'with the menu still on the dash, and the street forgets you for a while. (Heat falls.)',
  cool: 30,
}

export const helpText = [
  'HOW THIS WORKS — for the record, once:',
  '',
  '  Say it plain. GO somewhere, ASK someone, CHECK a thing.',
  '  Worked out the ad? Say where it points.',
  '  Reconstructing a night? "timeline A B C" in the order you believe.',
  '  Handed a photograph? The frame keeps what paper won\'t — study',
  '  the print on the drum, then report the detail you read.',
  '  Sure? "accuse <name>" — one accusation to a customer.',
  '  Town too warm? "lay low" — lose a few days, lose the tail.',
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
].join('\n')

export const preamble = [
  'Your notebook holds what you have earned. Nothing else is yours.',
  'Speak plainly — GO somewhere, ASK someone, CHECK a thing, OPEN what',
  'is closed. Curiosity is free; heat comes only from loud moves —',
  'pressing a source, flashing money, a bad accusation — and "lay low"',
  'cools it. Your open threads hang in the notebook on the right.',
  '',
  'A first move, if you want one: the classified ad is an acrostic.',
  'Read it downhill, first letters first, and say where it points.',
  '',
  '"help" buys you the house rules.',
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
  'the near sleeve in frame 15 wears desk sergeant stripes',
  'accuse broussard — the wet negative and the route order hold him',
]
