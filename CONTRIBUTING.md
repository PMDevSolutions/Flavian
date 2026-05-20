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