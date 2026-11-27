import { App, Modal, Setting } from 'obsidian';

export interface RemnantWarningResult {
    proceed: boolean;
    dontWarnAgain: boolean;
}

/**
 * Warns that encrypting a note does not remove earlier plaintext copies that
 * other tools may have kept. Static text on purpose: the plugin cannot tell
 * which of these apply (backup plugins, git, sync, system backups), so it
 * lists the usual places instead of guessing.
 */
export class RemnantWarningModal extends Modal {
    private dontWarnAgain = false;
    private resolve: (value: RemnantWarningResult) => void;
    private settled = false;

    constructor(app: App) {
        super(app);
    }

    openAndConfirm(): Promise<RemnantWarningResult> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    private settle(proceed: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve({ proceed, dontWarnAgain: this.dontWarnAgain });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Earlier plaintext may remain' });

        contentEl.createEl('p', {
            text: 'Encrypting replaces the note as it is now, but copies of the earlier plaintext can still exist elsewhere and may stay readable. Common places:'
        });

        const list = contentEl.createEl('ul');
        [
            'Obsidian File Recovery snapshots',
            'Git history and backup plugins',
            'Sync version history (Obsidian Sync, Syncthing, iCloud, Dropbox and similar)',
            'System backups such as Time Machine'
        ].forEach(item => list.createEl('li', { text: item }));

        contentEl.createEl('p', {
            text: 'Clear or exclude these first if the earlier content is sensitive.'
        });

        new Setting(contentEl)
            .setName("Don't warn me again")
            .setDesc('You can turn this warning back on in the plugin settings.')
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => this.dontWarnAgain = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Encrypt anyway')
                .setCta()
                .onClick(() => {
                    this.settle(true);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.settle(false);
                    this.close();
                }));
    }

    onClose() {
        // Closing with Escape or the X counts as cancel
        this.settle(false);
        this.contentEl.empty();
    }
}
