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

The `version` field in `package.json` is intentionally pinned to `0.0.0` and is
**not** the repository version — **do not edit it by hand**. The source of truth
for the released version is the latest `vX.Y.Z` git tag together with
[`.release-please-manifest.json`](.release-please-manifest.json).

Versioning is automated by [release-please](https://github.com/googleapis/release-please).
The [Conventional Commit](#commit-message-format) types above drive the semver
bump; release-please opens a **Release PR** that updates the manifest and
`CHANGELOG.md`, and merging that PR creates the `vX.Y.Z` tag and GitHub Release.
Because the project uses release-please's `simple` release type, the bump is
recorded in `.release-please-manifest.json` rather than `package.json` — which
is exactly why `package.json` stays at `0.0.0`.

See [docs/RELEASING.md](docs/RELEASING.md) for the full flow, the version-bump
rules, and overrides (e.g. the `Release-As:` footer).

## Coding Standards

- Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- Escape all output (`esc_html()`, `esc_url()`, `esc_attr()`)
- Sanitize all input (`sanitize_text_field()`, etc.)
- Use WordPress APIs and functions where available
- Use PHPCS (PHP CodeSniffer) to check for coding standard violations

### Running PHPCS locally

All first-party PHP under `themes/`, `mu-plugins/`, and non-bundled `plugins/`
is linted against `WordPress-Extra` + `WordPress-Docs`. The ruleset, scan
targets, and exclusions live in one place — [`phpcs.xml.dist`](phpcs.xml.dist) —
and the **same** check runs in CI on every pull request via
[`.github/workflows/phpcs.yml`](.github/workflows/phpcs.yml).

One-time setup (installs PHP_CodeSniffer + the WordPress Coding Standards):

```bash
composer install
# …or, if you don't have the dev tooling yet:
./scripts/wordpress/setup-phpcs.sh
```

Check your changes:

```bash
composer phpcs                                       # lint the whole project
./scripts/wordpress/check-coding-standards.sh        # same, advisory
./scripts/wordpress/check-coding-standards.sh themes/my-theme   # lint one path
```

Auto-fix everything PHPCS can fix automatically, then re-check:

```bash
composer phpcbf
```

To reproduce CI's pass/fail gate exactly (non-zero exit on any violation):

```bash
./scripts/wordpress/check-coding-standards.sh --strict
# (equivalent to `composer check-standards`)
```

First-party plugins under `plugins/flavian-*/` carry their own
`.phpcs.xml.dist` and are linted separately by the `plugin-validation`
workflow, so they are excluded from the project-level check above.

> **Windows users:** the repo pins LF line endings via
> [`.gitattributes`](.gitattributes), because PHPCS's line-ending sniff expects
> LF. Make sure your editor and Git (`core.autocrlf`) don't reintroduce CRLF —
> otherwise you may see false `Generic.Files.LineEndings` errors locally that do
> not appear in CI.

### Required status check

The **WordPress Coding Standards** check is intended to be a **required** status
check for merging into `main`. A repository admin enforces this once, in the
GitHub UI:

- **Settings → Branches → Branch protection rules** (or **Settings → Rules →
  Rulesets**) for `main`, then **Require status checks to pass before merging**
  and select **WordPress Coding Standards**.

Because the workflow runs on every PR (not just PHP-only PRs), it always reports
a result and is safe to require without blocking unrelated changes.

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