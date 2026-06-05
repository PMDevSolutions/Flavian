# Headless WordPress

Run WordPress as a content API (REST + WPGraphQL) and consume it from a decoupled frontend. The MVP ships a Next.js 14 (App Router) scaffold; Nuxt and Astro are tracked as follow-ups.

## What's in the box

| Piece | Path | Purpose |
|---|---|---|
| Installer script | `scripts/wordpress-install/setup-headless.sh` | Installs WPGraphQL, sets pretty permalinks, generates the preview secret, prints the values your frontend needs. |
| Compose profile | `docker-compose.yml` → `headless-installer` | Wraps the installer in a one-shot container. Run with `docker compose --profile headless up headless-installer`. |
| Mu-plugin | `mu-plugins/flavian-headless.php` | CORS, preview-URL rewriting, REST hardening, REST `preview_secret_match` field. Toggled by `flavian_headless_mode` option. |
| Scaffold script | `scripts/scaffold-frontend.sh` | Generates `frontend/<slug>/` from `.claude/templates/frontend/nextjs/`. |
| Smoke test | `tests/headless-e2e/` + `.github/workflows/headless-e2e.yml` | CI proof that the scaffold output, REST API, CORS allowlist, REST hardening, and WPGraphQL all work. |
| Agent | `.claude/agents/headless-developer.md` | Domain expert; invoke for headless workflows. |

## Five-minute setup

```bash
# 1. Bring up WordPress (if not already running)
docker compose up -d

# 2. Install WPGraphQL + configure headless mode
docker compose --profile headless up headless-installer
# → prints WORDPRESS_PREVIEW_SECRET and JWT secret

# 3. Scaffold a Next.js frontend
bash scripts/scaffold-frontend.sh my-app --name "My Site"

# 4. Configure and run the frontend
cd frontend/my-app
cp .env.local.example .env.local
# paste the values from step 2 into .env.local
pnpm install && pnpm dev
# → http://localhost:3000
```

## How preview mode works

1. Editor clicks **Preview** on a draft in `/wp-admin`.
2. `flavian-headless.php` hooks `preview_post_link` and rewrites the URL to:
   ```
   http://localhost:3000/api/preview?secret=<hex>&id=<post-id>&slug=<slug>&type=post
   ```
3. The Next.js `/api/preview` route validates `secret` against `WORDPRESS_PREVIEW_SECRET`, confirms the post exists via `POST_BY_ID_QUERY`, then calls `draftMode().enable()` and redirects to `/posts/<slug>`.
4. The post page detects `draftMode().isEnabled` and passes `asPreview: true` to the GraphQL query, which returns the unpublished revision.
5. The `<body>` shows a "Draft mode is on" banner with an exit link to `/api/exit-preview`.

## Endpoints

- **REST**: `http://localhost:8080/wp-json/wp/v2/`
- **GraphQL**: `http://localhost:8080/graphql`
- **GraphiQL IDE**: `http://localhost:8080/wp-admin/admin.php?page=graphiql-ide`

## Smoke test

A CI smoke test (`.github/workflows/headless-e2e.yml`) guards the headless
contract on every PR that touches the mu-plugin, installer, frontend templates,
or scaffold script. It boots WordPress in Docker, runs `setup-headless.sh`, then
asserts:

- `scaffold-frontend.sh` emits a coherent Next.js consumer (file tree, valid
  `package.json`, `.env.local.example` keys, no unrendered `{{TOKENS}}`)
- the REST API responds and the `/wp/v2/users` route is hardened away
- CORS mirrors **only** the configured frontend origin — an unconfigured origin
  gets no credentialed grant, even on `/wp-json/` (the mu-plugin replaces
  WordPress core's permissive `rest_send_cors_headers()`)
- WPGraphQL answers a query
- nothing logs a PHP fatal while exercising any of it

Run it locally against a booted stack:

```bash
docker compose up -d wordpress db
docker compose exec -T wordpress wp core install --url=http://localhost:8080 \
  --title="Flavian" --admin_user=admin --admin_password=admin \
  --admin_email=admin@example.com --skip-email --allow-root
bash scripts/wordpress-install/setup-headless.sh
pnpm test:headless-e2e
```

The scaffold half (Part A) runs even without Docker; the API half (Part B)
skips cleanly with a message when the stack isn't reachable.

## Disabling headless mode

```bash
docker compose exec wordpress wp option update flavian_headless_mode 0 --allow-root
```

The mu-plugin's hooks short-circuit when the option is off, so WordPress reverts to standard behavior immediately — no plugin deactivation needed.

## Troubleshooting

See the **Error Recovery** table in `.claude/agents/headless-developer.md` for the canonical list. The three failures that cover ~90% of issues:

1. **Secret drift** between `wp_options.flavian_headless_preview_secret` and `frontend/<app>/.env.local`'s `WORDPRESS_PREVIEW_SECRET`.
2. **CORS preflight rejection** — `flavian_headless_mode` is off, or `flavian_headless_frontend_url` doesn't match the actual frontend origin.
3. **`asPreview` not propagating** — the GraphQL client must read `draftMode().isEnabled` and forward it as a variable; the query must declare `asPreview: Boolean = false`.

## Follow-ups

- Nuxt scaffold (`.claude/templates/frontend/nuxt/`)
- Astro scaffold (`.claude/templates/frontend/astro/`)
- Webhook-based ISR revalidation on post publish
