# Collaboration workflow

## Trunk-based development

`main` is the single permanent branch and should remain releasable. Use direct commits only for small, well-understood changes that already pass local checks. Use a short-lived branch for changes that need review, visual comparison, migration, or coordinated testing.

Suggested branch names:

```text
feat/camera-focus
fix/reconnect-token
docs/vercel-runbook
```

Delete temporary branches after merge. Do not create permanent `develop`, `release`, or environment branches; Vercel deployment environments are selected from Git branches and the production branch configuration.

## Safe update sequence

1. Inspect `git status` before editing.
2. Preserve unfamiliar or uncommitted changes.
3. Update from `main` without destructive resets.
4. Keep the change narrowly scoped.
5. Run `npm run check:push` while iterating.
6. Run `npm run ci` before merge or direct push.
7. Push and require the GitHub `CI / Lint, types, tests and build` check.

## Versioned hook

Install once per clone:

```bash
npm run hooks:install
```

This sets:

```text
core.hooksPath=.githooks
```

The `pre-push` hook invokes `npm run check:push` and blocks the push when type checking or unit tests fail. It is non-interactive and does not start a browser, build the application, or call external services.

Platform notes:

- macOS/Linux: preserve the executable bit on `.githooks/pre-push`.
- Windows: use Git for Windows, which executes the shell hook through its bundled `sh`.
- GUI clients: verify that the client honors `core.hooksPath`; CI still protects the remote when it does not.
- Emergency bypasses such as `--no-verify` do not bypass GitHub branch protection or Vercel's own `npm run ci` build.

## GitHub repository settings

After the first push, protect `main` in **Settings → Branches** or a repository ruleset:

- require the CI status check;
- require the branch to be up to date when the repository's merge volume warrants it;
- block force pushes and deletion;
- optionally require a pull request for non-trivial changes;
- do not require deployment checks that are unavailable on the selected Vercel plan.

Grant GitHub Actions only read access by default. `.github/workflows/ci.yml` explicitly sets `contents: read` and uses concurrency cancellation for superseded runs.

## Review checklist

- Authoritative state changes occur only in the reducer.
- Guest messages are runtime-validated and tied to connection identity.
- Financial actions reject negative, non-integer, unsafe, and duplicate values.
- Repeated action IDs are idempotent.
- Checkpoint changes remain backward-compatible or document a deliberate break.
- Player-facing text is Portuguese; technical material is English.
- Factual satire preserves source type and separates fiction.
- UI changes remain keyboard accessible and responsive.
- Performance-sensitive Three.js objects reuse geometry/material patterns and avoid per-frame React state.
