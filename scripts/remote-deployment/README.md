# Remote Deployment Scripts

Push WordPress themes and plugins from this repository to staging and
production hosts. The scripts here are invoked by the `deployment-agent`
(see `.claude/agents/deployment-agent.md`) but are also safe to call directly.

## Layout

| Script | Purpose |
|---|---|
| `deploy.sh` | Orchestrator. Runs pre-checks → deploy → WP-CLI → notifications. |
| `pre-deploy-checks.sh` | Structure, security, PHPCS, dependency, artifact validation. |
| `ssh-deploy.sh` | Atomic rsync-over-ssh deploy with capistrano-style release dirs. |
| `git-deploy.sh` | Push current ref to a remote bare repo (post-receive hook deploys). |
| `wpcli-deploy.sh` | Runs `wp theme activate`, `core update-db`, cache flush remotely. |
| `rollback.sh` | Switch `current` symlink back to a prior release, or revert git ref. |
| `notify.sh` | Slack / Discord / generic webhook / email notifications. |
| `lib/common.sh` | Shared logging, release-id, run-id helpers. |
| `lib/config-loader.sh` | YAML config parser (PyYAML preferred, awk fallback). |

## Quick start

1. Copy a config template and fill in your environment values:

   ```bash
   cp .claude/config/deployment/staging.example.yml \
      .claude/config/deployment/staging.yml
   $EDITOR .claude/config/deployment/staging.yml
   ```

2. Plan the deploy:

   ```bash
   ./scripts/remote-deployment/deploy.sh --env staging --dry-run
   ```

3. Ship it:

   ```bash
   ./scripts/remote-deployment/deploy.sh --env staging
   ```

4. If something looks wrong, roll back:

   ```bash
   ./scripts/remote-deployment/rollback.sh --env staging
   ```

## Logs

Every run writes a structured log to
`.claude/logs/deployment/<run-id>.log`. The path is also printed at the end of
each successful deploy so it can be attached to PR comments or incident notes.

## Exit codes

All top-level scripts use the same convention:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Operational failure (check log; rollback may have run) |
| 2 | Invocation/usage error |
