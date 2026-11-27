# Deferred: public-key (X25519) mode

- **Part of:** [plan.md](./plan.md) (2026-11 upgrade and fixes)
- **Status:** Evaluated and set aside on 2026-11-26. Not implemented.

## Why it was deferred

The original goal was to encrypt to an age public key (`age1...`) and decrypt with the matching private key (`AGE-SECRET-KEY-1...`) instead of a shared passphrase. After re-assessment, John chose to stay with passphrase mode and keep a long random passphrase in a password manager.

For a single user, that is equivalent in security to keeping a private key in the same manager, and it avoids new settings, key handling, a decrypt prompt for identities, and mode detection.

## Revisit if

- a device should be able to encrypt without being able to decrypt,
- notes are shared with another person, or
- a backup key is wanted (multiple recipients).

## Design sketch

- **Settings** (`src/settings.ts`, `src/ui/SettingsTab.ts`): add `encryptionMode: "passphrase" | "publicKey"` and `recipients: string[]`. Validate each entry on save (starts with `age1`, and `addRecipient` does not throw), so no note is encrypted to something undecryptable.
- **Encrypt:** `Encrypter.addRecipient(...)`; no password prompt and no confirm field in this mode.
- **Decrypt:** detect the block type from the decoded header (`age-encryption.org/v1` followed by `-> scrypt` or `-> X25519`). The header parser is not exported by the library, so read the first bytes directly. Prompt for an identity, paste it into the modal, and keep it in memory only. Use `Decrypter.addIdentity(...)`. Remember-for-session defaults to off. Add a "Forget keys" command.
- **Never persist a private key** (`data.json`, vault files, logs, or the DOM after decrypt).
- **Save encrypted** needs only recipients, so the identity can be discarded right after decrypt.
- **Interop checks to repeat:** plugin block decrypts with `age -d -i key.txt`; `age -r age1... -a` output decrypts in the plugin; a wrong identity fails cleanly with no partial output.

## Verified facts

- Modes are exclusive per block. `Encrypter.setPassphrase` cannot be combined with `addRecipient`, and the scrypt identity throws "scrypt recipient is not the only one in the header".
- `age-encryption` 0.2.0 already supported this API; no dependency change is needed.

## Other options evaluated (not planned)

- **Post-quantum hybrid recipients (`age1pq1...`, 0.3.0):** supported for free via `addRecipient` and `addIdentity`. Costs: recipient strings of about 1.9 KB, larger headers (about 1.1 KB or more), the age CLI needs 1.3.0 or later, and the post-quantum code is newer and less battle-tested. The benefit only matters for multi-decade confidentiality against an attacker who stores ciphertext today ("harvest now, decrypt later"). Passphrase mode is not affected by that threat. Not promoted.
- **Tag recipients (`age1tag1...`):** encrypt-only from the plugin; decrypting needs the CLI and a hardware plugin.
- **Passkeys (0.2.3) and `CryptoKey` identities:** unproven in Obsidian's Electron and mobile webviews, out of scope.
- **Streaming API (0.2.4):** not useful for note-sized, in-memory text.
