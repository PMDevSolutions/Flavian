// Stories/Story_<id>.xml holds the text content. The structure is:
//
//   <idPkg:Story>
//     <Story Self="u123" ...>
//       <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/X">
//         <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/Y">
//           <Content>actual text</Content>
//           <Br/>
//         </CharacterStyleRange>
//       </ParagraphStyleRange>
//     </Story>
//   </idPkg:Story>
//
// A "run" in our IR is a CharacterStyleRange's text, flattened. Line breaks
// (<Br/>) become explicit newlines in the run text.

import { parseXml, asArray } from './xml.js';

/**
 * @param {string|Uint8Array} input
 * @param {string} sourcePath The IDML-relative path, kept for IR `source`.
 * @returns {Array<import('../ir.js').StoryIR>}
 */
export function parseStory(input, sourcePath) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:Story'] ?? tree;

	/** @type {Array<import('../ir.js').StoryIR>} */
	const stories = [];

	for (const story of asArray(root?.['Story'])) {
		const id = story?.['@Self'];
		if (!id) continue;
		const runs = collectRuns(story);
		stories.push({ id, source: sourcePath, runs });
	}
	return stories;
}

function collectRuns(story) {
	const runs = [];
	for (const para of asArray(story['ParagraphStyleRange'])) {
		const paraStyleRef = para['@AppliedParagraphStyle'];
		for (const char of asArray(para['CharacterStyleRange'])) {
			const charStyleRef = char['@AppliedCharacterStyle'];
			const text = extractRunText(char);
			if (text.length === 0) continue;
			runs.push({
				text,
				paragraphStyleRef: typeof paraStyleRef === 'string' ? paraStyleRef : undefined,
				characterStyleRef: typeof charStyleRef === 'string' ? charStyleRef : undefined,
			});
		}
		// Close every paragraph with a newline so downstream consumers can
		// re-emit prose without losing structure. Skipped when the paragraph
		// emitted nothing (e.g. all-image content).
		if (runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
			runs[runs.length - 1] = {
				...runs[runs.length - 1],
				text: runs[runs.length - 1].text + '\n',
			};
		}
	}
	return runs;
}

function extractRunText(charRange) {
	let buf = '';
	for (const content of asArray(charRange['Content'])) {
		// fast-xml-parser sometimes hands back a string, sometimes an object
		// when the element has attributes. We only care about the text.
		if (typeof content === 'string') {
			buf += content;
		} else if (content && typeof content === 'object' && '#text' in content) {
			buf += String(content['#text']);
		}
	}
	// <Br/> tags become hard newlines.
	for (const _br of asArray(charRange['Br'])) {
		buf += '\n';
	}
	return buf;
}
