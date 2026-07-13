// director.mjs — client side of the Director (M3 slice 1).
//
// Three ways the Director can exist, all behind ONE transport shape —
// post(path, payload) → the endpoint's JSON:
//   1. the local service (gm/director-service.mjs on :8787) — the
//      developer's instrument, with the desk panel and commentary;
//   2. a hosted table (any URL in noir.gm.url) — a sponsored Director
//      someone else pays for;
//   3. the browser itself (browser-director.mjs) — the player's key,
//      stored locally, calling Anthropic directly. Zero install.
// Every path fails soft to the scripted line: the game must always play.

const DEFAULT_URL = 'http://localhost:8787'

const httpPost = (url, ms = 15000) => async (path, payload) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(payload),
    })
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function detectDirector(url = localStorage.getItem('noir.gm.url') ?? DEFAULT_URL) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(`${url}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    const info = await res.json()
    return info.ok
      ? { url, live: !!info.director, model: info.model, images: !!info.images, post: httpPost(url) }
      : null
  } catch { return null }
}

/** Build a voice function for the GM: beat in, era prose out (or null → canned). */
export function makeVoice({ post, era, caseTitle, getTail }) {
  return async (beat) => {
    try {
      const { text } = await post('/voice', { era, caseTitle, beat, tail: getTail() })
      return text || null
    } catch { return null }
  }
}

/** Build an interrogator: NPC turn in, in-character reply + disposition delta out. */
export function makeInterrogator({ post, era, getTail }) {
  return async (npc) => {
    try {
      const out = await post('/interrogate', { era, npc, tail: getTail() })
      return out?.reply ? out : null
    } catch { return null }
  }
}

/** Free-report conversation: the desk answers from the earned file. */
export function makeConverse({ post, getTail }) {
  return async ({ report, context }) => {
    try {
      const data = await post('/converse', { ...context, report, tail: getTail() })
      return data.text ?? null
    } catch { return null }
  }
}

/** Build a judge: free-text attempt vs canonical answers → matched edge id or null. */
export function makeJudge({ post }) {
  return async ({ attempt, answers }) => {
    try {
      return (await post('/verdict', { attempt, answers }))?.match ?? null
    } catch { return null }
  }
}
