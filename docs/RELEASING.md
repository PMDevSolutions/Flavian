# Releasing

Versioning is automated by [release-please](https://github.com/googleapis/release-please).
Releases are driven by [Conventional Commits](https://www.conventionalcommits.org/) — see
[CONTRIBUTING.md](../CONTRIBUTING.md#commit-message-format) for the commit format.

## How a release happens

1. Contributors merge PRs to `main` with Conventional Commit messages
   (`feat:`, `fix:`, `docs:`, `chore:`, … with optional `!` or `BREAKING CHANGE:` footer).
2. On every push to `main`, the `release-please` workflow
   ([`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml))
   parses commits since the last tag and either opens or updates a single
   **Release PR** titled `chore(main): release X.Y.Z`.
3. The Release PR contains:
   - the next semver bump in `.release-please-manifest.json`, and
   - a generated `CHANGELOG.md` entry grouped by section (Added / Fixed / Changed).
4. A maintainer reviews and merges the Release PR.
5. release-please creates the `vX.Y.Z` git tag and a **draft** GitHub Release with
   the changelog entry as the release body (`draft` and `force-tag-creation` in
   `release-please-config.json`; the tag is created eagerly so release-please can
   find the previous release next time).
6. The same workflow run then calls the **GUI Release Build** workflow
   ([`.github/workflows/gui-release.yml`](../.github/workflows/gui-release.yml))
   with that tag; it builds the desktop installers (DMG for Apple silicon and
   Intel, NSIS EXE, AppImage), smoke-tests each, attaches them to the draft and
   publishes the Release. Draft first because this repository's releases are
   immutable once published, so nothing can be attached afterwards; called rather
   than triggered by the release event because the Release is created with
   `GITHUB_TOKEN`, and GitHub never starts a workflow for an event that token
   created (issue #189).
7. If a platform fails, the draft stays unpublished. Fix the cause and run
   `gh workflow run gui-release.yml -f tag=vX.Y.Z`: it attaches the installers and
   publishes. A tag whose release is already published is refused. A release made
   by hand must be created as a draft on an existing tag for the same reason.

The Release PR is the human gate: no tag is created until it is merged.

## Version bump rules

| Commit type            | Bump   |
| ---------------------- | ------ |
| `fix:`                 | patch  |
| `feat:`                | minor  |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | major  |
| `docs:`, `chore:`, `refactor:`, `test:`, `build:`, `ci:`, `style:` | none (hidden from changelog) |

Section mapping is defined in [`release-please-config.json`](../release-please-config.json).

## Baseline (historical)

The manifest was originally seeded at `1.1.0`, with a matching `v1.1.0` git tag on
`main` to give release-please a clean starting point for changelog generation.
That baseline is long established — the manifest now tracks the current release and
both `v1.0.0` and `v1.1.0` tags exist — so no action is needed here for normal
releases.

## Overrides

- **Skip a release for an isolated commit** — use a type that is hidden
  (`chore:`, `docs:`, `ci:`, etc.).
- **Force a specific version** — add a `Release-As: X.Y.Z` footer to any commit
  on `main`. release-please will use that version on its next run.
- **Pre-releases** — prefix with `feat:` / `fix:` and set the manifest version
  to a pre-release identifier (e.g. `1.2.0-beta.0`); release-please will
  continue the pre-release track.

## Commit message linting

PRs are checked by [`.github/workflows/commitlint.yml`](../.github/workflows/commitlint.yml)
using `@commitlint/config-conventional`. Each commit on the PR branch must
conform to the Conventional Commits format or the check will fail. When a PR is
merged with **Squash and merge**, ensure the squashed commit subject is also a
valid Conventional Commit — that subject is what release-please reads.

## Themes

The bundled `themes/flavian-shop/` scaffold maintains its own `Version:`
header independent of the repository version: it is intended to be copied,
renamed, and customised by consumers, and its version should track the
downstream theme rather than this template. release-please does **not** touch
theme `style.css` headers.

## Files involved

- `release-please-config.json` — section mapping, release type, package config,
  and the `extra-files` entries that mirror the version into both `package.json`
  and `packages/gui/package.json`.
- `.release-please-manifest.json` — current version state.
- `package.json` (and `packages/gui/package.json`) — `version` field is kept in
  sync with the manifest by release-please; never hand-edited.
- `.github/workflows/release-please.yml` — opens / updates the Release PR,
  tags on merge, and calls `gui-release.yml` for the installers.
- `.github/workflows/gui-release.yml` — reusable workflow that builds the GUI
  installers and attaches them to a Release (also runnable by hand with a tag).
- `.github/workflows/commitlint.yml` — lints PR commit messages.
- `.commitlintrc.json` — commitlint ruleset.
- `CHANGELOG.md` — generated; existing `[1.0.0]` entry is preserved.
