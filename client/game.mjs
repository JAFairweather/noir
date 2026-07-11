// game.mjs — command input, notebook (Grant Index view), case state (spec §3).
//
// M1+ runs in demo mode: an in-memory relay and the stub GM live in-page, so
// the whole game — scopes, grants, burns — is real protocol traffic you can
// inspect, with zero infrastructure. Pointing this at LiveRelay + a remote
// GM (M2/M3) changes the transport, not this file's logic.
//
// The case survives reloads: relay events, GM state, and the transcript
// autosave to localStorage after every exchange, and the player's notebook
// is additionally published as a real kind-10440 Grant Index — the same
// record a live-relay client would recover from the nsec alone.

import { nip19 } from 'nostr-tools'
import { Relay } from '../lib/relay.mjs'
import {
  receiveGrants, latestGrants, fetchScope, saveGrantIndex, toReceivedEntry,
} from '../lib/nipxx.mjs'
import {
  sendFieldReport, receiveRumors, KIND_GM_DISPATCH, KIND_BURN_NOTICE,
} from '../shared/wrap.mjs'
import { StubGM } from '../gm/stubgm.mjs'
import { CASES, CASE_LIST } from '../gm/cases/registry.mjs'
import { generateCase } from '../gm/casegen.mjs'
import { Wheel } from './wheel.mjs'
import { Score } from './audio.mjs'
import { applyEra } from './art.mjs'
import { setScene } from './scenes.mjs'
import { detectDirector, makeVoice, makeInterrogator, makeJudge } from './director.mjs'
import { showBurnCard, showEndCard, showSaveCard, showCaseSelect } from './burn.mjs'
import { getOrCreatePlayerKey, getFlatMode, setFlatMode, getCaseId, setCaseId, getTradecraft, setTradecraft } from './settings.mjs'

const $ = (sel) => document.querySelector(sel)
const SAVE_KEY = 'noir.save.v1'

const { sk: playerSk, pub: playerPub } = getOrCreatePlayerKey()

// A case id is either a registered module or 'gen:<seed>' from casegen.
const resolveCase = (id) => CASES[id] ?? (id?.startsWith('gen:') ? generateCase(id.slice(4)) : null)

const relay = new Relay()
let CASE = resolveCase(getCaseId()) ?? CASES[CASE_LIST[0].id]
let gm = new StubGM(relay, CASE)

const wheel = new Wheel($('#drum'), $('#flat'))
wheel.setFlatMode(getFlatMode())
$('#flat-toggle').checked = getFlatMode()
$('#tc-toggle').checked = getTradecraft()

const seen = new Set()          // wrap ids already rendered
const knownScopes = new Set()   // scopeIds already announced on the drum
const transcript = []           // { text, cls } — replayed on restore
let gameOver = false

// The 19-TET score (docs/DECISIONS.md §6). Off until the player opts in —
// this is a reading game; the music is furniture, and silence is a choice.
const score = new Score()

// write to the drum AND the save file
function put(text, cls = '') {
  transcript.push({ text, cls })
  wheel.append(text, cls)
}

// ------------------------------------------------------------- persistence

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      caseId: CASE.CASE_ID,
      events: relay.events,
      gm: gm.serialize(),
      transcript,
      seen: [...seen],
      knownScopes: [...knownScopes],
      gameOver,
    }))
  } catch { /* storage full/blocked: the game still plays, it just won't keep */ }
}

function loadSave() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')
    return resolveCase(save?.caseId) && save.events?.length ? save : null
  } catch { return null }
}

function clearSave() { localStorage.removeItem(SAVE_KEY) }

// ---------------------------------------------------------------- notebook

