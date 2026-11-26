# Plan: public-key (X25519) support

- **Date:** 2026-11-26
- **Status:** Draft, not started
- **Related:** [security-assessment.md](./security-assessment.md)

## Goal

Encrypt to an age public key (`age1...`) and decrypt with the matching private key (`AGE-SECRET-KEY-1...`), instead of a shared passphrase. Output must stay interoperable with the `age` CLI in both directions.

## Background

The plugin currently only calls `setPassphrase` / `addPassphrase` (`src/services/encryption.ts:36,53`). The `age-encryption` 0.2.0 dependency already supports key pairs, so no dependency change is needed:

```ts
generateIdentity(): Promise<string>              // AGE-SECRET-KEY-1...
identityToRecipient(identity): Promise<string>   // age1...
Encrypter.addRecipient("age1...")
Decrypter.addIdentity("AGE-SECRET-KEY-1...")
```

The library also rejects scrypt work factors above 20 on decrypt (`dist/recipients.js:75`), which closes that open item from the assessment.

## Decisions

| # | Decision | Recommendation | Status |
|---|----------|----------------|--------|
| D1 | Keep passphrase mode alongside public-key mode? | Yes, for backward compatibility with existing encrypted blocks. Modes are exclusive per block (the age spec does not allow an scrypt stanza alongside other recipients). | **Open, confirm with John** |
| D2 | Where does the private key come from? | Pasted into the decrypt modal, held in memory only. Optional desktop-only file path in a later phase. | Proposed |
| D3 | Support multiple recipients? | Yes, a list in settings (e.g. self + backup key). Cheap with `addRecipient`. | Proposed |
| D4 | Built-in key generation in settings? | Optional, last phase. Shows the secret once with a warning. `age-keygen` already does this. | Proposed |

## Design

### Settings (`src/settings.ts`, `src/ui/SettingsTab.ts`)
- Add `encryptionMode: "passphrase" | "publicKey"` and `recipients: string[]`.
- Validate each entry on save (starts with `age1`, and `addRecipient` doesn't throw). Reject a bad key up front so no note is encrypted to something undecryptable.
- **Never store a private key in `data.json`.** It lives in the vault and would sync and be committed.

### Encrypt (`src/services/encryption.ts`)
- `encrypt()` takes either `{ password }` or `{ recipients }`.
- In public-key mode there is no password prompt and no confirm field, so `PasswordModal` is skipped on encrypt (hint can still be offered).
- Remove the now-unneeded remembered-password logic for the encrypt path.

### Decrypt
- Detect the block type from the decoded header: the first lines of the age file are `age-encryption.org/v1` followed by `-> scrypt ...` or `-> X25519 ...`. Prompt for a passphrase or an identity accordingly.
- Decrypt modal gets a mode where the field takes the `AGE-SECRET-KEY-1...` identity (password-type input, same "remember for this session" toggle, default **off**).
- Use `Decrypter.addIdentity()`.
- In-memory cache stays keyed by ciphertext, and now stores identity or passphrase.
- Clear on unload (already done), and add a "Forget keys" command.

### Re-encrypt / save
- "Save encrypted" in public-key mode needs only the recipients, not the private key, so the identity can be discarded right after decrypt.
- Keep existing blocks' mode when saving, unless the user chooses otherwise.

### Bug fixes (do in Phase 1, because the save path is touched anyway)
- **B1 Wrong-lines overwrite** (`main.ts:124-125, 285-289`). Replace line-number splicing with content matching:
  - Resolve the file from `ctx.sourcePath`, not `getActiveFile()`.
  - Inside `vault.process`, replace the exact original block text, and abort with a Notice if it isn't found exactly once.
  - Remove the `|| 0` fallbacks.
- **B2 Base64 stack overflow** (`encryption.ts:18`). Replace `String.fromCharCode(...buffer)` with a chunked conversion.

## Phases

### Phase 0: setup
- [ ] Build the fork locally (`npm ci && npm run build`) and run `npm audit`
- [ ] Add a test runner (vitest) for the pure functions: block parse/format, base64, mode detection
- [ ] Test vault for manual checks, with File Recovery disabled

### Phase 1: bug fixes (no new features)
- [ ] B1 content-matched replace with `ctx.sourcePath`
- [ ] B2 chunked base64
- [ ] Tests: 1 MB note round-trips; stale-range save aborts instead of overwriting

### Phase 2: public-key mode
- [ ] Settings: mode, recipients list, validation
- [ ] `EncryptionService`: recipient-based encrypt, identity-based decrypt, header mode detection
- [ ] Modal: identity prompt on decrypt, skip password prompt on encrypt
- [ ] Commands: "Encrypt selection" / "Encrypt file" use the configured mode
- [ ] Backward compat: existing passphrase blocks still decrypt unchanged

### Phase 3: interop and security checks
- [ ] Plugin-encrypted block decrypts with `age -d -i key.txt`
- [ ] `age -r age1... -a` output decrypts in the plugin
- [ ] Wrong identity gives a clear failure and no partial output
- [ ] Confirm no private key reaches `data.json`, logs, or the DOM after decrypt
- [ ] Update README security notes (key handling, plaintext-persistence caveats from the assessment)

### Phase 4: optional
- [ ] Desktop-only identity file path (guard with `Platform.isDesktopApp`; path outside the vault)
- [ ] Key generation button (D4)
- [ ] Warn in "Encrypt file" that earlier plaintext may remain in File Recovery, git, and sync history

## Risks

- **Lost private key means lost data**, same as lost passphrase today. Document backup guidance (password manager plus an offline copy).
- **Mobile:** no file paths, so identity must be pasted each time (or remembered for the session).
- **Plaintext remnants** from before encryption (File Recovery, git history, sync versions) are unaffected by this change. See the assessment.
- **Fork drift:** the upstream may change `main.ts` heavily. Keep commits small and per-phase.

## Verification checklist (end of plan)

- [ ] `npm run build` clean, tests pass
- [ ] Interop both ways with `age` CLI
- [ ] Existing passphrase notes from the current version still decrypt
- [ ] Manual run in a throwaway vault on desktop (and mobile if used)
