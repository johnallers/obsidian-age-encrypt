# Plan: bug fixes and dependency upgrade (passphrase mode)

- **Date:** 2026-11-26 (rewritten after re-assessment)
- **Status:** Draft, not started
- **Related:** [security-assessment.md](./security-assessment.md)
- **Supersedes:** the earlier public-key (X25519) plan, now deferred (see the last section). The filename is kept so existing links still work.

## Handoff context (read first)

- **Repo:** this directory, John's personal fork of an Obsidian plugin (upstream author Metin Ur). Plugin id `age-encrypt`, v1.2.0, TypeScript, built with esbuild (`npm run build` produces `main.js`, which is gitignored). Source is ~620 lines: `main.ts`, `src/services/encryption.ts`, `src/ui/PasswordModal.ts`, `src/ui/SettingsTab.ts`, `src/settings.ts`.
- **Why the scope changed:** John decided to stay with passphrase mode and store a long random passphrase in a password manager. For a single user this is equivalent in security to holding a private key in the same manager, and it avoids settings, key handling, and mode detection. Public-key mode and post-quantum recipients were evaluated and deferred.
- **Constraints:**
  - Do not commit, push, or open PRs unless John asks. Work on a feature branch if committing is requested.
  - Blocks created by the current version must still decrypt unchanged.
  - Keep commits small and per-phase to ease merging upstream changes.
  - Do not upgrade `age-encryption` past 0.3.1 without telling John.
- **Line numbers** in this file and the assessment refer to commit `0735d66` and may drift.
- **Testing in Obsidian:** build, then copy `main.js`, `manifest.json`, and `styles.css` into `<test vault>/.obsidian/plugins/age-encrypt/` and enable the plugin. Use a throwaway vault, not John's real one, with the File Recovery core plugin disabled. The repo has no test setup yet (Phase 0 adds one).

## Goal

Make the existing passphrase workflow safe and current: fix the two bugs found in the code review (one can overwrite the wrong lines of a note), move to the latest `age-encryption`, and document the real security caveats.

## Dependency upgrade findings

`age-encryption` is pinned `^0.2.0`. The latest is **0.3.1** (2026-08-28). Evaluated in a scratch copy of the repo:

- **Builds clean:** `tsc` and the production esbuild build pass with no code changes. `target: es2016` is fine.
- **Bundle size:** `main.js` grows from about 103 KB to about 329 KB, mostly from the new post-quantum dependency. Acceptable for a desktop and mobile plugin, but worth noting.
- **Streaming API (0.2.4): not adopted.** The plugin encrypts and decrypts whole note text held in memory and stores it as a base64 block in markdown, so streams add complexity with no benefit. `Decrypter.decryptHeader` is not useful here either.
- **Armor helpers: adopt.** The plugin's block format is already age ASCII armor (`-----BEGIN AGE ENCRYPTED FILE-----`, 64-column base64). `armor.encode` and `armor.decode` replace the hand-rolled base64 code and fix B2 as a side effect. Cautions:
  - `armor.encode` ends with a trailing newline. Commit `bed2cdb` removed trailing newlines on purpose for age CLI compatibility, so trim it.
  - `armor.decode` is strict (every line exactly 64 characters except the last). The current `atob` path is lenient. Keep a lenient fallback so hand-edited or reflowed blocks still open.
- **Scrypt:** decrypt rejects work factors above 20 (a hostile block cannot hang the app), which closes that open item from the assessment. `setScryptWorkFactor` exists if the default (18) ever needs changing.
- **Other 0.2.1 to 0.3.1 additions (passkeys, post-quantum hybrid recipients, tag recipients):** not used in passphrase mode. See the deferred section.

## Bug fixes

- **B1 Wrong-lines overwrite** (`main.ts:124-125, 285-289`). Replace line-number splicing with content matching:
  - Resolve the file from `ctx.sourcePath`, not `getActiveFile()`.
  - Inside `vault.process`, replace the exact original block text, and abort with a Notice if it isn't found exactly once.
  - Remove the `|| 0` fallbacks.
