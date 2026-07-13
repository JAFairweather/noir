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
import { generateWebCase, SUPPORTED_ERAS } from '../gm/caseweb.mjs'
import { Wheel } from './wheel.mjs'
import { Score } from './audio.mjs'
import { applyEra } from './art.mjs'
import { setScene, enableDirectorScenes, getPenMode, setPenMode } from './scenes.mjs'
import { CityMap } from './map.mjs'
import { detectDirector, makeVoice, makeInterrogator, makeJudge, makeConverse } from './director.mjs'
import { browserDirector } from './browser-director.mjs'
import { showBurnCard, showEndCard, showSaveCard, showCaseSelect } from './burn.mjs'
import { getOrCreatePlayerKey, getFlatMode, setFlatMode, getCaseId, setCaseId, getTradecraft, setTradecraft } from './settings.mjs'
import { hasNip07, signIn, sendNotesToHouse } from './master.mjs'

const $ = (sel) => document.querySelector(sel)
const SAVE_KEY = 'noir.save.v1'

const { sk: playerSk, pub: playerPub } = getOrCreatePlayerKey()

// A case id is a registered module, 'gen:<seed>' (Berlin), 'gen:<era>:<seed>'
// from casegen, or 'web:<era>:<seed>' — a deep deduction-web case.
const resolveCase = (id) => {
  if (CASES[id]) return CASES[id]
  if (id?.startsWith('web:')) {
    const rest = id.slice(4)
    const sep = rest.indexOf(':')
    return sep > 0 ? generateWebCase(rest.slice(sep + 1), rest.slice(0, sep)) : generateWebCase(rest)
  }
  if (!id?.startsWith('gen:')) return null
  const rest = id.slice(4)
  const sep = rest.indexOf(':')
  return sep > 0 ? generateCase(rest.slice(sep + 1), rest.slice(0, sep)) : generateCase(rest)
}

const relay = new Relay()
let CASE = resolveCase(getCaseId()) ?? CASES[CASE_LIST[0].id]
let gm = new StubGM(relay, CASE)

const wheel = new Wheel($('#drum'), $('#flat'))
const cityMap = new CityMap(document.querySelector('#citymap'))
wheel.setFlatMode(getFlatMode())
$('#flat-toggle').checked = getFlatMode()
$('#pen-toggle').checked = getPenMode()
$('#pen-toggle').addEventListener('change', (e) => setPenMode(e.target.checked))
$('#tc-toggle').checked = getTradecraft()

const seen = new Set()          // wrap ids already rendered
const knownScopes = new Set()   // scopeIds already announced on the drum
const transcript = []           // { text, cls } — replayed on restore
let gameOver = false

// The 19-TET score (docs/DECISIONS.md §6). Off until the player opts in —
// this is a reading game; the music is furniture, and silence is a choice.
const score = new Score()

