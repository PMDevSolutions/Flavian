# Figma-to-FSE Implementation Guide

**Purpose:** Step-by-step implementation instructions for converting Figma designs to WordPress FSE themes.

**Audience:** figma-fse-converter agent executing autonomous workflow

---

## Part 1: Design Token Extraction (Figma → theme.json)

### ⚠️ NEW WORKFLOW: theme.json-First Approach

**CRITICAL CHANGE:** Create theme.json FIRST with auto-detection and fallback tokens. This ensures the workflow NEVER blocks on missing design systems.

**Workflow order (new):**
1. **Create theme.json IMMEDIATELY** (auto-detect OR use fallbacks)
2. Survey templates
3. Generate templates using theme.json tokens

**Old workflow (deprecated):** Ask user for design system location → Extract → Create theme.json → Templates

**Fallback Design Tokens:** See SKILL.md "Fallback Design Tokens" section for complete defaults (13 colors, 9 font sizes, 10 spacing tokens)

**Key functions to implement:**

```javascript
// 1. Auto-detect design system (non-blocking)
async function autoDetectDesignSystem(figmaFileKey) {
  const commonNames = ["Design System", "Styles", "Tokens", "Library", "Components"];
  // Search pages/frames by name
  // Return {nodeId, name} if found, null if not found
}

// 2. Merge Figma tokens with fallbacks
function mergeFigmaWithDefaults(figmaTokens, fallbackTokens) {
  // Figma tokens take precedence by slug
  // Fill gaps with fallback tokens
  // Ensure minimum viable theme.json
}

// 3. Create theme.json foundation
async function createThemeJsonFoundation(figmaFileKey, themeName) {
  const designSystem = await autoDetectDesignSystem(figmaFileKey);
  let tokens = designSystem
    ? await extractFigmaTokens(designSystem.nodeId)
    : FALLBACK_DESIGN_TOKENS;

  const mergedTokens = mergeFigmaWithDefaults(tokens, FALLBACK_DESIGN_TOKENS);
  const themeJson = generateThemeJson(mergedTokens, themeName);
  await writeFile(`themes/${themeName}/theme.json`, themeJson);

  return {themeJson, tokens: mergedTokens};
}
```

**Result:** theme.json created BEFORE template discovery, workflow never blocks.

---

### Step 1: Locate Figma Design System (OPTIONAL - Auto-detection handles this)

**Objective:** Find where design tokens are defined in the Figma file

**Implementation:**

```
1. Ask user: "Where is your design system in the Figma file?"

   Suggested locations to mention:
   - Separate "Design System" page
   - "Styles" or "Tokens" page
   - Component library page
   - Shared Figma library (provide URL)

2. If user unsure, use Figma MCP get_metadata to search:
   - Look for pages named: "Design System", "Styles", "Tokens", "Library"
   - Look for frames with organized color/typography documentation

3. Once located, get the node ID for the design system page/frame
```

### Step 2: Extract Design Variables with Figma MCP

**Objective:** Use get_variable_defs to extract ALL design tokens

**Figma MCP Tool: get_variable_defs**

```typescript
// Input
{
  nodeId: "123:456",  // Design system page node ID
  fileKey: "abc123"   // Figma file key from URL
}

// Output structure
{
  variables: {
    colors: {
      "primary": "#0066CC",
      "secondary": "#FF6B35",
      "neutral-100": "#FFFFFF",
      "neutral-900": "#000000",
      // ... more colors
    },
    typography: {
      fontFamilies: {
        "primary": "Inter, sans-serif",
        "secondary": "Playfair Display, serif"
      },
      fontSizes: {
        "xs": "12px",
        "sm": "14px",
        "base": "16px",
        "lg": "18px",
        "xl": "20px",
        "2xl": "24px",
        // ... more sizes
      },
      fontWeights: {
        "normal": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700
      },
      lineHeights: {
        "tight": 1.25,
        "normal": 1.5,
        "relaxed": 1.75
      }
    },
    spacing: {
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "5": "20px",
      "6": "24px",
      "8": "32px",
      "10": "40px",
      "12": "48px",
      "16": "64px",
      "20": "80px",
      "24": "96px"
    },
    layout: {
      "contentWidth": "720px",
      "wideWidth": "1200px",
      "maxWidth": "1440px"
    }
  }
}
```

