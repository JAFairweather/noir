#!/usr/bin/env node
// Generate the Nave favicon set — one SVG per app — from the SAME seal
// glyphs used in the hub's app grid (nave/index.html). One frame, one
// accent per app, so a Nontact icon and a Noir icon are visibly siblings.
// Regenerable by design: change a glyph here, re-run, every repo's favicon
// updates from the one source of truth.
//
//   node scripts/gen-favicons.mjs
//
// Writes:
//   assets/favicons/<app>.svg   — the canonical set (for every repo)
//   nave/favicon.svg            — live copy for the hub (compass rose)
//   client/favicon.svg          — live copy for the game (Noir fedora)

import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INK = '#0b0906';

// Each app: its accent, and its seal glyph body on a 24×24 canvas —
// lifted verbatim from the seals in nave/index.html. `A` marks where the
// accent color is substituted (for fills that were currentColor).
const APPS = {
  noir: {
    accent: '#c39a56',
    glyph: `<path d="M3 18 Q12 22 21 18"/><path d="M7 18 Q6.5 9 12 9 Q17.5 9 17 18"/><path d="M7.5 16.2 Q12 18 16.5 16.2"/>`,
  },
  nvoy: {
    accent: '#6fa8a0',
    glyph: `<path d="M3 12 H16"/><path d="M12 7 L17 12 L12 17"/><circle cx="20" cy="12" r="1.6" fill="A" stroke="none"/>`,
  },
  nontact: {
    accent: '#8fae6a',
    glyph: `<circle cx="9.5" cy="12" r="6"/><circle cx="14.5" cy="12" r="6"/>`,
  },
  nvelope: {
    accent: '#9a83c0',
    glyph: `<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M4 7 L12 13 L20 7"/>`,
  },
  nherit: {
    accent: '#c0705a',
    glyph: `<circle cx="8" cy="12" r="4"/><path d="M12 12 H21"/><path d="M17 12 V15.5"/><path d="M20 12 V15.5"/>`,
  },
  ntrigue: {
    accent: '#c07a9a',
    glyph: `<path d="M8 12 L11 8 L14 12 L11 16 Z"/><path d="M13 12 L16 8 L19 12 L16 16 Z"/>`,
  },
  notegate: {
    accent: '#7f95ad',
    glyph: `<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11"/><circle cx="12" cy="15" r="1.2" fill="A" stroke="none"/>`,
  },
  nipda: {
    accent: '#d8c690',
    glyph: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="10.5" r="1.9"/><path d="M12 12.4 V15.6"/>`,
  },
};

// The hub gets the compass rose (100×100), not a seal.
const NAVE_ROSE = `<g transform="translate(14 14) scale(0.72)">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#c39a56" stroke-width="1.4" opacity="0.5"/>
  <path d="M50 6 L57 43 L94 50 L57 57 L50 94 L43 57 L6 50 L43 43 Z" fill="#c39a56" fill-opacity="0.16" stroke="#c39a56" stroke-width="1.6"/>
  <path d="M50 18 L54 46 L50 50 L46 46 Z" fill="#e2c079"/>
  <path d="M50 82 L54 54 L50 50 L46 54 Z" fill="#c39a56" fill-opacity="0.55"/>
  <circle cx="50" cy="50" r="3.4" fill="#e2c079"/>
</g>`;

function frame(accent, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Nave">
  <rect x="1" y="1" width="30" height="30" rx="7" fill="${INK}" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.2"/>
${inner}
</svg>
`;
}

function sealSvg(accent, glyph) {
  const g = glyph.replaceAll('"A"', `"${accent}"`);
  const inner = `  <g transform="translate(4 4)" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${g}
  </g>`;
  return frame(accent, inner);
}

const outDir = join(ROOT, 'assets', 'favicons');
mkdirSync(outDir, { recursive: true });

// The eight app seals.
for (const [name, { accent, glyph }] of Object.entries(APPS)) {
  writeFileSync(join(outDir, `${name}.svg`), sealSvg(accent, glyph));
}
// The hub rose.
const naveSvg = frame('#c39a56', `  ${NAVE_ROSE}`);
writeFileSync(join(outDir, 'nave.svg'), naveSvg);

// Live copies where the two in-repo sites actually serve from.
writeFileSync(join(ROOT, 'nave', 'favicon.svg'), naveSvg);
copyFileSync(join(outDir, 'noir.svg'), join(ROOT, 'client', 'favicon.svg'));

console.log('favicons written:', Object.keys(APPS).length + 1, '→ assets/favicons/');
console.log('live: nave/favicon.svg (rose), client/favicon.svg (noir)');
