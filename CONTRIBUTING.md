# Contributing to CC-WP-Template

Thank you for your interest in contributing!

## How to Contribute

1. **Fork** the repository
2. **Create a branch** for your feature or fix (`git checkout -b feature/my-feature`)
3. **Make your changes** following the coding standards below
4. **Test** your changes with the local Docker environment (`./wordpress-local.sh start`)
5. **Commit** with a descriptive message using conventional commits (e.g., `feat:`, `fix:`, `docs:`)
6. **Open a Pull Request** against `main`

## Coding Standards

- Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- Escape all output (`esc_html()`, `esc_url()`, `esc_attr()`)
- Sanitize all input (`sanitize_text_field()`, etc.)
- Use WordPress APIs and functions where available

## Development Setup

See [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) for Docker-based local environment setup.

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