// write to the drum AND the save file
let lastAnchor = 'the opening'
function put(text, cls = '') {
  transcript.push({ text, cls })
  if (cls === 'doc-title') lastAnchor = text.replace(/^—\s*|\s*—$/g, '').trim()
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
        if (res.data.scene) { setScene(res.data.scene, CASE.ERA, g.scopeId); cityMap.travelTo(g.scopeId) }
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
  // the board: white venues, accent people, hollow leads (map-as-board v2)
  try {
    const spots = []
    for (const g of grants) {
      const res = await fetchScope(relay, g)
      spots.push({
        id: g.scopeId,
        name: (g.scopeName ?? '').split('—').pop().trim() || g.scopeId,
        type: res.data?.kind === 'npc' ? 'person' : 'venue',
      })
    }
    const known = gm.case.edges
      .filter(e => !gm.unlocked.has(e.to) && e.requires.every(r => gm.unlocked.has(r)) && e.lead)
      .map(e => ({ id: 'lead:' + e.to, name: gm.case.scopes[e.to]?.name.split('—').pop().trim() ?? e.to, type: 'lead' }))
    cityMap.setSpots([...spots, ...known])
  } catch { /* the board is garnish; never let it stop the case */ }
  renderDeduction()
  renderNotes()
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

// Margin notes (author mode): the case plays exactly as the engine
// presents it; the author annotates the text as it flows. Notes anchor
// to the document on screen, persist per case, EXPORT as markdown for
// the workshop, and the freshest few ride along to the Director as
// advisory style notes — the game improves mid-session and after it.
const notesKey = () => 'noir.notes.' + CASE.CASE_ID
function getNotes() {
  try { return JSON.parse(localStorage.getItem(notesKey()) ?? '[]') } catch { return [] }
}
function setNotes(notes) {
  try { localStorage.setItem(notesKey(), JSON.stringify(notes)) } catch { /* keep playing */ }
}
function renderNotes() {
  const on = localStorage.getItem('noir.notes.on') === '1'
  $('#margin').classList.toggle('hidden', !on)
  if (!on) return
  const list = $('#note-list')
  list.innerHTML = ''
  const notes = getNotes()
  for (let i = notes.length - 1; i >= Math.max(0, notes.length - 6); i--) {
    const n = notes[i]
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = n.at
    li.appendChild(b)
    li.appendChild(document.createTextNode(n.note))
    if (n.sent) {
      const check = document.createElement('span')
      check.className = 'note-sent'
      check.textContent = '✓'
      check.title = 'sent to house'
      li.appendChild(check)
    }
    const del = document.createElement('button')
    del.className = 'note-del'
    del.textContent = '✕'
    del.title = 'delete this note'
    del.addEventListener('click', () => {
      const all = getNotes()
      all.splice(i, 1)
      setNotes(all)
      renderNotes()
    })
    li.appendChild(del)
    list.appendChild(li)
  }
  // SEND TO HOUSE appears only when both ends exist: an extension to
  // sign as the master, and a table that told us its agent npub.
  $('#note-send').classList.toggle('hidden', !(hasNip07() && director?.houseCard?.agent))
}
function wireNotes() {
  $('#notes-toggle').checked = localStorage.getItem('noir.notes.on') === '1'
  $('#notes-toggle').addEventListener('change', (e) => {
    localStorage.setItem('noir.notes.on', e.target.checked ? '1' : '0')
    renderNotes()
  })
  $('#note-add').addEventListener('click', () => {
    const note = $('#note-input').value.trim()
    if (!note) return
    const notes = getNotes()
    notes.push({ at: lastAnchor, note, when: new Date().toISOString() })
    try { localStorage.setItem(notesKey(), JSON.stringify(notes)) } catch { /* keep playing */ }
    $('#note-input').value = ''
    renderNotes()
  })
  $('#note-export').addEventListener('click', () => {
    const notes = getNotes()
    // The clipboard gets a CONSOLE-READY scope payload: paste it into the
    // nvoy console, grant it to the Director, and the house folds your
    // notes into its voice within the next poll — NIP-DA as the courier.
    // The download stays markdown: the human archive of the workshop.
    const payload = JSON.stringify({
      name: `House notes — ${CASE.TITLE ?? CASE.CASE_ID}, ${notes.length} entries`,
      kind: 'house-notes',
      notes: notes.map(n => `[${n.at}] ${n.note}`),
    }, null, 2)
    try { navigator.clipboard?.writeText(payload) } catch { /* download still happens */ }
    const md = [
      `# Margin notes — ${CASE.TITLE ?? CASE.CASE_ID} (${CASE.CASE_ID})`,
      '', ...notes.map(n => `- **[${n.at}]** ${n.note}`), '',
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = `noir-notes-${CASE.CASE_ID.replace(/[^a-z0-9-]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  // The direct wire: notes leave the game as a NIP-DA scope on the
  // MASTER'S identity, granted to the table's agent npub, over the
  // relays the table watches. The extension signs; no console detour.
  $('#note-send').addEventListener('click', async () => {
    const status = $('#note-status')
    const show = (msg) => { status.textContent = msg; status.classList.remove('hidden') }
    // Only what has not gone yet: each send is its own granted scope,
    // and the house folds them all — re-sending would double the voice.
    const unsent = getNotes().filter(n => !n.sent)
    if (!unsent.length) return show('nothing new — everything pinned has already gone to the house')
    const card = director?.houseCard
    if (!card?.agent) return show('no table in reach — engage a Director first')
    if (!card.relays?.length) return show('the table is not watching any relays — set NOIR_RELAYS on the Director and restart it')
    show('signing… your extension will ask')
    try {
      await sendNotesToHouse({
        notes: unsent.map(n => `[${n.at}] ${n.note}`),
        name: `House notes — ${CASE.TITLE ?? CASE.CASE_ID}, ${unsent.length} entries`,
        directorNpub: card.agent,
        relays: card.relays,
      })
      const sentAt = new Set(unsent.map(n => n.when))
      setNotes(getNotes().map(n => sentAt.has(n.when) ? { ...n, sent: true } : n))
      renderNotes()
      show(`sent — ${unsent.length} note${unsent.length > 1 ? 's' : ''} granted to the house. The Director folds them within two minutes.`)
    } catch (err) {
      show('the grant did not land: ' + String(err?.message ?? err).slice(0, 100))
    }
  })
}
wireNotes()

// The deduction board (DECISIONS §8): the player's own marks, suspects
// against the three trails. The game never fills a cell — deduction is
// the one job the desk refuses to do for you. Marks persist per case.
function renderDeduction() {
  const box = $('#deduce')
  // The grid stays dark until the story has named the cast — but the
  // board is only one of the documents that does. The trail lists (the
  // rota, the key book, the personnel file) each print three of the
  // four; any of them earns the player their own grid.
  const castKnown = ['board', 'rota', 'keybook', 'personnel'].some(s => gm?.unlocked?.has(s))
  if (!CASE.board || !castKnown) { box.classList.add('hidden'); return }
  box.classList.remove('hidden')
  const KEY = 'noir.deduce.' + CASE.CASE_ID
  let marks
  try { marks = JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { marks = {} }
  const grid = $('#deduce-grid')
  grid.innerHTML = ''
  const head = document.createElement('tr')
  head.appendChild(document.createElement('th'))
  for (const c of CASE.board.columns) {
    const th = document.createElement('th')
    th.textContent = c
    head.appendChild(th)
  }
  grid.appendChild(head)
  for (const name of CASE.board.suspects) {
    const tr = document.createElement('tr')
    const th = document.createElement('th')
    th.textContent = name
    tr.appendChild(th)
    CASE.board.columns.forEach((_, i) => {
      const td = document.createElement('td')
      const k = name + '|' + i
      td.textContent = marks[k] ?? ''
      td.className = marks[k] === '\u2713' ? 'yes' : marks[k] === '\u2717' ? 'no' : ''
      td.addEventListener('click', () => {
        const cur = marks[k]
        if (cur === '\u2713') marks[k] = '\u2717'
        else if (cur === '\u2717') delete marks[k]
        else marks[k] = '\u2713'
        try { localStorage.setItem(KEY, JSON.stringify(marks)) } catch { /* board still works, just won't keep */ }
        renderDeduction()
      })
      tr.appendChild(td)
    })
    grid.appendChild(tr)
  }
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
              if (res.data.scene) { setScene(res.data.scene, CASE.ERA, g.scopeId); cityMap.travelTo(g.scopeId) }
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
    if (res.data.scene) { setScene(res.data.scene, CASE.ERA, g.scopeId); cityMap.travelTo(g.scopeId) }
    put('', 'dim')   // let the finished text breathe before the intel lands
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
const inEditable = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
window.addEventListener('keydown', (e) => {
  if (inEditable(e.target)) return        // fields own their keys — notes, keys, command
  if (e.metaKey || e.ctrlKey || e.altKey) return   // Cmd+C must copy, not steal focus
  if (e.key === ' ') {
    e.preventDefault()
    wheel.advanceBeat()
  } else if (e.key.length === 1) {
    input.focus()
  }
})

$('#nb-toggle').addEventListener('click', () => $('#notebook').classList.toggle('open'))

// GEAR: the rig (identity, Director, margin notes, switches) is its own
// column, and hideable — the case reads wider with the toolbox stowed.
{
  const rig = $('#rig')
  if (localStorage.getItem('noir.rig.stowed') === '1') rig.classList.add('stowed')
  $('#rig-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 720) { rig.classList.toggle('open'); return }
    rig.classList.toggle('stowed')
    localStorage.setItem('noir.rig.stowed', rig.classList.contains('stowed') ? '1' : '0')
  })
}
// reading a dossier from the notebook should hand the phone back to the drum
$('#notebook-list').addEventListener('click', () => {
  if (window.innerWidth <= 720) $('#notebook').classList.remove('open')
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
  $('#era-label').textContent = era.label + (mod.TITLE ? ` — ${mod.TITLE}` : '')
  cityMap.setCase(mod.ERA, mod.CASE_ID)
  setScene(mod.openingScene ?? 'street', mod.ERA, mod.CASE_ID)
}

// The Director voices beats when its local service is running (M3);
// otherwise the scripted prose plays. Attached to whatever GM is current.
function attachVoice() {
  if (director?.images && director.url) enableDirectorScenes(director.url)
  if (!director?.live) return
  const getTail = () => transcript.slice(-10).map(l => l.text).filter(t => t.length > 2)
  const post = director.post
  const getStyleNotes = () => getNotes().slice(-8).map(n => n.note)
  gm.voice = makeVoice({
    post,
    era: CASE.ERA,
    caseTitle: CASE.scopes.briefing?.name ?? CASE.CASE_ID,
    getTail,
    getStyleNotes,
  })
  gm.interrogator = makeInterrogator({ post, era: CASE.ERA, getTail })
  gm.converse = makeConverse({ post, getTail, getStyleNotes })
  gm.judge = makeJudge({ post })
  $('#director-status').textContent = director.house ? `TABLE: ${director.house}` : `DIRECTOR: ${director.model}${director.browser ? ' (in-browser)' : ''}`
  $('#director-status').classList.remove('hidden')
}

// The DIRECTOR box must never read as an open question when a table is
// already engaged: the status line says who is running the game and from
// where; the input below it is only for switching tables or keys.
function refreshDirStatus() {
  const el = $('#dir-status')
  if (!el) return
  const where = (u) => u.replace(/^https?:\/\//, '')
  if (director?.live && director.url) {
    const name = director.houseCard?.name ?? director.house
    el.textContent = `engaged — ${name ? name + ' · ' : ''}${where(director.url)}`
  } else if (director?.live) {
    el.textContent = 'engaged — your key, this browser only'
  } else if (director?.url) {
    el.textContent = `table found at ${where(director.url)} — dry mode (scripted prose)`
  } else {
    el.textContent = 'no table engaged — the desk runs scripted'
  }
}

// Engage a Director from the notebook: an Anthropic key (stored only in
// this browser; calls go straight to Anthropic on the player's account)
// or a hosted table address someone else sponsors.
function wireDirectorBox() {
  const input = $('#dir-key')
  const btn = $('#dir-engage')
  if (!input || !btn) return
  const current = localStorage.getItem('noir.anthropic.key') ? 'key engaged (this browser only)'
    : localStorage.getItem('noir.gm.url') ? 'table: ' + localStorage.getItem('noir.gm.url')
    : ''
  if (current) input.placeholder = current
  if (btn.dataset.wired) return               // placeholder refresh only — never stack listeners
  btn.dataset.wired = '1'
  btn.addEventListener('click', async () => {
    const v = input.value.trim()
    if (v.startsWith('sk-ant-')) {
      localStorage.setItem('noir.anthropic.key', v)
      localStorage.removeItem('noir.gm.url')
    } else if (/^https?:\/\//.test(v)) {
      localStorage.setItem('noir.gm.url', v.replace(/\/$/, ''))
      localStorage.removeItem('noir.anthropic.key')
    } else if (v === '') {
      localStorage.removeItem('noir.anthropic.key')
      localStorage.removeItem('noir.gm.url')
      director = null
      $('#director-status').classList.add('hidden')
      input.placeholder = 'sk-ant… key, or a table address'
      refreshDirStatus()
      return
    } else return
    input.value = ''
    director = (await detectDirector()) ?? browserDirector()
    if (director?.live) {
      attachVoice()
      put('— a second typewriter starts up somewhere close. The Director is in. —', 'gm dim')
    }
    wireDirectorBox()
    refreshDirStatus()
    renderNotes()
  })
}

/** The preamble holds until the reader is ready: space, enter, or a tap. */
function waitForBegin() {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onTap, true)
      resolve()
    }
    const onKey = (e) => {
      if (inEditable(e.target)) return    // typing a note is not opening the file
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done() }
    }
    const onTap = (e) => {
      // The notebook is dashboard, not door: engaging a Director key or
      // flipping a toggle at the preamble must not open the file.
      if (e.target.closest?.('#notebook') || e.target.closest?.('#rig')) return
      done()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onTap, true)
  })
}

async function freshStart(caseId) {
  clearSave()
  applyCase(resolveCase(caseId) ?? CASE)
  gm = new StubGM(relay, CASE)
  attachVoice()
  put('N O I R', 'title-line')
  put('Cases you unlock. Assets you burn.', 'gm dim')
  if (CASE.preamble) {
    put('', '')
    put(CASE.preamble, 'gm')
  }
  wheel.append('', '')
  wheel.append('— press space, and the file opens —', 'gm dim', { instant: true })
  input.blur()
  await waitForBegin()
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

// The house's rooms: when seated at a table (a connected Director with a
// house card), the picker offers THAT table's scenarios in its order and
// words. Otherwise, the default four. Either way, only eras the engine
// can actually build are offered.
const DEFAULT_ERAS = [
  {
    id: 'berlin-1938', label: 'BERLIN 1938', title: 'The Canal Keeps Nothing',
    blurb: 'A courier comes back by canal. Four men had the evening side; three lists will cut them to one.',
  },
  {
    id: 'paris-1954', label: 'PARIS 1954', title: 'The Blue Hour',
    blurb: 'The Seine returns an exact man. The winter light arrives late; so, in the end, does justice.',
  },
  {
    id: 'neworleans-1968', label: 'NEW ORLEANS 1968', title: 'What the River Returned',
    blurb: 'The river gives back a photographer, minus his camera. The Quarter pretends not to notice.',
  },
  {
    id: 'meridian-1849', label: 'THE MERIDIAN 1849', title: 'The Dry Wash',
    blurb: 'The buzzards rise over the survey line. The country is the witness, and it testifies slowly.',
  },
]
const pickCase = () => {
  const rooms = (director?.houseCard?.eras?.length ? director.houseCard.eras : DEFAULT_ERAS)
    .filter(e => SUPPORTED_ERAS.includes(e.id))
  showCaseSelect(rooms.map(e => ({
    id: `web:${e.id}:${Math.random().toString(36).slice(2, 8)}`,
    label: e.label ?? e.id,
    title: e.title ?? '',
    blurb: e.blurb ?? '',
  })), (id) => freshStart(id))
}
applyEra(CASE.ERA)
director = (await detectDirector()) ?? browserDirector()
wireDirectorBox()
refreshDirStatus()
if (!director) {
  // The entrance stays the same whether the page is local or hosted:
  // localhost is a secure origin, so even the HTTPS site may call the
  // local Director. Keep listening — starting `npm run gm` mid-case
  // brings the pen to life without a reload.
  const probe = setInterval(async () => {
    const found = await detectDirector()
    if (!found) return
    clearInterval(probe)
    director = found
    attachVoice()
    refreshDirStatus()
    renderNotes()
    if (found.live) put('— a second typewriter starts up somewhere close. The Director is in. —', 'gm dim')
    else if (found.images) put('— the darkroom light comes on. Scenes will develop. —', 'gm dim')
  }, 15000)
}

// Two identities, honestly labeled: the per-browser field key plays the
// case; SIGN IN (NIP-07) shows the master's real npub — the key that can
// grant house notes. The nsec never enters this page either way.
function renderIdentity() {
  const fieldNpub = nip19.npubEncode(playerPub)
  const m = localStorage.getItem('noir.master.pub')
  if (m) {
    const npub = nip19.npubEncode(m)
    $('#npub-label').textContent = 'MASTER IDENTITY (NIP-07)'
    $('#npub').textContent = npub.slice(0, 20) + '…' + npub.slice(-6)
    $('#npub').title = npub + '\n\nYour real key, held by your extension. The field key ' +
      fieldNpub.slice(0, 12) + '… still plays the case; yours signs what only a master may — house notes.'
    $('#signin').classList.add('hidden')
  } else {
    $('#npub-label').textContent = 'FIELD IDENTITY'
    $('#npub').textContent = fieldNpub.slice(0, 20) + '…' + fieldNpub.slice(-6)
    $('#npub').title = fieldNpub +
      '\n\nA per-browser field identity for the demo. Sign in with a NIP-07 extension' +
      ' (Alby/nos2x) to act as yourself — your notebook following your real npub arrives with live relays.'
    $('#signin').classList.toggle('hidden', !hasNip07())
  }
}
$('#signin').addEventListener('click', async () => {
  try { await signIn() } catch { /* the extension declined; stay a field agent */ }
  renderIdentity()
  renderNotes()
})
renderIdentity()
if (!hasNip07()) setTimeout(renderIdentity, 2500)   // extensions can inject late
const save = loadSave()
if (save && !save.gameOver) {
  showSaveCard({ onLoad: () => resumeSave(save), onNew: pickCase })
} else {
  pickCase()
}
