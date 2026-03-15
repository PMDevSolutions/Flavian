# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **paul@pmds.info**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix or mitigation:** As soon as reasonably possible

## Security Best Practices for Users

This template includes local development credentials in `.env.example` that are **not suitable for production**. Before deploying:

1. **Change all default passwords** — Copy `.env.example` to `.env` and set strong, unique passwords
2. **Never commit `.env`** — The `.gitignore` already excludes it, but always double-check
3. **Keep WordPress updated** — Run `wp core update`, `wp plugin update --all`, and `wp theme update --all` regularly
4. **Review file permissions** — Ensure `wp-config.php` is not publicly readable
5. **Use HTTPS in production** — Always serve WordPress over TLS

## Scope

This security policy applies to the template repository itself. Vulnerabilities in WordPress core, third-party plugins, or third-party themes should be reported to their respective maintainers.