**Implementation Pattern:**

```javascript
// Pseudo-code for agent
async function extractDesignSystem(nodeId, fileKey) {
  try {
    // Try desktop MCP first (more reliable)
    const variables = await mcp__figma-desktop__get_variable_defs({
      nodeId: nodeId,
      fileKey: fileKey
    });

    return variables;
  } catch (desktopError) {
    console.log("Desktop MCP failed, trying remote...");

    try {
      // Fallback to remote MCP
      const variables = await mcp__figma__get_variable_defs({
        nodeId: nodeId,
        fileKey: fileKey
      });

      return variables;
    } catch (remoteError) {
      // Both failed - this is a blocker
      throw new Error("Figma MCP unreachable. Cannot extract design system.");
    }
  }
}
```

### Step 3: Translate to theme.json Structure

**Objective:** Map Figma variables 1:1 to WordPress theme.json format

**Translation Rules:**

**3.1 Colors: Figma → settings.color.palette**

```javascript
// Input: Figma color variables
{
  "primary": "#0066CC",
  "secondary": "#FF6B35",
  "neutral-100": "#FFFFFF",
  "neutral-900": "#000000"
}

// Output: theme.json palette
{
  "settings": {
    "color": {
      "palette": [
        {
          "slug": "primary",
          "color": "#0066CC",
          "name": "Primary"
        },
        {
          "slug": "secondary",
          "color": "#FF6B35",
          "name": "Secondary"
        },
        {
          "slug": "neutral-100",
          "color": "#FFFFFF",
          "name": "Neutral 100"
        },
        {
          "slug": "neutral-900",
          "color": "#000000",
          "name": "Neutral 900"
        }
      ]
    }
  }
}

// Transformation logic
function translateColors(figmaColors) {
  return Object.entries(figmaColors).map(([slug, color]) => ({
    slug: slug,
    color: color,
    name: slugToTitle(slug) // "neutral-100" → "Neutral 100"
  }));
}
```

**3.2 Typography: Figma → settings.typography**

```javascript
// Input: Figma typography variables
{
  fontFamilies: {
    "primary": "Inter, sans-serif",
    "secondary": "Playfair Display, serif"
  },
  fontSizes: {
    "xs": "12px",
    "base": "16px",
    "2xl": "24px"
  },
  fontWeights: {
    "normal": 400,
    "bold": 700
  }
}

// Output: theme.json typography
{
  "settings": {
    "typography": {
      "fontFamilies": [
        {
          "slug": "primary",
          "fontFamily": "Inter, sans-serif",
          "name": "Primary"
        },
        {
          "slug": "secondary",
          "fontFamily": "Playfair Display, serif",
          "name": "Secondary"
        }
      ],
      "fontSizes": [
        {
          "slug": "xs",
          "size": "0.75rem",
          "name": "Extra Small"
        },
        {
          "slug": "base",
          "size": "1rem",
          "name": "Base"
        },
        {
          "slug": "2xl",
          "size": "1.5rem",
          "name": "2XL"
        }
      ],
      "fontWeights": [
        {
          "slug": "normal",
          "weight": "400",
          "name": "Normal"
        },
        {
          "slug": "bold",
          "weight": "700",
          "name": "Bold"
        }
      ]
    }
  }
}

// Transformation: Convert px to rem (16px base)
function pxToRem(pxValue) {
  const px = parseInt(pxValue);
  return `${px / 16}rem`;
}
```

**3.3 Spacing: Figma → settings.spacing.spacingSizes**

