# Deployment Configuration

Per-environment configuration for the remote deployment scripts in
`scripts/remote-deployment/`. The files in this directory are loaded by
`scripts/remote-deployment/lib/config-loader.sh`.

## Conventions

- `*.example.yml` — committed templates, safe to share publicly.
- `*.yml` — real environment configs, **gitignored** (see project root
  `.gitignore`). Never commit secrets.
- File name (minus the extension) is the environment name passed via
  `--env`. So `staging.yml` is selected by `--env staging`.

## Setting up an environment

```bash
cp .claude/config/deployment/staging.example.yml \
   .claude/config/deployment/staging.yml
$EDITOR .claude/config/deployment/staging.yml
```

Then verify the file parses cleanly with a dry run:

```bash
./scripts/remote-deployment/deploy.sh --env staging --dry-run
```

## Schema reference

| Key | Required for | Notes |
|---|---|---|
| `method` | all | `ssh`, `git`, or `wpcli` |
| `allow_dirty` | production safety | default false on production |
| `activate_theme` | optional | run `wp theme activate` after deploy |
| `activate_plugins` | optional | comma-separated list |
| `keep_releases` | ssh | release directories retained for rollback |
| `ssh.host` / `ssh.user` / `ssh.port` / `ssh.key` | ssh | connection details |
| `remote_root` | ssh | base directory; releases live under `<root>/releases/` |
| `wp_content_path` | ssh | absolute path to wp-content on the remote |
| `git.remote_url` / `git.remote_branch` | git | bare repo + branch deployed |
| `git.remote_name` | git | local remote alias (default `deploy-<env>`) |
| `wp_cli.ssh` / `wp_cli.path` | wpcli or post-deploy WP-CLI | WP-CLI `--ssh` alias |
| `notify.slack_webhook` | optional | incoming webhook URL |
| `notify.discord_webhook` | optional | webhook URL |
| `notify.webhook_url` | optional | generic JSON POST endpoint |
| `notify.email_to` / `notify.email_from` | optional | requires `mail` |

## Secrets

Real environment files contain SSH keys, webhook URLs, and host details that
must not enter version control. The repository's `.gitignore` excludes any
`*.yml` file in this directory other than `*.example.yml`. If you fork the
project, double-check the ignore rule before adding a new config.

For shared team environments, store the production config in a secrets manager
(1Password, Vault, AWS Secrets Manager) and check it out into this directory
during deploy bootstrap.
