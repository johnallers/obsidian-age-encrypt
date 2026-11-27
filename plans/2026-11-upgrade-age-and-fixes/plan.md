# Plan: bug fixes and dependency upgrade (passphrase mode)

- **Date:** 2026-11-26 (rewritten after re-assessment)
- **Status:** Phases 0–2 done and live-tested; PR not yet opened
- **Branch:** `feature/upgrade-age-and-fixes`
- **PR:** _not opened yet; add the link here_
- **Related:** [outcome.md](./outcome.md) (what shipped and why it differs), [security-assessment.md](./security-assessment.md), [deferred-public-key.md](./deferred-public-key.md)
- **Supersedes:** the earlier public-key (X25519) plan, now deferred.

## Handoff context (read first)

- **Repo:** this directory, John's personal fork of an Obsidian plugin (upstream author Metin Ur). Plugin id `age-encrypt`, v1.2.0, TypeScript, built with esbuild (`npm run build` produces `main.js`, which is gitignored). Source is ~620 lines: `main.ts`, `src/services/encryption.ts`, `src/ui/PasswordModal.ts`, `src/ui/SettingsTab.ts`, `src/settings.ts`.
- **Why the scope changed:** John decided to stay with passphrase mode and store a long random passphrase in a password manager. For a single user this is equivalent in security to holding a private key in the same manager, and it avoids settings, key handling, and mode detection. Public-key mode and post-quantum recipients were evaluated and deferred (see [deferred-public-key.md](./deferred-public-key.md)).
- **Constraints:**
  - Do not commit, push, or open PRs unless John asks. Work on a feature branch if committing is requested.
  - Blocks created by the current version must still decrypt unchanged.
  - Keep commits small and per-phase to ease merging upstream changes.
  - Do not upgrade `age-encryption` past 0.3.1 without telling John.
- **Line numbers** in this file and the assessment refer to commit `0735d66` and may drift.
- **Testing in Obsidian:** build, then copy `main.js`, `manifest.json`, and `styles.css` into `<test vault>/.obsidian/plugins/age-encrypt/` and enable the plugin. Use a throwaway vault, not John's real one, with the File Recovery core plugin disabled. The repo has no test setup yet (Phase 0 adds one).

## Goal

Make the existing passphrase workflow safe and current: fix the bugs found in the code review (one can overwrite the wrong lines of a note), move to the latest `age-encryption`, and document the real security caveats. Two more stale-state bugs (B3, B4) were found during live testing; see [outcome.md](./outcome.md).

## Dependency upgrade findings

`age-encryption` is pinned `^0.2.0`. The latest is **0.3.1** (2026-08-28). Evaluated in a scratch copy of the repo:

- **Builds clean:** `tsc` and the production esbuild build pass with no code changes. `target: es2016` is fine.
- **Bundle size:** `main.js` grows from about 103 KB to about 329 KB, mostly from the new post-quantum dependency. Acceptable for a desktop and mobile plugin, but worth noting.
- **Streaming API (0.2.4): not adopted.** The plugin encrypts and decrypts whole note text held in memory and stores it as a base64 block in markdown, so streams add complexity with no benefit. `Decrypter.decryptHeader` is not useful here either.
- **Armor helpers: adopt.** The plugin's block format is already age ASCII armor (`-----BEGIN AGE ENCRYPTED FILE-----`, 64-column base64). `armor.encode` and `armor.decode` replace the hand-rolled base64 code and fix B2 as a side effect. Cautions:
  - `armor.encode` ends with a trailing newline. Commit `bed2cdb` removed trailing newlines on purpose for age CLI compatibility, so trim it.
  - `armor.decode` is strict (every line exactly 64 characters except the last). The current `atob` path is lenient. Keep a lenient fallback so hand-edited or reflowed blocks still open.