```javascript
// Input: Figma spacing tokens
{
  "1": "4px",
  "2": "8px",
  "4": "16px",
  "8": "32px",
  "12": "48px"
}

// Output: theme.json spacing
{
  "settings": {
    "spacing": {
      "spacingSizes": [
        {
          "slug": "20",
          "size": "4px",
          "name": "1"
        },
        {
          "slug": "30",
          "size": "8px",
          "name": "2"
        },
        {
          "slug": "40",
          "size": "16px",
          "name": "4"
        },
        {
          "slug": "50",
          "size": "32px",
          "name": "8"
        },
        {
          "slug": "60",
          "size": "48px",
          "name": "12"
        }
      ]
    }
  }
}

// Note: WordPress uses slug numbers (20, 30, 40, etc.)
// Map Figma spacing numbers to WP convention
function translateSpacing(figmaSpacing) {
  return Object.entries(figmaSpacing).map(([name, size], index) => ({
    slug: `${(index + 2) * 10}`, // Start at 20, increment by 10
    size: size,
    name: name
  }));
}
```

**3.4 Layout: Figma → settings.layout**

```javascript
// Input: Figma layout variables
{
  "contentWidth": "720px",
  "wideWidth": "1200px",
  "maxWidth": "1440px"
}

// Output: theme.json layout
{
  "settings": {
    "layout": {
      "contentSize": "720px",
      "wideSize": "1200px"
    }
  }
}

// Note: theme.json only has contentSize and wideSize
// maxWidth would go in styles.spacing.padding on root
```

### Step 4: Generate Complete theme.json

**Objective:** Create production-ready theme.json file

**Template:**

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 2,
  "settings": {
    "appearanceTools": true,
    "useRootPaddingAwareAlignments": true,
    "color": {
      "custom": false,
      "customDuotone": false,
      "customGradient": false,
      "defaultPalette": false,
      "palette": [
        /* INSERT TRANSLATED COLORS HERE */
      ]
    },
    "typography": {
      "customFontSize": false,
      "dropCap": false,
      "fontFamilies": [
        /* INSERT TRANSLATED FONT FAMILIES HERE */
      ],
      "fontSizes": [
        /* INSERT TRANSLATED FONT SIZES HERE */
      ]
    },
    "spacing": {
      "spacingSizes": [
        /* INSERT TRANSLATED SPACING HERE */
      ],
      "units": ["px", "rem", "em", "%"]
    },
    "layout": {
      "contentSize": "/* INSERT FROM FIGMA */",
      "wideSize": "/* INSERT FROM FIGMA */"
    }
  },
  "styles": {
    "color": {
      "background": "var(--wp--preset--color--neutral-100)",
      "text": "var(--wp--preset--color--neutral-900)"
    },
    "typography": {
      "fontFamily": "var(--wp--preset--font-family--primary)",
      "fontSize": "var(--wp--preset--font-size--base)",
      "lineHeight": "1.5"
    },
    "spacing": {
      "padding": {
        "top": "0",
        "right": "var(--wp--preset--spacing--40)",
        "bottom": "0",
        "left": "var(--wp--preset--spacing--40)"
      }
    }
  }
}
```

**Implementation Steps:**

```javascript
async function generateThemeJson(figmaVariables, themeName) {
  // 1. Create base structure
  const themeJson = {
    "$schema": "https://schemas.wp.org/trunk/theme.json",
    "version": 2,
    "settings": {
      "appearanceTools": true,
      "useRootPaddingAwareAlignments": true,
      "color": {
        "custom": false,
        "customDuotone": false,
        "customGradient": false,
        "defaultPalette": false,
        "palette": translateColors(figmaVariables.colors)
      },
      "typography": {
        "customFontSize": false,
        "dropCap": false,
        "fontFamilies": translateFontFamilies(figmaVariables.typography.fontFamilies),
        "fontSizes": translateFontSizes(figmaVariables.typography.fontSizes)
      },
      "spacing": {
        "spacingSizes": translateSpacing(figmaVariables.spacing),
        "units": ["px", "rem", "em", "%"]
      },
      "layout": {
        "contentSize": figmaVariables.layout.contentWidth,
        "wideSize": figmaVariables.layout.wideWidth
      }
    },
    "styles": {
      "color": {
        "background": "var(--wp--preset--color--neutral-100)",
        "text": "var(--wp--preset--color--neutral-900)"
      },
      "typography": {
        "fontFamily": "var(--wp--preset--font-family--primary)",
        "fontSize": "var(--wp--preset--font-size--base)",
        "lineHeight": "1.5"
      },
      "spacing": {
        "padding": {
          "top": "0",
          "right": "var(--wp--preset--spacing--40)",
          "bottom": "0",
          "left": "var(--wp--preset--spacing--40)"
        }
      }
    }
  };

  // 2. Write to file
  const filePath = `themes/${themeName}/theme.json`;
  await writeFile(filePath, JSON.stringify(themeJson, null, 2));

  // 3. Run validation
  await validateThemeJson(filePath);

  return themeJson;
}
```

### Step 5: Validate Theme.json

**Objective:** Ensure theme.json is valid and comprehensive

**Validation Checklist:**

```bash
# Run extract-design-tokens.sh script
./scripts/figma-fse/extract-design-tokens.sh < theme.json

