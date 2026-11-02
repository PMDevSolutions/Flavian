// fse-template-lanes.js — one lane per FSE template (Step 2.4 of the design-to-FSE pipelines).
//
// Called by the figma-to-fse-autonomous-workflow skill (and the Canva and
// InDesign pipelines) once theme.json and the template plan exist, or directly
// as /fse-template-lanes with the same args. Each template runs in its own
// lane: the converter writes the file → block-markup-validator checks it
// without editing → up to maxAttempts fix rounds, the bound enforced here, in
// code. Templates run in priority groups with a barrier between groups, so
// template parts exist before the templates that reference them and index.html
// exists before the rest. The workflow ends by having one agent write the
// templates section of the pipeline state file; it starts no server, deploys
// nothing, and never asks the user anything.
//
// args = {
//   theme: 'acme',                                   // themes/<theme>/
//   source: 'figma',                                 // figma | canva | indesign
//   converter: 'figma-fse-converter',                // agent type that writes and fixes templates
//   templates: [{ name: 'header.html', kind: 'part' | 'template' | 'pattern', priority: 1, figmaNodeId: '1:2', notes: '' }],
//   maxAttempts: 3,                                  // convert + fix rounds per template
//   stateFile: '.claude/pipeline/acme/state.json',   // rewritten by the last agent
//   startedAt: '2026-11-02T10:00:00Z',               // the caller's clock (the script itself cannot read the clock)
// }
// Every template needs name and kind; priority defaults to 1 for parts,
// 2 for index.html, 3 for the rest; figmaNodeId is passed to the converter
// when present.

export const meta = {
  name: 'fse-template-lanes',
  description: 'Convert each FSE template in its own lane (convert, validate, bounded fix loop), priority group by priority group, then record the results in the pipeline state file.',
  whenToUse: 'Step 2.4 of the figma, canva or indesign pipeline skill, once theme.json and the template plan exist and the run has three or more templates.',
  phases: [
    { title: 'Convert', detail: 'one converter lane per template, priority group by priority group' },
    { title: 'Validate', detail: 'block-markup-validator checks each file without editing; up to maxAttempts rounds' },
    { title: 'Record', detail: 'one agent writes the templates section of the state file' },
  ],
}

const input = args || {}
const theme = input.theme
const templates = Array.isArray(input.templates) ? input.templates : []
const source = input.source || 'figma'
const converter = input.converter || 'figma-fse-converter'
const maxAttempts = Number.isInteger(input.maxAttempts) && input.maxAttempts > 0 ? input.maxAttempts : 3
const stateFile = input.stateFile || `.claude/pipeline/${theme}/state.json`
const startedAt = input.startedAt || ''
const themeDir = `themes/${theme}`
if (!theme || !templates.length) {
  throw new Error('fse-template-lanes needs args.theme and a non-empty args.templates array (see the header comment)')
}
for (const t of templates) {
  if (!t || !t.name || !t.kind) throw new Error(`every template needs name and kind; got ${JSON.stringify(t)}`)
}

const CONVERT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Project-relative path of the written file' },
    blocks: { type: 'integer', description: 'Number of top-level blocks' },
    tokensUsed: { type: 'array', items: { type: 'string' }, description: 'theme.json preset slugs referenced' },
    inlineStyles: { type: 'integer', description: 'Inline style values that had no preset' },
    summary: { type: 'string', description: 'One or two sentences: structure and any fallback used' },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'summary'],
}

const VALIDATE_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'boolean', description: 'No hardcoded values, balanced blocks, valid block JSON, headings in order' },
    hardcodedColors: { type: 'integer' },
    hardcodedPx: { type: 'integer' },
    unbalancedBlocks: { type: 'integer' },
    findings: { type: 'array', items: { type: 'string' }, description: 'Each finding with file:line and the fix' },
  },
  required: ['passed', 'findings'],
}

const RECORD_SCHEMA = {
  type: 'object',
  properties: { path: { type: 'string' }, done: { type: 'integer' }, needsReview: { type: 'integer' } },
  required: ['path', 'done', 'needsReview'],
}

const kindDir = (t) => (t.kind === 'part' ? 'parts' : t.kind === 'pattern' ? 'patterns' : 'templates')
const targetPath = (t) => `${themeDir}/${kindDir(t)}/${t.name}`
const priorityOf = (t) => (Number.isInteger(t.priority) ? t.priority : t.kind === 'part' ? 1 : t.name === 'index.html' ? 2 : 3)

function convertPrompt(t, attempt, last) {
  return [
    `Convert the ${t.kind} "${t.name}" of theme "${theme}" (source: ${source}) to WordPress block markup at ${targetPath(t)}. Attempt ${attempt} of ${maxAttempts}.`,
    `Read ${themeDir}/theme.json first: every colour, spacing, font size and font family comes from its presets (var(--wp--preset--...) or the matching block attribute), never a literal. A value with no preset recurs → add the preset to theme.json; appears once or twice → an inline style, counted in inlineStyles.`,
    t.figmaNodeId ? `Figma node: ${t.figmaNodeId}. Use get_code for the structure and get_screenshot as the fallback when get_code fails; never ask the user.` : '',
    t.notes ? `Notes from the plan:\n${t.notes}` : '',
    t.kind === 'template' ? `Reference existing parts with <!-- wp:template-part {"slug":"header"} /--> rather than repeating them. Images belong in PHP patterns, never in an HTML template with an empty src.` : '',
    t.kind === 'pattern' ? `Write a PHP pattern with the registration header comment (Title, Slug ${theme}/<name>, Categories) and get_theme_file_uri() for images.` : '',
    `Balanced block comments, valid JSON in every block comment, semantic HTML, alt text, headings in order (one h1 per page).`,
    last && !last.passed ? `The previous attempt failed validation:\n${last.findings.map((f) => `- ${f}`).join('\n')}` : '',
    `Write only this file (and theme.json for a new preset). Other lanes are writing the other templates at the same time. Do not deploy, commit or push anything. Return the path, the block count, the preset slugs used, the inline-style count and any open question for the human.`,
  ].filter(Boolean).join('\n\n')
}

