# Security assessment: obsidian-age-encrypt

- **Part of:** [plan.md](./plan.md); results in [outcome.md](./outcome.md)
- **Date:** 2026-11-26
- **Repo reviewed:** `/Users/johnallers/dev/obsidian-age-encrypt` (HEAD `0735d66`, plugin version 1.2.0, author Metin Ur)
- **Scope:** manual read of all plugin source (~620 lines: `main.ts`, `src/services/encryption.ts`, `src/ui/*`, `src/settings.ts`), `package.json`, lockfile entry for `age-encryption`, and README.
- **Not done:** `npm audit`, building/running the plugin, reading the `age-encryption` / `@noble/*` source, verifying scrypt work factor or decrypt-side limits, checking community-store status.

## Summary

Small, readable plugin with no network access and no home-grown crypto. Reasonable for encrypting a few sensitive notes or blocks, and output is standard armored age, so it stays recoverable with the `age` CLI. It is **not** vault-level protection, and it has two bugs that can cause data loss.

## Strengths

- No `fetch`, `eval`, `child_process`, `innerHTML`, or telemetry. Only `console.error` on failure, with no passwords or plaintext logged.
- Uses `age-encryption` 0.2.0 (TypeScript age implementation by Filippo Valsorda) on `@noble/*`; the plugin implements no cryptography itself.
- scrypt-passphrase age mode is authenticated (ChaCha20-Poly1305), so tampering is detected.
- Output is standard armor (`-----BEGIN AGE ENCRYPTED FILE-----`); `age -d` decrypts it with no plugin.
- `main.js` is not committed, so the build can be done from audited source.
- Decrypted text is placed in a textarea via `createEl({ text })`, not `innerHTML`.

## Security concerns

1. **Passphrase only.** No age keypairs, and no passphrase-strength check.
2. **"Remember for this session" defaults to on** (`src/ui/PasswordModal.ts:13`). The plaintext passphrase stays in a `Map` (`encryption.ts:15`) until plugin unload.
3. **Plaintext persists elsewhere after encryption.** `Encrypt file` / `Encrypt selection` overwrite the note, but old plaintext can survive in:
   - Obsidian File Recovery snapshots
   - editor undo history
   - git history (this vault already has a commit)
   - Syncthing versions and Time Machine
   - sync before encryption (the README warns of this)
4. **Metadata is not encrypted:** filenames, links, tags, and the hint (stored in plaintext). With "Exclude frontmatter" on, frontmatter is also plaintext.
5. **"Save as plain text"** writes decrypted content back to disk (intentional, but easy to click by accident).

## Correctness bugs (data loss risk)

- **Wrong lines overwritten** (`main.ts:124-125`, `main.ts:285-289`):
  - `getSectionInfo(el)?.lineStart || 0` falls back to line 0 if section info is missing, so a save would replace the first line of the file.
  - The file comes from `getActiveFile()` rather than `ctx.sourcePath`.
  - Line numbers are captured at decrypt time and go stale if the note is edited, embedded, or the tab is switched before saving.
- **Large notes fail to encrypt** (`encryption.ts:18`): `String.fromCharCode(...buffer)` hits a stack overflow once ciphertext is roughly 100 KB or more.

## Supply chain / maintenance

- Single maintainer, short history; `package.json` author is still the placeholder "Your Name".
- Old dev toolchain (esbuild 0.17.3, TypeScript 4.7.4), and `obsidian` is pinned to `latest`. These affect the build only.
- Runtime dependency is one package (`age-encryption` 0.2.0, pinned by lockfile) plus `@noble/*`.

## Verdict and recommendations

Usable for selective note/block encryption. Do not rely on it as vault protection.

- Keep full-vault backups, including encrypted `age` snapshots (`tar | age -r`).
- Keep FileVault on.
- Use a strong passphrase, and turn "Remember for this session" off.
- Encrypt before the first commit or sync, and consider disabling File Recovery for this vault.
- Run `npm audit` and build from source before installing.
- Fix the two bugs first: use `ctx.sourcePath` and fail when section info is missing, and replace the spread with a chunked base64 conversion.

## Open items

- [x] Run `npm audit` and build locally (prod deps: 0 vulnerabilities; dev tooling has advisories)
- [x] scrypt work factor: encrypt default 18; decrypt rejects above 20 (checked in 0.2.0 and 0.3.1)
- [x] Fix the two bugs (commit b48b3b3 on `feature/upgrade-age-and-fixes`)
- [ ] Decide on File Recovery / `.gitignore` settings for this vault
