// director.mjs — client side of the Director (M3 slice 1).
//
// Detects a local noir-gm service (gm/director-service.mjs) and, when
// present, returns a voice function the GM engine calls per beat. Every
// path fails soft to the scripted line: no service, slow service, dry
// mode, network error — the game plays identically, just without the
// fresh prose.

const DEFAULT_URL = 'http://localhost:8787'

export async function detectDirector(url = localStorage.getItem('noir.gm.url') ?? DEFAULT_URL) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1200)
    const res = await fetch(`${url}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    const info = await res.json()
    return info.ok ? { url, live: !!info.director, model: info.model, images: !!info.images } : null
  } catch { return null }
}

/** Build a voice function for the GM: beat in, era prose out (or null → canned). */
export function makeVoice({ url, era, caseTitle, getTail }) {
  return async (beat) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12000)
    try {
      const res = await fetch(`${url}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ era, caseTitle, beat, tail: getTail() }),
      })
      const { text } = await res.json()
      return text || null
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Build an interrogator: NPC turn in, in-character reply + disposition delta out. */
export function makeInterrogator({ url, era, getTail }) {
  return async (npc) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
      const res = await fetch(`${url}/interrogate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ era, npc, tail: getTail() }),
      })
      const out = await res.json()
      return out?.reply ? out : null
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Build a judge: free-text attempt vs canonical answers → matched edge id or null. */
/** Free-report conversation: the desk answers from the earned file. */
export function makeConverse({ url, getTail }) {
  return async ({ report, context }) => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(`${url}/converse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...context, report, tail: getTail() }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      return data.text ?? null
    } catch { return null }
  }
}

export function makeJudge({ url }) {
  return async ({ attempt, answers }) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    try {
      const res = await fetch(`${url}/verdict`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ attempt, answers }),
      })
      return (await res.json())?.match ?? null
    } finally {
      clearTimeout(timer)
    }
  }
}
