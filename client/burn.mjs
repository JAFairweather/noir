// burn.mjs — burn-notice interstitials and end-of-case cards (spec §2, §5.8).
//
// A kind-441 is not a toast. It stops the room: full-screen card, stamped,
// era-tinted, dismissed deliberately. Failure cards use the same chassis;
// the Meridian era's dysentery card (spec §8) will too, when it exists.

export function showBurnCard({ scopeName, reason }, onDismiss) {
  return showCard({
    stamp: 'BURN NOTICE',
    title: scopeName ?? 'ASSET',
    body: reason,
    footer: 'contact severed — you keep exactly what you already read',
  }, onDismiss)
}

export function showEndCard({ ended }, onDismiss) {
  const cards = {
    solved: {
      stamp: 'CASE CLOSED',
      title: 'RESOLUTION GRANTED',
      body: 'The resolution dossier is in your notebook. Read it on the drum.',
      footer: 'the epilogue is yours to keep',
    },
    failed: {
      stamp: 'CASE CLOSED',
      title: 'WRONG MAN',
      body: 'The accusation did not hold. Some files close without closing.',
      footer: 'you live with the epilogue',
    },
    heat: {
      stamp: 'EXFILTRATED',
      title: 'HEAT AT MAXIMUM',
      body: 'Station pulled you out. The case stays open; you do not.',
      footer: 'lay low. try another seed.',
    },
  }
  return showCard(cards[ended] ?? cards.failed, onDismiss)
}

/** Case selection: which night, which city. */
export function showCaseSelect(cases, onPick) {
  const overlay = document.createElement('div')
  overlay.className = 'card-overlay'
  // The case-file box stays gold; each scenario wears its own colour.
  const CASE_HUES = ['#6fa8a0', '#c07a9a', '#8fae6a', '#9a83c0', '#c0705a', '#7f95ad', '#d9a648', '#b98a5a']
  const buttons = cases.map((c, i) =>
    `<button class="save-btn case-btn" data-id="${c.id}" style="--case-accent:${CASE_HUES[i % CASE_HUES.length]}">
       <span class="case-era">${c.label}</span>
       <span class="case-title">${c.title}</span>
       <span class="case-blurb">${c.blurb}</span>
     </button>`).join('')
  overlay.innerHTML = `
    <div class="card save-card" role="dialog" aria-label="Choose a case">
      <div class="card-stamp">OPEN CASES</div>
      <div class="save-actions case-actions">${buttons}</div>
      <div class="card-footer">every case is a sealed world — solve it or wear it</div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('shown'))
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('.case-btn')
    if (!btn) return
    overlay.classList.remove('shown')
    setTimeout(() => overlay.remove(), 300)
    onPick(btn.dataset.id)
  })
}

/** The §8 save-file homage: LOAD GAME / NEW GAME in period teletype caps. */
export function showSaveCard({ onLoad, onNew }) {
  const overlay = document.createElement('div')
  overlay.className = 'card-overlay'
  overlay.innerHTML = `
    <div class="card save-card" role="dialog" aria-label="Saved case found">
      <div class="card-stamp">CASE FILE FOUND</div>
      <div class="card-body">An open case sits in the drawer where you left it.</div>
      <div class="save-actions">
        <button class="save-btn" data-act="load">LOAD GAME</button>
        <button class="save-btn" data-act="new">NEW GAME</button>
      </div>
      <div class="card-footer">a new game shreds the open file</div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('shown'))
  overlay.addEventListener('click', (e) => {
    const act = e.target?.dataset?.act
    if (!act) return
    overlay.classList.remove('shown')
    setTimeout(() => overlay.remove(), 300)
    act === 'load' ? onLoad() : onNew()
  })
}

function showCard({ stamp, title, body, footer }, onDismiss) {
  const overlay = document.createElement('div')
  overlay.className = 'card-overlay'
  overlay.innerHTML = `
    <div class="card" role="alertdialog" aria-label="${stamp}">
      <div class="card-stamp">${stamp}</div>
      <div class="card-title"></div>
      <div class="card-body"></div>
      <div class="card-footer"></div>
      <div class="card-hint">press any key</div>
    </div>`
  overlay.querySelector('.card-title').textContent = title
  overlay.querySelector('.card-body').textContent = body
  overlay.querySelector('.card-footer').textContent = footer
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('shown'))
  const dismiss = () => {
    window.removeEventListener('keydown', dismiss, true)
    overlay.removeEventListener('click', dismiss)
    overlay.classList.remove('shown')
    setTimeout(() => overlay.remove(), 300)
    onDismiss?.()
  }
  setTimeout(() => {
    window.addEventListener('keydown', dismiss, true)
    overlay.addEventListener('click', dismiss)
  }, 400)
  return dismiss
}
