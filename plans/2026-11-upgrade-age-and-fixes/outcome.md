# Outcome: plan versus what shipped

- **Part of:** [plan.md](./plan.md) (2026-11 upgrade and fixes)
- **Branch:** `feature/upgrade-age-and-fixes`
- **PR:** [#1](https://github.com/johnallers/obsidian-age-encrypt/pull/1) (merged into the fork's `main` on 2026-11-27)
- **Written:** 2026-11-27

This file records where the work departed from the plan and why. Read it with `git log` to trace a change back to its reason.

## Commits

| Commit | Change | Reason |
|---|---|---|
| `35f802d` | Upgrade `age-encryption` to 0.3.1, add vitest and legacy-block fixtures | Phase 0. Fixtures were generated with the old version before the bump, so tests prove old blocks still decrypt. |
| `b48b3b3` | Content-matched save (B1), armor helpers (B2) | Phase 1. Fixes the wrong-lines overwrite and the large-note stack overflow. |
| `9342829` | README security guidance, plan and assessment updates | Phase 2. |
| `a6700e3` | Encrypt selection replaces a captured range (B3) | Found by live testing; see below. |
| `2d8b43c` | Encrypt file aborts if the note changed during the prompt (B4) | Same bug class as B1 and B3; see below. |

## What changed from the plan

1. **Public-key mode was dropped.** The original plan was to add X25519 recipients and identities. After re-assessment, a long random passphrase in a password manager gives equivalent security for one user with far less complexity. The design is kept in [deferred-public-key.md](./deferred-public-key.md). The plan file was rewritten as a passphrase-only plan, and its filename changed from `public-key-encryption-plan.md` to `plan.md` to match.
2. **The dependency bump caused a regression that the plan did not anticipate (B3).** After moving to 0.3.1, "Encrypt selection" inserted the encrypted block at the top of the note and left the plaintext in place. Bisecting showed the original source plus only the 0.3.1 dependency fails. Likely cause (not proven): 0.3.1 yields to Obsidian's event loop during encryption, so Obsidian refocuses the editor and collapses the selection before `replaceSelection` runs. The old code only worked because nothing yielded. Fix: capture the selection range before the password modal opens, then replace that exact range, aborting if the text there changed. The 23 unit tests passed throughout; only live testing in Obsidian caught it.
3. **A fourth stale-state bug was fixed (B4).** "Encrypt file" read the note before the password prompt and wrote it back with `vault.modify` afterward, silently overwriting edits made in the meantime. It now writes through `vault.process` and only if the note still matches the snapshot. B1, B3 and B4 share one cause: acting on information gathered before a user prompt and assuming it is still true afterward.
4. **Tooling constraints.** vitest 3 was used instead of the latest, because the newest vitest needs Vite 8, which conflicts with the pinned `esbuild@0.17.3` build tool. `@types/node` moved from 16 to 20 to resolve the install. Production dependencies have 0 audit findings; the dev-only findings come from vitest's tree (for example `tinypool`) and do not ship in `main.js`.
5. **Bundle size** grew from about 103 KB to about 329 KB, mostly from the post-quantum dependency pulled in by 0.3.1.

## Verification

- **Unit tests:** 23 passing (legacy-block fixtures, armor round-trip including 1 MB, block replacement including stale and duplicate cases).
- **CLI interop:** plugin output decrypts with `age -d`; `age -p -a` output decrypts in the plugin; a 1 MB block decrypts identically with the CLI.
- **Live testing** via the Obsidian CLI in a throwaway vault (correction: File Recovery was meant to be disabled there but was in fact enabled; it does not affect these plugin-behavior checks):
  - Decrypt a legacy block: pass.
  - Save after inserting lines above the block (old code would clobber lines): pass.
  - Save after the block text changed underneath: aborts with a notice, file hash unchanged.
  - Encrypt file on a 1 MB note: pass, decrypts byte-identical.
  - Encrypt selection: failed before B3, passes after, including with the cursor moved elsewhere and with the selected text changed mid-prompt.
  - Encrypt file with the note edited mid-prompt: aborts with a notice, the edit is preserved.
- **Not tested:** mobile; the real vault.

## Known open items

- Obsidian's reading view rendered nothing for a single 1.4 MB encrypted block (no errors). Decrypt was verified through the plugin service instead of the button.
- Decrypting that 1 MB block took about 11 s in the app, versus under 1 s in Node.
- ~~Optional UI warning about plaintext remaining in File Recovery, git and sync history~~ Done as a follow-up: see [../2026-11-recovery-warning/plan.md](../2026-11-recovery-warning/plan.md).
- ~~The plugin version is still 1.2.0~~ Bumped to 1.3.0 in the follow-up branch.
- Live tests need the Obsidian window focused. While it was unfocused, modals did not render at all, even a plain one.
