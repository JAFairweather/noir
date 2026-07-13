#!/usr/bin/env node
// director.mjs — sync to the latest Director, run it, keep it running.
// Cross-platform (macOS / Windows / Linux):  npm run director
// Pull first, then supervise: exit code 75 (the desk's RESTART WITH
// UPDATE button) means pull again and relaunch.
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pull = () => {
  const r = spawnSync('git', ['pull', '--ff-only'], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) console.log('(pull failed — running the build already here)')
}

pull()
const run = () => {
  const p = spawn(process.execPath, [join('gm', 'director-service.mjs')], { cwd: ROOT, stdio: 'inherit' })
  p.on('exit', (code) => {
    if (code === 75) {
      console.log('— desk asked for an update restart —')
      pull()
      run()
    } else process.exit(code ?? 0)
  })
}
run()
