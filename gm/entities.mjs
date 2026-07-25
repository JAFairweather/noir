// entities.mjs — the case's noun index (§5: commands parsed against the
// graph, not against one hidden phrase).
//
// Built from what every case already declares — scope display names, NPC
// aliases, and an optional per-edge `aliases` list — so "open the locker
// at the zoo" reaches the same node as the authored keyword match without
// authors enumerating synonyms by hand. The authored `edge.match` always
// runs first; this index is the fallback that makes plain phrasing land.

const normalize = (text) => String(text).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Words too generic to identify a node on their own. Everything shorter
// than four letters is dropped outright.
const STOP = new Set([
  'CASE', 'FILE', 'NOTE', 'WITH', 'FROM', 'THAT', 'THIS', 'WHAT', 'WHERE',
  'WHEN', 'THEM', 'THEY', 'HAVE', 'WILL', 'YOUR', 'THEIR', 'ABOUT', 'INTO',
  'OVER', 'UNDER', 'BEEN', 'WERE', 'CLOSED', 'STATEMENT', 'CONTENTS',
])

const nameTokens = (name) =>
  normalize(name).split(' ').filter(w => w.length >= 4 && !STOP.has(w))

/** Map of node key → Set of normalized aliases (words or phrases). */
export function buildEntityIndex(caseModule) {
  const index = new Map()
  const add = (key, alias) => {
    const a = normalize(alias)
    if (!a) return
    if (!index.has(key)) index.set(key, new Set())
    index.get(key).add(a)
  }
  for (const [key, def] of Object.entries(caseModule.scopes ?? {})) {
    add(key, key)                                   // the author's shorthand
    for (const w of nameTokens(def.name)) add(key, w)
  }
  for (const [key, npc] of Object.entries(caseModule.npcs ?? {}))
    for (const a of npc.aliases ?? []) add(key, a)
  for (const e of caseModule.edges ?? [])
    for (const a of e.aliases ?? []) add(e.to, a)
  return index
}

/** Does normalized text `t` mention any alias of `key`? Whole words only. */
export function mentions(index, key, t) {
  const aliases = index.get(key)
  if (!aliases) return false
  const padded = ` ${t} `
  for (const a of aliases) if (padded.includes(` ${a} `)) return true
  return false
}

// A command is an ACT (resolvable against the graph) only when it carries
// a doing-verb; bare questions stay conversation for the Director/miss
// path, so "what do we have on the dead man" never springs a dead drop.
const ACTION_VERB =
  /\b(GO|GOTO|VISIT|SEE|MEET|FIND|ASK|TALK|SPEAK|CHECK|OPEN|PULL|READ|REREAD|GET|FETCH|CALL|SEARCH|EXAMINE|LOOK|FOLLOW|VIEW|INSPECT|TAKE|TRY|WALK|HEAD|RETURN)\b/

export const isAction = (t) => ACTION_VERB.test(t)

// Bare exploration — a look with no destination the graph knows.
export const isSurvey = (t) =>
  /^(LOOK|EXAMINE|SEARCH|EXPLORE|SURVEY|SCOUT|INSPECT)\b/.test(t)