- **B2 Base64 stack overflow** (`encryption.ts:18`, `String.fromCharCode(...buffer)` overflows the stack on large notes). Fixed by switching to `armor.encode` and `armor.decode`. If armor adoption is dropped, use a chunked conversion instead.

## Phases

### Phase 0: setup and upgrade
- [ ] Build the fork locally (`npm ci && npm run build`) and run `npm audit`
- [ ] Before upgrading, encrypt a few sample blocks with the current version (small, about 1 MB, multi-line, unicode) and keep them as regression fixtures
- [ ] Bump `age-encryption` to `^0.3.1`, rebuild, confirm the fixtures still decrypt
- [ ] Add a test runner (vitest) for the pure functions: block parse/format, armor round-trip
- [ ] Test vault for manual checks, with File Recovery disabled

### Phase 1: bug fixes
- [ ] B1 content-matched replace with `ctx.sourcePath`
- [ ] B2 switch to `armor.encode` / `armor.decode`, trim the trailing newline, keep a lenient decode fallback
- [ ] Tests: 1 MB note round-trips; stale-range save aborts instead of overwriting; a block written by the old version decrypts; output decrypts with `age -d` (CLI interop)

### Phase 2: docs
- [ ] README guidance: use a long random passphrase from a password manager (20+ random characters, or 5+ random words); a lost passphrase means lost data
- [ ] README security notes from the assessment: plaintext remnants from before encryption (File Recovery, git history, sync versions), session password caching behavior
- [ ] Optional: warn in "Encrypt file" that earlier plaintext may remain in File Recovery, git, and sync history

## Risks

- **Lost passphrase means lost data.** Back up the passphrase in the password manager plus an offline copy.
- **Weak passphrases:** scrypt slows guessing but cannot save a short passphrase. Document the minimum.
- **Plaintext remnants** from before encryption are unaffected by this work. See the assessment.
- **Armor strictness:** a stricter decoder could reject blocks that the lenient one accepts. Mitigated by the lenient fallback and the regression fixtures.
- **Fork drift:** the upstream may change `main.ts` heavily. Keep commits small and per-phase.

## Verification checklist

- [ ] `npm run build` clean, tests pass
- [ ] Existing passphrase notes from the current version still decrypt
- [ ] `age -d` decrypts plugin output, and plugin decrypts `age -p -a` output
- [ ] Manual run in a throwaway vault on desktop (and mobile if used)

## Deferred: public-key mode

Evaluated and set aside because a single user storing everything in one password manager gains little. Revisit if one of these becomes true: a device should encrypt without being able to decrypt, notes are shared with another person, or a backup key is wanted.

- **Design sketch:** settings `encryptionMode` and `recipients` (validated on save); encrypt via `Encrypter.addRecipient`, decrypt via `Decrypter.addIdentity` with the private key pasted into the modal and held in memory only; detect block type from the decoded header (`age-encryption.org/v1` then `-> scrypt` or `-> X25519`). Never write a private key to `data.json`.
- **Verified:** modes are exclusive per block. `setPassphrase` cannot be combined with `addRecipient`, and the scrypt identity throws "scrypt recipient is not the only one in the header".
- **Post-quantum hybrid recipients (`age1pq1...`):** supported by the library for free via `addRecipient` / `addIdentity`, but recipient strings are about 1.9 KB, headers grow, the age CLI needs 1.3.0 or later, and the benefit only matters for multi-decade confidentiality against a ciphertext-harvesting attacker. Not promoted. Passphrase mode is unaffected by the quantum concern.
- **Tag recipients (`age1tag1...`):** encrypt-only from the plugin; decrypting needs the CLI and a hardware plugin.
- **Passkeys and `CryptoKey` identities:** unproven in Obsidian's Electron and mobile webviews, out of scope.
