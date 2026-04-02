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
5. **Commit** with a descriptive message using conventional commits (e.g., `feat:`, `fix:`, `docs:`)
6. **Push** Push your branch and open a Pull Request against `main`

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