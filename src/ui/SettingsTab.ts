import { App, PluginSettingTab, Setting } from 'obsidian';
import AgeEncryptPlugin from '../../main';

export class AgeEncryptSettingTab extends PluginSettingTab {
    plugin: AgeEncryptPlugin;

    constructor(app: App, plugin: AgeEncryptPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Exclude frontmatter from encryption')
            .setDesc('If enabled, the YAML frontmatter will not be encrypted when using the "Encrypt file" command.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeFrontmatter)
                .onChange(async (value) => {
                    this.plugin.settings.excludeFrontmatter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Warn about leftover plaintext before encrypting')
            .setDesc('Show a reminder that File Recovery, Git or backup plugins, sync history, and system backups may keep earlier plaintext copies.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.warnAboutRemnants)
                .onChange(async (value) => {
                    this.plugin.settings.warnAboutRemnants = value;
                    await this.plugin.saveSettings();
                }));
    }
}