async function refreshNotebook() {
  const grants = latestGrants(await receiveGrants(relay, playerSk))
  const list = $('#notebook-list')
  list.innerHTML = ''
  for (const g of grants) {
    const res = await fetchScope(relay, g)
    const li = document.createElement('li')
    li.className = res.status === 'ok' ? 'scope-ok' : 'scope-stale'
    li.innerHTML = `<span class="scope-name"></span><span class="scope-status">${res.status === 'ok' ? '' : 'BURNED'}</span>`
    li.querySelector('.scope-name').textContent = g.scopeName ?? g.scopeId
    if (getTradecraft()) {
      const meta = document.createElement('span')
      meta.className = 'tc-meta'
      meta.textContent = `30440:${g.publisher.slice(0, 12)}…  d=${g.scopeId}  v=${g.generation}`
      li.appendChild(meta)
    }
    if (res.status === 'ok') {
      li.title = 'Read on the drum'
      li.addEventListener('click', () => {
        if (res.data.scene) setScene(res.data.scene, CASE.ERA, g.scopeId)
        put(`— ${res.data.title ?? g.scopeName} —`, 'doc-title')
        put(res.data.body ?? '', 'doc')
        saveGame()
      })
    } else {
      li.title = 'Burned. You keep exactly what you already read.'
    }
    list.appendChild(li)
  }
  $('#heat-value').textContent = gm.heat
  $('#heat-lamp').style.setProperty('--heat', gm.heat / 100)
  const panel = $('#tc-panel')
  panel.classList.toggle('hidden', !getTradecraft())
  if (getTradecraft()) {
    const kinds = {}
    for (const e of relay.events) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
    panel.textContent = 'RELAY VIEW (what an observer sees): ' +
      Object.entries(kinds).map(([k, n]) => `kind-${k}×${n}`).join(' · ') +
      ' — all ciphertext; grants are 1059 wraps under ephemeral keys; your notebook is the NIP-44-to-self kind-10440.'
  }
  return grants
}

// ------------------------------------------------------------ GM mail sync

async function syncFromGM() {
  const rumors = await receiveRumors(relay, playerSk, [KIND_GM_DISPATCH, KIND_BURN_NOTICE])
  for (const r of rumors) {
    if (seen.has(r._wrapId)) continue
    seen.add(r._wrapId)
    if (r.kind === KIND_BURN_NOTICE) {
      const { reason } = JSON.parse(r.content)
      const scopeId = r.tags.find(t => t[0] === 'a')?.[1].split(':')[2]
      const grants = latestGrants(await receiveGrants(relay, playerSk))
      const scopeName = grants.find(g => g.scopeId === scopeId)?.scopeName
      put(`■ BURN NOTICE — ${scopeName ?? 'asset'} ■`, 'burn-line')
      score.burn()              // the theme stops mid-phrase
      showBurnCard({ scopeName, reason })
    } else {
      const { text, ended } = JSON.parse(r.content)
      put(text, 'gm')
      if (ended) {
        gameOver = true
        if (ended !== 'solved') showEndCard({ ended })
        else setTimeout(async () => {
          // surface the epilogue automatically on a win
          const grants = latestGrants(await receiveGrants(relay, playerSk))
          for (const g of grants) {
            const res = await fetchScope(relay, g)
            if (res.status === 'ok' && res.data.kind === 'epilogue') {
              if (res.data.scene) setScene(res.data.scene, CASE.ERA, g.scopeId)
              put(`— ${res.data.title} —`, 'doc-title')
              put(res.data.body, 'doc')
            }
          }
          saveGame()
          showEndCard({ ended })
        }, 600)
      }
    }
  }
  // Announce newly granted scopes on the drum and open them.
  const grants = latestGrants(await receiveGrants(relay, playerSk))
  for (const g of grants) {
    if (knownScopes.has(g.scopeId)) continue
    knownScopes.add(g.scopeId)
    const res = await fetchScope(relay, g)
    if (res.status !== 'ok') continue
    if (res.data.scene) setScene(res.data.scene, CASE.ERA, g.scopeId)
    put(`▸ NEW INTEL — ${g.scopeName}`, 'grant-line')
    put(`— ${res.data.title ?? g.scopeName} —`, 'doc-title')
    put(res.data.body ?? '', 'doc')
  }
  await refreshNotebook()
  score.setHeat(gm.heat)
  // Publish the notebook as a real kind-10440 Grant Index (M2): on a live
  // relay this is what device recovery from the nsec reads back.
  try {
    await saveGrantIndex(relay, playerSk, {
      issued: [],
      received: grants.map(g => toReceivedEntry(g, g.scopeName)),
    })
  } catch { /* index is a convenience record; play continues without it */ }
  saveGame()
}

// ---------------------------------------------------------------- commands

const history = []
let historyAt = -1

async function submit(text) {
  if (!text.trim() || gameOver) return
  history.push(text)
  historyAt = history.length
  put(`> ${text}`, 'player')
  await sendFieldReport(relay, playerSk, gm.pub, text, CASE.CASE_ID)
  await gm.poll()               // demo mode: the GM lives in-page
  await syncFromGM()
}

