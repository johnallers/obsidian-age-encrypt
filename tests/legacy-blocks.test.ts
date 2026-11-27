import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EncryptionService } from "../src/services/encryption";

const fixtures = JSON.parse(
	readFileSync(new URL("./fixtures/legacy-blocks.json", import.meta.url), "utf8")
);

describe("legacy blocks (created by plugin v1.2.0 with age-encryption 0.2.0)", () => {
	const svc = new EncryptionService();

	for (const c of fixtures.cases) {
		it(`decrypts ${c.name}`, async () => {
			const plain = await svc.decrypt(c.block, fixtures.passphrase);
			expect(plain).toBe(c.plaintext);
		});

		it(`${c.name} survives format/parse round trip`, async () => {
			const block = svc.formatEncryptedBlock(c.block, "my hint");
			const parsed = svc.parseEncryptedBlock(block);
			expect(parsed.hint).toBe("my hint");
			expect(await svc.decrypt(parsed.content, fixtures.passphrase)).toBe(c.plaintext);
		});
	}

	it("rejects a wrong passphrase", async () => {
		await expect(svc.decrypt(fixtures.cases[0].block, "wrong")).rejects.toThrow();
	});

	it("new encrypt output decrypts", async () => {
		const enc = await svc.encrypt("round trip ✓", { password: "pw" });
		expect(await svc.decrypt(enc, "pw")).toBe("round trip ✓");
	});
});