function validatePrompt(t, built) {
  const path = (built && built.path) || targetPath(t)
  return [
    `Validate ${path} (${t.kind} "${t.name}" of theme "${theme}") without editing any file.`,
    `Run the three validators by piping the hook event they expect, and read what they print to stderr:`,
    `  printf '%s' '{"tool_input":{"file_path":"${path}"}}' | bash scripts/figma-fse/validate-template.sh`,
    `  printf '%s' '{"tool_input":{"file_path":"${path}"}}' | bash scripts/block-markup-validator/validate-block-markup.sh`,
    `  printf '%s' '{"tool_input":{"file_path":"${path}"}}' | bash scripts/theme-token-auditor/audit-tokens.sh`,
    `Then count the hex colours and pixel values in style attributes and block JSON yourself (grep -nE 'style="[^"]*#[0-9A-Fa-f]{3,8}' and 'style="[^"]*[0-9]+px'), check that every <!-- wp:x --> has its <!-- /wp:x --> (self-closing /--> blocks need none), that each block comment's JSON parses, and that heading levels do not skip.`,
    `passed is true only when every count is zero and nothing is unbalanced. Report each finding as file:line plus the fix (the preset slug to use).`,
  ].join('\n')
}

// One lane: convert, validate, fix up to the bound. The decision is made here.
async function lane(t) {
  let last = null
  let built = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    built = await agent(convertPrompt(t, attempt, last), { agentType: converter, phase: 'Convert', label: `convert:${t.name}:a${attempt}`, schema: CONVERT_SCHEMA })
    if (!built) return { name: t.name, kind: t.kind, status: 'MISSING', attempts: attempt, issues: ['the converter did not return'], path: targetPath(t) }
    const check = await agent(validatePrompt(t, built), { agentType: 'block-markup-validator', phase: 'Validate', label: `validate:${t.name}:a${attempt}`, schema: VALIDATE_SCHEMA, effort: 'low' })
    if (!check) return { name: t.name, kind: t.kind, status: 'NEEDS_REVIEW', attempts: attempt, issues: ['the validator did not return'], path: built.path, openQuestions: built.openQuestions || [] }
    if (check.passed) return { name: t.name, kind: t.kind, status: 'GREEN', attempts: attempt, issues: [], path: built.path, tokensUsed: built.tokensUsed || [], inlineStyles: built.inlineStyles || 0, openQuestions: built.openQuestions || [] }
    last = check
  }
  return { name: t.name, kind: t.kind, status: 'NEEDS_REVIEW', attempts: maxAttempts, issues: last ? last.findings : [], path: built ? built.path : targetPath(t), openQuestions: (built && built.openQuestions) || [] }
}

// --- Convert and validate: priority group by priority group ------------------
// A barrier between groups is needed: a template references the parts below it.
const results = []
const priorities = [...new Set(templates.map(priorityOf))].sort((a, b) => a - b)
for (const p of priorities) {
  const group = templates.filter((t) => priorityOf(t) === p)
  log(`Priority ${p}: converting ${group.length} template(s) in parallel`)
  const out = await pipeline(group, (t) => lane(t))
  out.forEach((r, i) => results.push(r || { name: group[i].name, kind: group[i].kind, status: 'MISSING', attempts: 0, issues: ['the lane failed'], path: targetPath(group[i]) }))
  const green = out.filter((r) => r && r.status === 'GREEN').length
  log(`Priority ${p}: ${green}/${group.length} green`)
}

// --- Record: the state file's templates section (barrier: needs every lane) ---
phase('Record')
const toStatus = (s) => (s === 'GREEN' ? 'done' : s === 'NEEDS_REVIEW' ? 'needs-review' : 'failed')
const stateTemplates = results.map((r) => {
  const t = templates.find((x) => x.name === r.name) || {}
  return { name: r.name, kind: r.kind, priority: priorityOf(t), status: toStatus(r.status), attempts: r.attempts, figmaNodeId: t.figmaNodeId || null, issues: r.issues || [] }
})
const record = await agent([
  `Update the pipeline state file at ${stateFile} for theme "${theme}" (pipeline "${source}-to-fse"). If the file exists, keep its other fields; if not, create it with phase "2.4", phases 1 done, 2 running, 3 pending${startedAt ? `, startedAt "${startedAt}"` : ''}.`,
  `Replace its "templates" array with exactly this JSON:\n${JSON.stringify(stateTemplates, null, 2)}`,
  `Set "updatedAt" from the command: date -u +%Y-%m-%dT%H:%M:%SZ. Append nothing else. Write the whole file (valid JSON) and return its path with the counts of done and needs-review templates.`,
].join('\n\n'), { agentType: converter, phase: 'Record', label: 'record-state', schema: RECORD_SCHEMA, effort: 'low' })

const count = (s) => results.filter((r) => r.status === s).length
return {
  theme,
  templates: results,
  summary: { green: count('GREEN'), needsReview: count('NEEDS_REVIEW'), missing: count('MISSING'), total: results.length },
  stateFile: record ? record.path : stateFile,
  openQuestions: results.flatMap((r) => (r.openQuestions || []).map((q) => `${r.name}: ${q}`)),
  nextStep: `Continue the pipeline skill at Step 2.5 (patterns) and Step 2.6 (verification). Templates marked needs-review list their findings above; fix them in the main session or re-run /fse-template-lanes with only those templates. Nothing has been committed or deployed.`,
}