const input = $('#cmd')
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = input.value
    input.value = ''
    submit(text)
  } else if (e.key === 'ArrowUp' && history.length) {
    e.preventDefault()
    historyAt = Math.max(0, historyAt - 1)
    input.value = history[historyAt] ?? ''
  } else if (e.key === 'ArrowDown' && history.length) {
    e.preventDefault()
    historyAt = Math.min(history.length, historyAt + 1)
    input.value = history[historyAt] ?? ''
  }
})
window.addEventListener('keydown', (e) => {
  if (e.target === input) return          // input owns its keys (incl. history)
  if (e.key === ' ') {
    e.preventDefault()
    wheel.advanceBeat()
  } else if (e.key.length === 1) {
    input.focus()
  }
})

$('#flat-toggle').addEventListener('change', (e) => {
  setFlatMode(e.target.checked)
  wheel.setFlatMode(e.target.checked)
})

$('#tc-toggle').addEventListener('change', (e) => {
  setTradecraft(e.target.checked)
  refreshNotebook()
})

$('#score-toggle').addEventListener('change', (e) => {
  if (e.target.checked) score.start()   // user gesture — autoplay-safe
  else score.stop()
})

// ------------------------------------------------------------------- start

let director = null   // resolved once at boot

function applyCase(mod) {
  CASE = mod
  setCaseId(mod.CASE_ID)
  const era = applyEra(mod.ERA)
  score.setEra(mod.ERA)
  $('#era-label').textContent = era.label
  setScene(mod.openingScene ?? 'street', mod.ERA, mod.CASE_ID)
}

// The Director voices beats when its local service is running (M3);
// otherwise the scripted prose plays. Attached to whatever GM is current.
function attachVoice() {
  if (!director?.live) return
  const getTail = () => transcript.slice(-6).map(l => l.text).filter(t => t.length > 2)
  gm.voice = makeVoice({
    url: director.url,
    era: CASE.ERA,
    caseTitle: CASE.scopes.briefing?.name ?? CASE.CASE_ID,
    getTail,
  })
  gm.interrogator = makeInterrogator({ url: director.url, era: CASE.ERA, getTail })
  gm.judge = makeJudge({ url: director.url })
  $('#director-status').textContent = `DIRECTOR: ${director.model}`
  $('#director-status').classList.remove('hidden')
}

async function freshStart(caseId) {
  clearSave()
  applyCase(resolveCase(caseId) ?? CASE)
  gm = new StubGM(relay, CASE)
  attachVoice()
  put('N O I R', 'title-line')
  put('Cases you unlock. Assets you burn.', 'gm dim')
  await gm.start(playerPub)
  await syncFromGM()
  input.focus()
}

async function resumeSave(save) {
  applyCase(resolveCase(save.caseId))
  relay.events = save.events
  gm = StubGM.restore(relay, CASE, save.gm)
  attachVoice()
  gameOver = save.gameOver
  save.seen.forEach(id => seen.add(id))
  save.knownScopes.forEach(id => knownScopes.add(id))
  for (const { text, cls } of save.transcript) {
    transcript.push({ text, cls })
    wheel.append(text, cls, { instant: true })
  }
  put('— the file reopens where you left it —', 'gm dim')
  await refreshNotebook()
  score.setHeat(gm.heat)
  input.focus()
}

const pickCase = () => showCaseSelect([
  ...CASE_LIST,
  {
    id: `gen:${Math.random().toString(36).slice(2, 8)}`,
    label: 'BERLIN 1938 — FROM SEED',
    title: 'A Courier Overdue',
    blurb: 'A generated case: new names, new cipher, new culprit. Same seed, same case — committed before you play.',
  },
], (id) => freshStart(id))
applyEra(CASE.ERA)
director = await detectDirector()
$('#npub').textContent = nip19.npubEncode(playerPub).slice(0, 20) + '…' + nip19.npubEncode(playerPub).slice(-6)
$('#npub').title = nip19.npubEncode(playerPub) +
  '\n\nA per-browser field identity for the demo. Sign-in with a NIP-07 extension' +
  ' (Alby/nos2x) or nsec import arrives with live relays — then your notebook follows your real npub.'
const save = loadSave()
if (save && !save.gameOver) {
  showSaveCard({ onLoad: () => resumeSave(save), onNew: pickCase })
} else {
  pickCase()
}