# Expected output:
✅ Comprehensive design system detected
📊 Design Token Summary:
   Colors: 12
   Font Sizes: 8
   Spacing Tokens: 9
```

**Manual Validation:**

```
1. JSON syntax valid? (jq can parse it)
2. Has required sections? (color.palette, typography, spacing)
3. Minimum token counts? (6+ colors, 5+ sizes, 6+ spacing)
4. No hardcoded hex in styles? (use var() references)
5. Schema version 2? (WordPress 6.0+)
```

---

## Part 2: Template Conversion (Figma Frame → FSE Template)

### Step 1: Survey Templates to Convert

**Objective:** Identify all Figma frames that represent WordPress templates

**Implementation:**

```javascript
async function surveyTemplates(figmaFileKey) {
  // 1. Use get_metadata to get file structure
  const metadata = await mcp__figma-desktop__get_metadata({
    nodeId: "0:1", // Root page
    fileKey: figmaFileKey
  });

  // 2. Parse XML to find frames/pages
  const pages = parsePages(metadata);

  // 3. Identify template frames
  // Look for frames named: Homepage, About, Contact, Blog, etc.
  const templates = pages.filter(page =>
    isTemplateFrame(page.name)
  );

  // 4. Capture screenshot of each template
  const templateData = [];
  for (const template of templates) {
    const screenshot = await mcp__figma-desktop__get_screenshot({
      nodeId: template.nodeId,
      fileKey: figmaFileKey
    });

    templateData.push({
      name: template.name,
      nodeId: template.nodeId,
      screenshot: screenshot,
      wpTemplateName: figmaNameToWpTemplate(template.name)
    });
  }

  return templateData;
}

// Helper: Determine if frame name indicates a template
function isTemplateFrame(name) {
  const templateKeywords = [
    'homepage', 'home', 'front-page',
    'about', 'contact', 'services',
    'blog', 'archive', 'single',
    'page', '404', 'search'
  ];

  const lowerName = name.toLowerCase();
  return templateKeywords.some(keyword => lowerName.includes(keyword));
}

