// The human-facing generation report (indesign-pipeline-report.md). Enumerates
// every produced artifact, the IR nodes that couldn't be mapped, and the manual
// follow-ups (font fallbacks, out-of-gamut colors, Google fonts to enqueue,
// assets whose bytes weren't staged). Deterministic: no timestamps.

function list(items) {
	return items.length ? items.map((i) => `- ${i}`).join('\n') : '_None._';
}

function section(title, body) {
	return `## ${title}\n\n${body}\n`;
}

/**
 * @param {Object} input
 * @param {string} input.themeName
 * @param {string} input.themeSlug
 * @param {Array<string>} input.files          Theme-relative paths produced.
 * @param {Array<object>} input.assets         Planned assets (PlannedAsset[]).
 * @param {Array<{id: string, kind: string, reason: string}>} input.unmapped
 * @param {object} input.tokensReport          mapTokens() report.
 * @param {boolean} input.derivedFromMaster    Whether parts came from a master.
 * @param {number} input.spreadCount
 * @param {boolean} [input.assetsStaged]       Whether real bytes were copied in.
 * @returns {string}
 */
export function buildGenerationReport(input) {
	const {
		themeName,
		themeSlug,
		files,
		assets = [],
		unmapped = [],
		tokensReport = {},
		derivedFromMaster,
		spreadCount,
		assetsStaged = false,
	} = input;

	const followUps = [];
	for (const m of tokensReport.fontFallbacks ?? []) followUps.push(`Font fallback: ${m}`);
	for (const g of tokensReport.googleFonts ?? []) followUps.push(`Enqueue Google font: ${g.name} (slug \`${g.slug}\`)`);
	for (const m of tokensReport.outOfGamut ?? []) followUps.push(`Out-of-gamut color clamped: ${m}`);
	if (!assetsStaged && assets.length) {
		followUps.push(`${assets.length} image asset(s) referenced but bytes not staged — drop files into \`assets/\` (see names below) and run \`bin/import-media.sh\`.`);
	}
	if (!derivedFromMaster) {
		followUps.push('Header/footer use generated defaults (no usable master-spread chrome found) — review `parts/header.html` and `parts/footer.html`.');
	}

	const unmappedLines = unmapped.map((u) => `\`${u.id}\` (${u.kind}) — ${u.reason}`);
	const assetLines = assets.map((a) => `\`${a.relPath}\`${a.href ? ` ← ${a.href}` : ''}${a.embedded ? ' (embedded)' : ''}`);

	const validityNote = tokensReport.valid === false
		? `⚠️ **theme.json failed validation** (${(tokensReport.validationErrors ?? []).length} error(s)).`
		: '✅ theme.json validates against the WordPress schema.';

	return [
		`# InDesign import — generation report`,
		'',
		`**Theme:** ${themeName} (\`${themeSlug}\`)`,
		`**Spreads imported:** ${spreadCount}`,
		'',
		validityNote,
		'',
		section('Produced artifacts', list(files.map((f) => `\`${f}\``))),
		section('Staged assets', list(assetLines)),
		section('Unmapped IR nodes', list(unmappedLines)),
		section('Manual follow-ups', list(followUps)),
		section(
			'Token summary',
			[
				`- Swatches: ${tokensReport.counts?.swatches ?? 0}`,
				`- Fonts: ${tokensReport.counts?.fonts ?? 0}`,
				`- Styles: ${tokensReport.counts?.styles ?? 0}`,
				`- Mapper warnings: ${tokensReport.counts?.warnings ?? 0}`,
			].join('\n'),
		),
	].join('\n');
}
