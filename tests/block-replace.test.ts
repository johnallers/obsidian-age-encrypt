import { describe, it, expect } from "vitest";
import { replaceAgeBlock } from "../src/services/blockReplace";

const body = "hint: h\n-----BEGIN AGE ENCRYPTED FILE-----\nAAAA\nBBBB\n-----END AGE ENCRYPTED FILE-----";
const block = "```age\n" + body + "\n```";

describe("replaceAgeBlock", () => {
	it("replaces the matching block and leaves surrounding text alone", () => {
		const data = `before\n\n${block}\n\nafter\n`;
		expect(replaceAgeBlock(data, body, "NEW")).toBe("before\n\nNEW\n\nafter\n");
	});

	it("still works when lines were inserted above (stale line numbers)", () => {
		const data = `inserted 1\ninserted 2\ninserted 3\nbefore\n${block}\nafter`;
		expect(replaceAgeBlock(data, body, "NEW")).toBe("inserted 1\ninserted 2\ninserted 3\nbefore\nNEW\nafter");
	});

	it("aborts (null) when the block is gone or changed", () => {
		expect(replaceAgeBlock("unrelated\ntext", body, "NEW")).toBeNull();
		expect(replaceAgeBlock(block.replace("AAAA", "CCCC"), body, "NEW")).toBeNull();
	});

	it("aborts when the block appears more than once", () => {
		expect(replaceAgeBlock(`${block}\n\n${block}`, body, "NEW")).toBeNull();
	});

	it("aborts when the text is not inside an age fence", () => {
		expect(replaceAgeBlock("```js\n" + body + "\n```", body, "NEW")).toBeNull();
		expect(replaceAgeBlock(body, body, "NEW")).toBeNull();
		expect(replaceAgeBlock("```age\n" + body + "\nno closing fence", body, "NEW")).toBeNull();
	});

	it("aborts on empty source", () => {
		expect(replaceAgeBlock(block, "  \n", "NEW")).toBeNull();
	});

	it("handles longer fences and tilde fences", () => {
		expect(replaceAgeBlock("````age\n" + body + "\n````\n", body, "NEW")).toBe("NEW\n");
		expect(replaceAgeBlock("~~~age\n" + body + "\n~~~", body, "NEW")).toBe("NEW");
	});

	it("handles CRLF files and keeps CRLF in the replacement", () => {
		const data = `a\r\n${block.replace(/\n/g, "\r\n")}\r\nb\r\n`;
		expect(replaceAgeBlock(data, body, "x\ny")).toBe("a\r\nx\r\ny\r\nb\r\n");
	});

	it("does not treat '$' sequences in the replacement specially", () => {
		expect(replaceAgeBlock(block, body, "cost $& $1 $$")).toBe("cost $& $1 $$");
	});
});
