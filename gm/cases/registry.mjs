// registry.mjs — every playable case. A case is just a module with the
// skeleton shape (scopes/edges/accusation/burnTriggers/…); adding one here
// puts it on the case-select card.

import * as berlin from './berlin-minicase.mjs'
import * as neworleans from './neworleans-wetnegative.mjs'

export const CASES = {
  [berlin.CASE_ID]: berlin,
  [neworleans.CASE_ID]: neworleans,
}

export const CASE_LIST = [
  { id: berlin.CASE_ID, label: 'BERLIN 1938', title: 'The Last Visa', blurb: 'Exit papers, embassy queues, a courier who didn\'t arrive.' },
  { id: neworleans.CASE_ID, label: 'NEW ORLEANS 1968', title: 'The Wet Negative', blurb: 'A missing photographer, a moved patrol, the river keeping quiet.' },
]
