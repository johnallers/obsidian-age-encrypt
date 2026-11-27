export interface AgeEncryptSettings {
    defaultHint?: string;
    excludeFrontmatter: boolean;
    warnAboutRemnants: boolean;
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    excludeFrontmatter: true,
    warnAboutRemnants: true
};
