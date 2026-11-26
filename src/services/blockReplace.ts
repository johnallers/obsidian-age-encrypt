/**
 * Replace a fenced ```age block in `data` by content, not by line number.
 *
 * `originalSource` is the text between the fences as Obsidian handed it to the
 * code block processor. The block is replaced only when that text occurs
 * exactly once in `data` and is wrapped by a matching ```age ... ``` fence.
 * Otherwise returns null and the caller must abort instead of guessing, so a
 * file that changed since render time is never overwritten at stale positions.
 */
export function replaceAgeBlock(
	data: string,
	originalSource: string,
	newContent: string
): string | null {
	const trimmed = originalSource.replace(/\s+$/, '');
	if (!trimmed) return null;

	const crlf = data.includes('\r\n');
	const needle = crlf ? trimmed.replace(/\r?\n/g, '\r\n') : trimmed;

	const first = data.indexOf(needle);
	if (first === -1 || data.indexOf(needle, first + 1) !== -1) return null;

	// The source must start on its own line, directly below the opening fence.
	if (first < 2 || data[first - 1] !== '\n') return null;
	const openerStart = data.lastIndexOf('\n', first - 2) + 1;
	const openerLine = data.slice(openerStart, first - 1).replace(/\r$/, '');
	const opener = /^(`{3,}|~{3,})age[ \t]*$/.exec(openerLine);
	if (!opener) return null;
	const fence = opener[1];

	// ...and be followed by a closing fence of the same character, at least as long.
	const rest = data.slice(first + needle.length);
	const closer = new RegExp(`^\\r?\\n${fence[0]}{${fence.length},}[ \\t]*(?=\\r?\\n|$)`).exec(rest);
	if (!closer) return null;

	const replacement = crlf ? newContent.replace(/\r?\n/g, '\r\n') : newContent;
	return data.slice(0, openerStart) + replacement + rest.slice(closer[0].length);
}
