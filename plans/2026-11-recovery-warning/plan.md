# Plan: warn about leftover plaintext before encrypting

- **Date:** 2026-11-27
- **Status:** Implemented on `feature/recovery-warning`; PR pending
- **Branch:** `feature/recovery-warning`
- **PR:** _not opened yet; add the link here_
- **Follows:** [../2026-11-upgrade-age-and-fixes/](../2026-11-upgrade-age-and-fixes/) (PR #1), which left this as an optional item and documented the risk in the README only.

## Goal

Encrypting a note replaces it on disk, but earlier plaintext can survive in File Recovery snapshots, Git or backup plugins, sync version history, and system backups. Remind the user at the moment it matters, before the first encryption of a note.

## Decisions

| Decision | Outcome | Why |
|---|---|---|
| Detect which risks apply (File Recovery, `.git`, backup plugins, Sync)? | **No.** Static warning only. | Detection was prototyped on paper: File Recovery is checkable through an undocumented internal API, and `.git` by a folder check, but the range of backup-style plugins and Git setups is too large to cover, and a heuristic would give false confidence. A static list is honest and does not depend on Obsidian internals. |
| Block encryption if a risk is present? | **No.** Warn only. | The plugin cannot know the user's setup, and a warning is sufficient. |
| Where to warn? | Before the password prompt in both Encrypt selection and Encrypt file. | Cancelling early costs the user nothing. |
| How often? | Every time, until "Don't warn me again" is chosen. A plugin setting turns it back on. | Default-on matches the risk. A one-click opt-out avoids nagging. |

## Design

- `src/ui/RemnantWarningModal.ts`: static dialog with four listed risks, **Encrypt anyway** and **Cancel**, and a "Don't warn me again" toggle. Closing with Escape or clicking outside counts as cancel.
- `src/settings.ts` and `src/ui/SettingsTab.ts`: `warnAboutRemnants`, default `true`, with a toggle. Existing installs pick up the default through the existing settings merge.
- `main.ts`: `confirmRemnantWarning()` is called at the start of both commands. In Encrypt selection, the selection range is captured **before** the warning opens, because any modal can disturb the live selection (see B3 in the earlier plan's outcome).
- README: one line mentioning the reminder.

## Verification

Live, in a throwaway vault via the Obsidian CLI, with the window focused:

- [x] Encrypt selection: warning, then Encrypt anyway, then password, with the block replacing the selection in place
- [x] Cancel button, Escape, and clicking outside all stop the command: no password prompt, note unchanged
- [x] "Don't warn me again" writes `warnAboutRemnants: false` to `data.json`, and the next run skips the dialog
- [ ] Encrypt file shows the warning (accept and cancel). Same helper as Encrypt selection, but the live run was interrupted when the Obsidian window lost focus, so it was not confirmed by automation.
- [ ] The settings tab toggle turns the warning back on. Same interruption.

Unit tests (23) and the build pass. The dialog has no unit tests because it is UI.

## Known limits

- The warning is advisory. It cannot clear snapshots (File Recovery lives in Obsidian's own storage); the user does that in Settings, File recovery.
- It lists risks without knowing which apply, so it will warn users who have none of them. The opt-out covers that.
- This Obsidian version's modal has no visible close button, so X-button dismissal was not tested.