- **Scrypt:** decrypt rejects work factors above 20 (a hostile block cannot hang the app), which closes that open item from the assessment. `setScryptWorkFactor` exists if the default (18) ever needs changing.
- **Other 0.2.1 to 0.3.1 additions (passkeys, post-quantum hybrid recipients, tag recipients):** not used in passphrase mode. See [deferred-public-key.md](./deferred-public-key.md).

## Bug fixes

- **B1 Wrong-lines overwrite** (`main.ts:124-125, 285-289`). Replace line-number splicing with content matching:
  - Resolve the file from `ctx.sourcePath`, not `getActiveFile()`.
  - Inside `vault.process`, replace the exact original block text, and abort with a Notice if it isn't found exactly once.
  - Remove the `|| 0` fallbacks.
- **B2 Base64 stack overflow** (`encryption.ts:18`, `String.fromCharCode(...buffer)` overflows the stack on large notes). Fixed by switching to `armor.encode` and `armor.decode`. If armor adoption is dropped, use a chunked conversion instead.
- **B3 Encrypt selection inserts at the wrong place** _(found by live testing, not in the original plan)_. With `age-encryption` 0.3.1 the selection collapses while the password modal closes, so the block lands at the top of the note and the plaintext stays. Fix: capture the range before the modal, replace that range, abort if its text changed.
- **B4 Encrypt file overwrites edits made during the password prompt** _(found by review during live testing)_. Fix: write with `vault.process` only if the note still matches the snapshot that was encrypted.

## Phases

### Phase 0: setup and upgrade
- [x] Build the fork locally (`npm ci && npm run build`) and run `npm audit`
- [x] Before upgrading, encrypt a few sample blocks with the current version (small, about 1 MB, multi-line, unicode) and keep them as regression fixtures
- [x] Bump `age-encryption` to `^0.3.1`, rebuild, confirm the fixtures still decrypt
- [x] Add a test runner (vitest) for the pure functions: block parse/format, armor round-trip
- [x] Test vault for manual checks, with File Recovery disabled (live testing via the Obsidian CLI)

### Phase 1: bug fixes
- [x] B1 content-matched replace with `ctx.sourcePath`
- [x] B2 switch to `armor.encode` / `armor.decode`, trim the trailing newline, keep a lenient decode fallback
- [x] Tests: 1 MB note round-trips; stale-range save aborts instead of overwriting; a block written by the old version decrypts; output decrypts with `age -d` (CLI interop)
- [x] B3 Encrypt selection replaces the captured range (commit `a6700e3`)
- [x] B4 Encrypt file aborts if the note changed during the prompt (commit `2d8b43c`)

### Phase 2: docs
- [x] README guidance: use a long random passphrase from a password manager (20+ random characters, or 5+ random words); a lost passphrase means lost data
- [x] README security notes from the assessment: plaintext remnants from before encryption (File Recovery, git history, sync versions), session password caching behavior
- [ ] Optional: warn in "Encrypt file" that earlier plaintext may remain in File Recovery, git, and sync history

## Risks

- **Lost passphrase means lost data.** Back up the passphrase in the password manager plus an offline copy.
- **Weak passphrases:** scrypt slows guessing but cannot save a short passphrase. Document the minimum.
- **Plaintext remnants** from before encryption are unaffected by this work. See the assessment.
- **Armor strictness:** a stricter decoder could reject blocks that the lenient one accepts. Mitigated by the lenient fallback and the regression fixtures.
- **Fork drift:** the upstream may change `main.ts` heavily. Keep commits small and per-phase.

## Verification checklist

- [x] `npm run build` clean, tests pass
- [x] Existing passphrase notes from the current version still decrypt
- [x] `age -d` decrypts plugin output, and plugin decrypts `age -p -a` output
- [x] Live run in a throwaway vault on desktop (mobile not tested)

## Deferred: public-key mode

Evaluated and set aside. The design sketch, verified facts and reasons are in [deferred-public-key.md](./deferred-public-key.md).
