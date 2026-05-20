# Frontend apps

Decoupled frontend apps for the headless WordPress setup live here. Scaffold a new one with:

```bash
bash scripts/scaffold-frontend.sh my-app
```

Each scaffolded app is self-contained: its own `package.json`, `.env.local`, and dependencies under `node_modules/` (gitignored at repo root).

See `docs/headless-wordpress/README.md` for the end-to-end setup.
