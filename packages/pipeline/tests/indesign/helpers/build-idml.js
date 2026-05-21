// In-memory IDML fixture builder. Tests call buildIdml({...}) and get back a
// Uint8Array they can hand straight to parseIdmlBuffer().
//
// The real IDML format has dozens of XML files; we only generate the subset
// the parser actually reads. The XMLs are minimal but structurally valid: the
// parser pass for that file should succeed without warnings (unless the test
// deliberately omits something).

import { zipSync, strToU8 } from 'fflate';

/**
 * @typedef {Object} BuildOptions
 * @property {string} [idmlVersion]                 designmap @DOMVersion
 * @property {string} [name]                        designmap @Name
 * @property {boolean} [omitDesignMap]              For testing the missing-manifest path
 * @property {boolean} [omitGraphic]                Skip Resources/Graphic.xml
 * @property {boolean} [omitFonts]                  Skip Resources/Fonts.xml
 * @property {boolean} [omitStyles]                 Skip Resources/Styles.xml
 * @property {Array<{id: string, name: string, space?: 'RGB'|'CMYK', values: number[]}>} [colors]
 * @property {Array<{id: string, family: string, style?: string, postScriptName?: string}>} [fonts]
 * @property {Array<{id: string, name: string, kind: 'paragraph'|'character', pointSize?: number, leading?: number, tracking?: number, appliedFont?: string, fillColor?: string}>} [styles]
 * @property {Array<{id: string, runs: Array<{text: string, paragraphStyle?: string, characterStyle?: string}>}>} [stories]
 * @property {Array<{id: string, pages: Array<{id: string, bounds: [number, number, number, number]}>, frames: Array<TextFrameSpec | ImageFrameSpec>, appliedMaster?: string}>} [spreads]
 * @property {Array<{id: string, name: string, pages: Array<{id: string, bounds: [number, number, number, number]}>, frames: Array<TextFrameSpec | ImageFrameSpec>}>} [masters]
 * @property {Record<string, string>} [extraFiles]  Add or override arbitrary files in the package
 *
 * @typedef {{kind: 'text', id: string, bounds: [number, number, number, number], parentStory?: string}} TextFrameSpec
 * @typedef {{kind: 'image', id: string, bounds: [number, number, number, number], href?: string}} ImageFrameSpec
 */

/**
 * @param {BuildOptions} [options]
 * @returns {Uint8Array}
 */
export function buildIdml(options = {}) {
	const o = withDefaults(options);
	const files = {
		mimetype: strToU8('application/vnd.adobe.indesign-idml-package'),
		'META-INF/container.xml': strToU8(containerXml()),
	};

	if (!o.omitDesignMap) {
		files['designmap.xml'] = strToU8(designMapXml(o));
	}
	if (!o.omitGraphic) {
		files['Resources/Graphic.xml'] = strToU8(graphicXml(o));
	}
	if (!o.omitFonts) {
		files['Resources/Fonts.xml'] = strToU8(fontsXml(o));
	}
	if (!o.omitStyles) {
		files['Resources/Styles.xml'] = strToU8(stylesXml(o));
	}

	for (const story of o.stories) {
		files[`Stories/Story_${story.id}.xml`] = strToU8(storyXml(story));
	}
	for (const spread of o.spreads) {
		files[`Spreads/Spread_${spread.id}.xml`] = strToU8(spreadXml(spread));
	}
	for (const master of o.masters) {
		files[`MasterSpreads/MasterSpread_${master.id}.xml`] = strToU8(masterSpreadXml(master));
	}
	if (o.extraFiles) {
		for (const [path, contents] of Object.entries(o.extraFiles)) {
			files[path] = strToU8(contents);
		}
	}

	return zipSync(files);
}

function withDefaults(o) {
	return {
		idmlVersion: o.idmlVersion ?? '16.0',
		name: o.name ?? 'TestDocument',
		omitDesignMap: o.omitDesignMap ?? false,
		omitGraphic: o.omitGraphic ?? false,
		omitFonts: o.omitFonts ?? false,
		omitStyles: o.omitStyles ?? false,
		colors: o.colors ?? [],
		fonts: o.fonts ?? [],
		styles: o.styles ?? [],
		stories: o.stories ?? [],
		spreads: o.spreads ?? [],
		masters: o.masters ?? [],
		extraFiles: o.extraFiles,
	};
}

function containerXml() {
	return `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="designmap.xml" media-type="application/vnd.adobe.indesign-idml-package"/>
  </rootfiles>
</container>`;
}

