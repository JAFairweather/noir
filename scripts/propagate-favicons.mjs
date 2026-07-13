#!/usr/bin/env node
// Propagate the Nave seal favicons into every app repo, unifying them onto
// the one coherent system (replacing each repo's older, mismatched inline
// favicon). Run from the noir repo; the sibling repos must be cloned
// alongside it (…/nvoy, …/nontact, etc.).
//
//   node scripts/propagate-favicons.mjs            # apply
//   node scripts/propagate-favicons.mjs --dry      # preview only
//
// For each repo: writes favicon.svg at the root (canonical asset) and, in
// every HTML <head>, replaces an existing <link rel="icon"> or inserts one.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const WS = join(NOIR, '..');
const DRY = process.argv.includes('--dry');

// repo dir -> favicon file in assets/favicons/
const MAP = {
  nvoy: 'nvoy', nontact: 'nontact', nvelope: 'nvelope', nherit: 'nherit',
  ntrigue: 'ntrigue', notegate: 'notegate', 'nostr-scoped-data-grants': 'nipda',
};

function svgFor(name) {
  return readFileSync(join(NOIR, 'assets', 'favicons', `${name}.svg`), 'utf8');
}
function dataUri(svg) {
  const compact = svg.replace(/\n\s*/g, ' ').trim();
  return `data:image/svg+xml,${encodeURIComponent(compact)}`;
}
function linkTag(svg) {
  return `<link rel="icon" href="${dataUri(svg)}" type="image/svg+xml">`;
}
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walkHtml(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

const summary = [];
for (const [repo, icon] of Object.entries(MAP)) {
  const root = join(WS, repo);
  if (!existsSync(root)) { summary.push(`SKIP  ${repo} (not cloned)`); continue; }
  const svg = svgFor(icon);
  const tag = linkTag(svg);

  // 1) canonical asset at repo root
  if (!DRY) writeFileSync(join(root, 'favicon.svg'), svg);

  // 2) wire every HTML head
  let wired = 0, added = 0;
  for (const file of walkHtml(root)) {
    let html = readFileSync(file, 'utf8');
    if (!/<head[\s>]/i.test(html)) continue;
    if (/<link\s+rel=["']icon["'][^>]*>/i.test(html)) {
      const next = html.replace(/[ \t]*<link\s+rel=["']icon["'][^>]*>\s*\n?/gi, '');
      html = next;
      // insert fresh after <title> (or after charset meta, or right after <head>)
      html = insertIcon(html, tag);
      wired++;
    } else {
      html = insertIcon(html, tag);
      added++;
    }
    if (!DRY) writeFileSync(file, html);
  }
  summary.push(`${DRY ? 'DRY  ' : 'DONE '} ${repo.padEnd(26)} icon=${icon.padEnd(9)} html: ${wired} replaced, ${added} added`);
}

function insertIcon(html, tag) {
  if (/<\/title>/i.test(html)) return html.replace(/(<\/title>)/i, `$1\n${tag}`);
  if (/<meta\s+charset[^>]*>/i.test(html)) return html.replace(/(<meta\s+charset[^>]*>)/i, `$1\n${tag}`);
  return html.replace(/(<head[^>]*>)/i, `$1\n${tag}`);
}

console.log(summary.join('\n'));
