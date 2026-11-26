import { describe, it, expect } from "vitest";
import { EncryptionService } from "../src/services/encryption";

describe("armor encoding", () => {
	const svc = new EncryptionService();

	it("round-trips a 1 MB note (used to overflow the stack)", async () => {
		const text = ("0123456789abcdef".repeat(64) + "\n").repeat(1024); // ~1 MB
		expect(text.length).toBeGreaterThan(1_000_000);
		const enc = await svc.encrypt(text, { password: "pw" });
		expect(await svc.decrypt(enc, "pw")).toBe(text);
	}, 60_000);

	it("emits 64-column lines, no markers, no trailing newline", async () => {
		const enc = await svc.encrypt("hello", { password: "pw" });
		expect(enc.endsWith("\n")).toBe(false);
		expect(enc).not.toContain("-----");
		const lines = enc.split("\n");
		lines.slice(0, -1).forEach((l) => expect(l.length).toBe(64));
	});

	it("decodes bodies that were reflowed, indented or CRLF-converted", async () => {
		const enc = await svc.encrypt("reflow me", { password: "pw" });
		const flat = enc.replace(/\n/g, "");
		const reflowed = flat.match(/.{1,40}/g)!.map((l) => "  " + l).join("\r\n");
		expect(await svc.decrypt(reflowed, "pw")).toBe("reflow me");
	});

	it("rejects garbage", async () => {
		await expect(svc.decrypt("not base64 !!!", "pw")).rejects.toThrow();
	});
});