// Helper: Map Figma frame name to WordPress template file
function figmaNameToWpTemplate(figmaName) {
  const mapping = {
    'homepage': 'front-page.html',
    'home': 'home.html',
    'about': 'page-about.html',
    'contact': 'page-contact.html',
    'blog': 'home.html',
    'single post': 'single.html',
    'archive': 'archive.html',
    '404': '404.html',
    'search': 'search.html'
  };

  const lowerName = figmaName.toLowerCase();

  for (const [key, value] of Object.entries(mapping)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  // Default: generic page template
  return 'page.html';
}
```

### Step 2: Extract Template Structure from Figma

**Objective:** Get component structure using Figma MCP

**Primary Method: get_design_context (get_code)**

```javascript
async function extractTemplateStructure(nodeId, fileKey) {
  try {
    // Try get_design_context first (most detailed)
    const designContext = await mcp__figma-desktop__get_design_context({
      nodeId: nodeId,
      fileKey: fileKey,
      clientLanguages: "html,css",
      clientFrameworks: "wordpress"
    });

    return {
      success: true,
      method: 'design_context',
      structure: designContext.code,
      assets: designContext.assets
    };

  } catch (error) {
    console.log("get_design_context failed (likely annotations), falling back...");
    return await extractFromScreenshot(nodeId, fileKey);
  }
}
```

**Fallback Method: get_screenshot + Visual Analysis**

```javascript
async function extractFromScreenshot(nodeId, fileKey) {
  // Get screenshot
  const screenshot = await mcp__figma-desktop__get_screenshot({
    nodeId: nodeId,
    fileKey: fileKey
  });

  // Analyze screenshot visually
  const analysis = await analyzeScreenshot(screenshot);

  return {
    success: true,
    method: 'screenshot_analysis',
    structure: analysis
  };
}

function analyzeScreenshot(screenshot) {
  // Visual analysis pattern (agent uses vision capabilities)
  return {
    sections: [
      {
        type: 'hero',
        layout: 'full-width',
        elements: ['heading', 'paragraph', 'button']
      },
      {
        type: 'content',
        layout: 'contained',
        elements: ['heading', 'columns']
      }
    ]
  };
}
```

### Step 3: Map Figma Components to WordPress Blocks

**Objective:** Translate Figma structure to FSE block markup

**Component Mapping Reference:**

```javascript
const COMPONENT_MAP = {
  // Layout components
  'frame': (props) => generateGroup(props),
  'container': (props) => generateGroup(props),
  'section': (props) => generateGroup(props),
  'grid': (props) => generateColumns(props),

  // Content components
  'heading': (props) => generateHeading(props),
  'text': (props) => generateParagraph(props),
  'paragraph': (props) => generateParagraph(props),
  'image': (props) => generateImage(props),
  'button': (props) => generateButton(props),

  // Complex components
  'hero': (props) => generateCover(props),
  'card': (props) => generateCardGroup(props),
  'navigation': (props) => generateNavigation(props),
  'form': (props) => generateForm(props)
};
```

**Block Generation Functions:**

```javascript
// Generate Group block
function generateGroup(props) {
  const {backgroundColor, textColor, spacing, children} = props;

  return `<!-- wp:group {
  "backgroundColor": "${mapColorToSlug(backgroundColor)}",
  "textColor": "${mapColorToSlug(textColor)}",
  "style": {
    "spacing": {
      "padding": {
        "top": "var(--wp--preset--spacing--${mapSpacingToSlug(spacing.top)})",
        "bottom": "var(--wp--preset--spacing--${mapSpacingToSlug(spacing.bottom)})"
      }
    }
  }
} -->
<div class="wp-block-group">${children}</div>
<!-- /wp:group -->`;
}

// Generate Heading block
function generateHeading(props) {
  const {text, level, color, fontSize} = props;

  return `<!-- wp:heading {
  "level": ${level || 2},
  "textColor": "${mapColorToSlug(color)}",
  "fontSize": "${mapFontSizeToSlug(fontSize)}"
} -->
<h${level || 2} class="wp-block-heading">${text}</h${level || 2}>
<!-- /wp:heading -->`;
}

// Generate Cover block (Hero)
function generateCover(props) {
  const {image, overlay, children} = props;

  return `<!-- wp:cover {
  "url": "${image}",
  "dimRatio": 50,
  "overlayColor": "black",
  "align": "full"
} -->
<div class="wp-block-cover alignfull">
  <span aria-hidden="true" class="wp-block-cover__background"></span>
  <img class="wp-block-cover__image-background" src="${image}" />
  <div class="wp-block-cover__inner-container">
    ${children}
  </div>
</div>
<!-- /wp:cover -->`;
}

// Generate Columns block
function generateColumns(props) {
  const {columnCount, children} = props;

  let columnsMarkup = `<!-- wp:columns -->
<div class="wp-block-columns">`;

  for (let i = 0; i < columnCount; i++) {
    columnsMarkup += `
  <!-- wp:column -->
  <div class="wp-block-column">
    ${children[i] || ''}
  </div>
  <!-- /wp:column -->`;
  }

  columnsMarkup += `
</div>
<!-- /wp:columns -->`;

  return columnsMarkup;
}
```

**Helper Functions: Map Figma Values to theme.json Slugs:**

```javascript
function mapColorToSlug(hexColor) {
  // Look up color in theme.json palette
  // Find closest match if exact not found
  const palette = getThemeJsonPalette();

  const match = palette.find(c =>
    c.color.toLowerCase() === hexColor.toLowerCase()
  );

  return match ? match.slug : 'primary'; // Fallback
}

function mapFontSizeToSlug(pxSize) {
  // Convert px to closest theme.json font size slug
  const sizes = {
    '12px': 'xs',
    '14px': 'sm',
    '16px': 'base',
    '18px': 'lg',
    '20px': 'xl',
    '24px': '2xl',
    '32px': '3xl'
  };

  return sizes[pxSize] || 'base';
}

function mapSpacingToSlug(pxSpacing) {
  // Convert px to theme.json spacing slug (20, 30, 40, etc.)
  const spacing = {
    '4px': '20',
    '8px': '30',
    '16px': '40',
    '24px': '50',
    '32px': '60',
    '48px': '70'
  };

  return spacing[pxSpacing] || '40';
}
```

### Step 4: Generate FSE Template HTML

**Objective:** Create complete .html template file

**Template Structure:**

```javascript
async function generateTemplate(templateData, themeJsonPath) {
  const {name, structure, wpTemplateName} = templateData;

  // 1. Parse Figma structure
  const sections = parseFigmaStructure(structure);

  // 2. Convert each section to blocks
  let blockMarkup = '';
  for (const section of sections) {
    const blocks = convertSectionToBlocks(section);
    blockMarkup += blocks + '\n\n';
  }

  // 3. Wrap in template parts if needed
  const templateHtml = `
<!-- wp:template-part {"slug":"header","theme":"${themeName}","tagName":"header"} /-->

${blockMarkup}

<!-- wp:template-part {"slug":"footer","theme":"${themeName}","tagName":"footer"} /-->
  `.trim();

  // 4. Write to file
  const filePath = `themes/${themeName}/templates/${wpTemplateName}`;
  await writeFile(filePath, templateHtml);

  // 5. Validate
  await validateTemplate(filePath);

  return filePath;
}
```

### Step 5: Validate Template Quality

**Objective:** Ensure template is valid and uses tokens correctly

**Validation Steps:**

```javascript
async function validateTemplate(filePath) {
  // 1. Check block syntax
  const content = await readFile(filePath);

  // 2. Verify no hardcoded colors
  const hexMatches = content.match(/#[0-9A-Fa-f]{6}/g);
  if (hexMatches) {
    console.warn(`⚠️ Found ${hexMatches.length} hardcoded colors in ${filePath}`);
  }

  // 3. Verify no hardcoded sizes
  const pxMatches = content.match(/:\s*"[0-9]+px"/g);
  if (pxMatches) {
    console.warn(`⚠️ Found ${pxMatches.length} hardcoded pixel sizes in ${filePath}`);
  }

  // 4. Verify balanced blocks
  const openBlocks = (content.match(/<!-- wp:/g) || []).length;
  const closeBlocks = (content.match(/<!-- \/wp:/g) || []).length;

  if (openBlocks !== closeBlocks) {
    throw new Error(`Unbalanced blocks: ${openBlocks} open, ${closeBlocks} close`);
  }

  // 5. Run validation script
  await runValidationHook(filePath);
}
```

---

## Part 3: Autonomous Execution Integration

### Using superpowers:executing-plans

**Pattern for Autonomous Multi-Template Conversion:**

```
Phase 1: Discovery (Main Agent)
├── Ask for design system location
├── Extract complete design system with get_variable_defs
├── Translate to theme.json
├── Survey templates with get_screenshot
├── Create implementation plan
└── Present to user: "Proceed?"

User: "Yes"

Phase 2: Autonomous Execution (via executing-plans)
├── Invoke: Skill(superpowers:executing-plans, plan)
├── Agent works continuously:
│   ├── Create theme.json
│   ├── For each template (1-15):
│   │   ├── Extract with get_design_context
│   │   ├── Generate FSE template HTML
│   │   ├── Validate (hooks run automatically)
│   │   └── Continue (no prompts)
│   ├── Create block patterns
│   ├── Run quality checks
│   └── Generate comparison report
└── Return: Complete theme

Phase 3: Completion
└── Present results to user
```

**Implementation in Skill:**

When user approves plan in Phase 1, the skill should:

```markdown
User: "Yes, proceed"

[Invoke Skill tool]
skill: "superpowers:executing-plans"
args: Path to plan file created in Phase 1

This triggers autonomous execution where the figma-fse-converter
agent works through ALL templates without interruption.
```

**Agent Behavior During Autonomous Phase:**

```javascript
// Pseudo-code for agent mindset
async function autonomousExecution(plan) {
  // NO "should I continue?" prompts during this function

  for (const task of plan.tasks) {
    try {
      await executeTask(task);
      markTaskComplete(task);
      // Continue to next task immediately
    } catch (error) {
      logError(error);
      tryFallback(task);
      // Don't stop - keep going
    }
  }

  // Only report when ALL complete
  await generateFinalReport();
}
```

---

## Error Recovery Patterns

### Pattern 1: Figma MCP Unreachable

```
Try: mcp__figma-desktop__* (local)
Catch: Connection refused
→ Try: mcp__figma__* (remote)
→ Catch: Both fail
→ STOP: Log error, inform user (blocker)
```

### Pattern 2: get_design_context Fails (Annotations)

```
Try: get_design_context(nodeId)
Catch: "Annotations detected" error
→ Fallback: get_screenshot(nodeId)
→ Analyze screenshot visually
→ Generate blocks from visual analysis
→ Continue: Next template
```

### Pattern 3: Missing Design Token

```
Template needs: color "#FF0000"
theme.json has: No matching color
→ Add to theme.json:
   {
     "slug": "error-red",
     "color": "#FF0000",
     "name": "Error Red"
   }
→ Use: "backgroundColor": "error-red"
→ Log: "Added missing token: error-red"
→ Continue: Template generation
```

### Pattern 4: Complex Component Can't Map

```
Figma: Custom carousel with animations
FSE: No direct equivalent
→ Simplify: Use Gallery block (static)
→ Add note: "Carousel simplified to gallery. Enhance with custom JS later."
→ Continue: Template generation
```

---

## Testing & Verification

### Single Template Test (MVP)

```
1. Create test Figma file with:
   - Design system page (colors, typography, spacing)
   - Single hero section frame

2. Run conversion:
   User: "Convert this hero section to FSE"

3. Verify:
   ✅ theme.json created with design tokens
   ✅ templates/front-page.html created
   ✅ No hardcoded hex colors (#0066CC)
   ✅ Security scan passed
   ✅ Coding standards passed
   ✅ No "should I continue?" prompts

4. Success criteria:
   - < 5 minutes total
   - Pixel-perfect (within 5px tolerance)
   - Zero interruptions
```

---

**End of Implementation Guide**
