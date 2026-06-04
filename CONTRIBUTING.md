# Contributing to Flavian

Thank you for your interest in contributing! 🎉  
We welcome contributions of all kinds — bug fixes, features, and documentation improvements.

---

## Getting Started

Before you begin, please review the following resources:

- [PREREQUISITES.md](docs/PREREQUISITES.md) — Required tools and setup
- [QUICK-START.md](docs/QUICK-START.md) — Quick setup guide
- [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) — Docker-based local environment
- [.env.example](.env.example) — Environment configuration template
- [CLAUDE.md](CLAUDE.md) — Project-specific development guidelines

### Clone the repository

```
git clone https://github.com/PMDevSolutions/Flavian.git
cd Flavian
```

## Development Workflow

1. **Fork** the repository
2. **Create a branch** for your feature or fix
    - feat/my-feature
    - fix/bug-description
    - docs/update-docs
3. **Make your changes** following the coding standards below
4. **Test** your changes with the local Docker environment (`./wordpress-local.sh start`)
5. **Commit** with a [Conventional Commits](#commit-message-format) message (e.g., `feat:`, `fix:`, `docs:`)
6. **Push** Push your branch and open a Pull Request against `main`

## Commit Message Format

This repository uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
to drive automated versioning and changelog generation. Every commit that lands
on `main` (including squash-merge subjects) must follow:

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer(s)>
```

### Allowed types

| Type       | Use for                                              | Triggers release? |
| ---------- | ---------------------------------------------------- | ----------------- |
| `feat`     | A new feature                                        | Minor bump        |
| `fix`      | A bug fix                                            | Patch bump        |
| `perf`     | Performance improvement                              | Patch bump        |
| `docs`     | Documentation only changes                           | No                |
| `refactor` | Code change that isn't a feature or fix              | No                |
| `test`     | Adding or fixing tests                               | No                |
| `build`    | Build system / external dependency changes           | No                |
| `ci`       | CI configuration changes                             | No                |
| `chore`    | Other changes that don't modify src or test files    | No                |
| `style`    | Formatting, whitespace, etc.                         | No                |
| `revert`   | Reverts a previous commit                            | No                |

### Breaking changes

Add `!` after the type/scope **or** include a `BREAKING CHANGE:` footer to
trigger a major version bump:

```
feat(theme)!: drop support for WordPress 6.4

BREAKING CHANGE: The minimum supported WordPress version is now 6.5.
```

### Examples

```
feat(figma-pipeline): add multi-page export support
fix(deploy): validate ssh key before pushing release
docs: link RELEASING.md from README
chore(deps): bump composer dev dependencies
```

PR commits are linted in CI by
[commitlint](https://commitlint.js.org/) using the `config-conventional` ruleset.
PRs with invalid commit messages will fail the `commitlint` check.

See [docs/RELEASING.md](docs/RELEASING.md) for how these commits become tagged
releases.

## Versioning

Flavian's version is **owned by release-please, not hand-edited.**

The source of truth for the current version is:

- **Git tags** (`vX.Y.Z`) — the canonical, immutable record of every release.
- **[`.release-please-manifest.json`](.release-please-manifest.json)** — the
  single line release-please reads to know "what version are we on" when it
  computes the next bump.

The `"version"` field in `package.json` mirrors the released version for tooling
that expects it there. release-please keeps it in sync automatically via the
`extra-files` entry in
[`release-please-config.json`](release-please-config.json), so **do not bump it
by hand** in a feature PR — let release-please own every version change.

We use [release-please](https://github.com/googleapis/release-please) with the
`simple` release type. The flow:

1. You merge Conventional Commits to `main` (see
   [Commit Message Format](#commit-message-format) above). The `type` decides
   the bump — `fix:` → patch, `feat:` → minor, `!`/`BREAKING CHANGE:` → major.
2. release-please opens (and keeps updating) a single **Release PR** titled
   `chore(main): release X.Y.Z`, containing the bumped manifest, the synced
   `package.json` version, and a generated `CHANGELOG.md` entry.
3. A maintainer merges that Release PR. Only then does release-please cut the
   `vX.Y.Z` git tag and GitHub Release. The Release PR is the human gate — no
   tag is created until it is merged.

The full mechanics, override footers (`Release-As:`), pre-release handling, and
the list of files involved are in [docs/RELEASING.md](docs/RELEASING.md).

> **Note:** Sibling frameworks [Aurelius](https://github.com/PMDevSolutions/Aurelius)
> and [Nerva](https://github.com/PMDevSolutions/Nerva) follow the same
> release-please convention. This section is intended to stay aligned with their
> wording once their conventions are documented.

## Coding Standards

- Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- Escape all output (`esc_html()`, `esc_url()`, `esc_attr()`)
- Sanitize all input (`sanitize_text_field()`, etc.)
- Use WordPress APIs and functions where available
- Use PHPCS (PHP CodeSniffer) to check for coding standard violations

## Development Setup

See [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) for Docker-based local environment setup.

## Testing

Before submitting your changes:

- Start the local environment:
  ```bash
  ./wordpress-local.sh start
  ```
- Verify your changes in the browser
- Ensure there are no PHP errors or warnings
- Run any relevant linting or PHPCS checks

### Creating a new plugin

Don't hand-write plugin boilerplate. Use the scaffold:

```bash
bash scripts/scaffold-plugin.sh my-plugin \
  --name "My Plugin" \
  --description "What it does" \
  --author "Your Name"
```

The script generates `plugins/my-plugin/` from `.claude/templates/plugin/`
with PSR-4 autoloading (`Flavian\Plugins\MyPlugin`), Composer config,
PHPUnit + Brain Monkey, PHPCS (`WordPress-Extra`), a Settings API page, a
CPT + taxonomy pair, and a server-rendered block. Feature flags:
`--no-cpt`, `--no-taxonomy`, `--no-settings`, `--no-block`, or `--minimal`
for headers + activation hooks only.

After scaffolding:

```bash
cd plugins/my-plugin
composer install
composer test    # PHPUnit (Brain Monkey — no MySQL needed)
composer lint    # PHPCS WordPress-Extra
```

The reference plugin `plugins/flavian-starter/` is the canonical example
of scaffold output. CI's `plugin-validation` workflow regenerates it from
templates and fails if it diverges, so:

- **Changing a template?** Regenerate `flavian-starter` in the same PR
  (`bash scripts/scaffold-plugin.sh flavian-starter ... --force`) and
  commit both.
- **Adding a new first-party plugin?** Place it under `plugins/flavian-*/`
  — the validation workflow's plugin matrix auto-discovers any directory
  matching that glob.

### Performance budgets

PRs that touch `themes/**` are checked by Lighthouse CI against resource,
timing, and category-score budgets defined in
[`tests/lighthouse/budgets.json`](tests/lighthouse/budgets.json) and
[`lighthouserc.json`](lighthouserc.json). Failures appear as native PR
check annotations.

To debug locally:

```bash
pnpm lighthouse:run   # boots Lighthouse, asserts against budgets
pnpm lighthouse:open  # opens the HTML reports
```

If your change is intentionally heavier (e.g. you added a justified new
script or font), update the budget in the same PR and explain the bump in
the commit body. See
[tests/lighthouse/README.md](tests/lighthouse/README.md) for the full
workflow.

### Visual regression

PRs that touch `themes/**` automatically run the visual regression suite,
which screenshots the seeded WP site at four breakpoints and diffs against
committed baselines in `tests/visual/baselines/`. If you intentionally
changed the UI, regenerate baselines locally and commit them alongside the
code change:

```bash
bash scripts/visual-update-baselines.sh
git add tests/visual/baselines
git commit -m "test(visual): update baselines for <feature>"
```

The script captures inside the same Playwright Docker image used by CI to
keep baselines portable. See [tests/visual/README.md](tests/visual/README.md)
for the full workflow and debugging tips.

## Pull Requests

To help your PR get reviewed and merged quickly:

- Keep PRs small and focused
- Clearly explain what you changed and why
- Reference related issues (e.g., `Closes #47`)
- Ensure your branch is up to date with `main`

### Review Process

- Maintainers will review your PR
- Feedback may be provided — please address it promptly

## Good First Issues

If you're new to the project, check out issues labeled:

- `good first issue`

These are great starting points to get familiar with the codebase.

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)