function designMapXml(o) {
	const stories = o.stories.map((s) => `  <idPkg:Story src="Stories/Story_${s.id}.xml"/>`).join('\n');
	const spreads = o.spreads.map((s) => `  <idPkg:Spread src="Spreads/Spread_${s.id}.xml"/>`).join('\n');
	const masters = o.masters.map((m) => `  <idPkg:MasterSpread src="MasterSpreads/MasterSpread_${m.id}.xml"/>`).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${o.idmlVersion}" Name="${o.name}">
${[
		'  <idPkg:Graphic src="Resources/Graphic.xml"/>',
		'  <idPkg:Fonts src="Resources/Fonts.xml"/>',
		'  <idPkg:Styles src="Resources/Styles.xml"/>',
		stories,
		spreads,
		masters,
	]
		.filter(Boolean)
		.join('\n')}
</Document>`;
}

function graphicXml(o) {
	const colors = o.colors
		.map((c) => {
			const space = c.space ?? 'RGB';
			const values = c.values.join(' ');
			return `  <Color Self="${c.id}" Name="${c.name}" Space="${space}" ColorValue="${values}"/>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
${colors}
</idPkg:Graphic>`;
}

function fontsXml(o) {
	const families = groupBy(o.fonts, (f) => f.family);
	const blocks = [...families.entries()].map(([family, fonts]) => {
		const inner = fonts
			.map(
				(f) =>
					`    <Font Self="${f.id}" FontStyleName="${f.style ?? 'Regular'}" PostScriptName="${f.postScriptName ?? family}"/>`,
			)
			.join('\n');
		return `  <FontFamily Self="${family}" Name="${family}">\n${inner}\n  </FontFamily>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Fonts xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
${blocks.join('\n')}
</idPkg:Fonts>`;
}

function stylesXml(o) {
	const buildStyleNode = (s) => {
		const tag = s.kind === 'paragraph' ? 'ParagraphStyle' : 'CharacterStyle';
		const attrs = [
			`Self="${s.id}"`,
			`Name="${s.name}"`,
			s.pointSize !== undefined ? `PointSize="${s.pointSize}"` : null,
			s.leading !== undefined ? `Leading="${s.leading}"` : null,
			s.tracking !== undefined ? `Tracking="${s.tracking}"` : null,
			s.appliedFont ? `AppliedFont="${s.appliedFont}"` : null,
			s.fillColor ? `FillColor="${s.fillColor}"` : null,
		]
			.filter(Boolean)
			.join(' ');
		return `      <${tag} ${attrs}/>`;
	};
	const paragraphs = o.styles.filter((s) => s.kind === 'paragraph').map(buildStyleNode).join('\n');
	const characters = o.styles.filter((s) => s.kind === 'character').map(buildStyleNode).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
  <RootParagraphStyleGroup Self="root-para">
${paragraphs}
  </RootParagraphStyleGroup>
  <RootCharacterStyleGroup Self="root-char">
${characters}
  </RootCharacterStyleGroup>
</idPkg:Styles>`;
}

function storyXml(story) {
	const paras = story.runs
		.map((run) => {
			const paraAttr = run.paragraphStyle ? `AppliedParagraphStyle="${run.paragraphStyle}"` : '';
			const charAttr = run.characterStyle ? `AppliedCharacterStyle="${run.characterStyle}"` : '';
			return `    <ParagraphStyleRange ${paraAttr}>
      <CharacterStyleRange ${charAttr}>
        <Content>${escapeXml(run.text)}</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
  <Story Self="${story.id}">
${paras}
  </Story>
</idPkg:Story>`;
}

function spreadXml(spread) {
	const pages = spread.pages
		.map((p) => `    <Page Self="${p.id}" GeometricBounds="${p.bounds.join(' ')}"/>`)
		.join('\n');
	const frames = spread.frames.map(frameXml).join('\n');
	const appliedMaster = spread.appliedMaster ? ` AppliedMaster="${spread.appliedMaster}"` : '';
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
  <Spread Self="${spread.id}"${appliedMaster}>
${pages}
${frames}
  </Spread>
</idPkg:Spread>`;
}

function masterSpreadXml(master) {
	const pages = master.pages
		.map((p) => `    <Page Self="${p.id}" GeometricBounds="${p.bounds.join(' ')}"/>`)
		.join('\n');
	const frames = master.frames.map(frameXml).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:MasterSpread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="16.0">
  <MasterSpread Self="${master.id}" Name="${master.name}">
${pages}
${frames}
  </MasterSpread>
</idPkg:MasterSpread>`;
}

function frameXml(frame) {
	if (frame.kind === 'text') {
		const parent = frame.parentStory ? ` ParentStory="${frame.parentStory}"` : '';
		return `    <TextFrame Self="${frame.id}" GeometricBounds="${frame.bounds.join(' ')}"${parent}/>`;
	}
	const href = frame.href ?? 'file:Resources/image.jpg';
	return `    <Rectangle Self="${frame.id}" GeometricBounds="${frame.bounds.join(' ')}">
      <Image Self="${frame.id}-img" Href="${href}">
        <Link Self="${frame.id}-link" LinkResourceURI="${href}"/>
      </Image>
    </Rectangle>`;
}

function escapeXml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function groupBy(arr, keyFn) {
	const map = new Map();
	for (const item of arr) {
		const key = keyFn(item);
		const bucket = map.get(key) ?? [];
		bucket.push(item);
		map.set(key, bucket);
	}
	return map;
}
