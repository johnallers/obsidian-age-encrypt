import { Encrypter, Decrypter, armor } from "age-encryption";

export interface EncryptionOptions {
    password: string;
    hint?: string;
    remember?: boolean;
}

export interface EncryptedBlock {
    content: string;
    hint?: string;
}

export class EncryptionService {
    private sessionPasswords: Map<string, string> = new Map();

    private static readonly ARMOR_BEGIN = '-----BEGIN AGE ENCRYPTED FILE-----';
    private static readonly ARMOR_END = '-----END AGE ENCRYPTED FILE-----';

    /**
     * Returns the base64 body of the age armor (64-column lines, no markers,
     * no trailing newline). Uses the library encoder, which has no argument
     * spreading and so is safe for large inputs.
     */
    private encodeBody(binary: Uint8Array): string {
        const lines = armor.encode(binary).trim().split('\n');
        return lines.slice(1, -1).join('\n');
    }

    /**
     * Decodes a base64 body. Whitespace is stripped and the body is re-wrapped
     * to 64 columns first, so blocks that were hand-edited or reflowed by an
     * editor still decode even though armor.decode itself is strict.
     */
    private decodeBody(body: string): Uint8Array {
        const flat = body.replace(/\s+/g, '');
        const lines = flat.match(/.{1,64}/g) ?? [];
        return armor.decode(
            [EncryptionService.ARMOR_BEGIN, ...lines, EncryptionService.ARMOR_END].join('\n')
        );
    }

    async encrypt(content: string, options: EncryptionOptions): Promise<string> {
        try {
            const encrypter = new Encrypter();
            encrypter.setPassphrase(options.password);
            const encryptedArray = await encrypter.encrypt(content);
            const encryptedBase64 = this.encodeBody(encryptedArray);

            if (options.remember) {
                this.sessionPasswords.set(encryptedBase64, options.password);
            }
            return encryptedBase64;
        } catch (error: unknown) {
            console.error('Encryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to encrypt content');
        }
    }

    async decrypt(encryptedContent: string, password: string): Promise<string> {
        try {
            const decrypter = new Decrypter();
            decrypter.addPassphrase(password);
            const encryptedArray = this.decodeBody(encryptedContent);
            const result = await decrypter.decrypt(encryptedArray, "text");
            return result;
        } catch (error: unknown) {
            console.error('Decryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to decrypt content');
        }
    }

    formatEncryptedBlock(encryptedContent: string, hint?: string): string {
        const block = [
            '```age',
            hint ? `hint: ${hint}` : '',
            '-----BEGIN AGE ENCRYPTED FILE-----',
            encryptedContent,
            '-----END AGE ENCRYPTED FILE-----',
            '```'
        ]
            .filter(line => line)
            .join('\n');

        return block;
    }

    parseEncryptedBlock(block: string): EncryptedBlock {
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('```'));

        if (lines.length === 0) {
            throw new Error('Invalid encrypted block format: empty content');
        }

        let hint: string | undefined;
        let contentStartIndex = 0;

        if (lines[0].startsWith('hint: ')) {
            hint = lines[0].substring(6);
            contentStartIndex = 1;
        }

        const beginIndex = lines.findIndex(line => line === '-----BEGIN AGE ENCRYPTED FILE-----');
        const endIndex = lines.findIndex(line => line === '-----END AGE ENCRYPTED FILE-----');

        if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
            throw new Error('Invalid encrypted block format: missing age markers');
        }

        const content = lines.slice(beginIndex + 1, endIndex).join('\n');

        if (!content) {
            throw new Error('Invalid encrypted block format: no content found');
        }

        return { content, hint };
    }

    hasStoredPassword(encryptedContent: string): boolean {
        return this.sessionPasswords.has(encryptedContent);
    }

    getStoredPassword(encryptedContent: string): string | undefined {
        return this.sessionPasswords.get(encryptedContent);
    }

    clearStoredPasswords(): void {
        this.sessionPasswords.clear();
    }
}
