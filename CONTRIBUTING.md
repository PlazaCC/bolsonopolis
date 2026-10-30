# Contributing to Bolsonópolis

Technical code, comments, tests, commit messages, and documentation must be in English. Player-facing copy must remain in Brazilian Portuguese.

## Development model

This repository uses trunk-based development:

- `main` is the only permanent branch.
- Small, verified changes may be committed directly to `main` when repository permissions allow it.
- Larger or riskier work uses a short-lived branch and a pull request.
- Rebase or merge promptly; do not keep long-running integration branches.
- Never overwrite, reset, or discard another contributor's uncommitted work.

See [docs/COLLABORATION.md](docs/COLLABORATION.md) for branch and review details.

## Setup

```bash
nvm use
npm ci
npm run hooks:install
npm run dev
```

If `nvm` is unavailable, install any Node.js version allowed by `package.json`.

The hook path is repository-local and works through POSIX `sh`. Git for Windows includes a compatible shell. If the hook cannot execute on macOS/Linux, restore its executable bit with:

```bash
chmod +x .githooks/pre-push
```

## Required checks

Before requesting review:

```bash
npm run ci
npm audit
```

The pre-push hook runs only:

```bash
npm run check:push
```

Do not add builds, browsers, watch mode, network calls, or external services to `check:push`. CI is the reproducible source of truth because local hooks can be bypassed.

## Code boundaries

- Keep authoritative rules in `src/game/engine.ts`.
- Keep network validation in `src/network/protocol.ts` and transport lifecycle in `src/network/peer-session.ts`.
- Keep animation and camera state local to the 3D scene.
- Do not duplicate authoritative game state in React component state.
- Validate identity, permissions, financial values, object ownership, and replay IDs at the host boundary.
- Keep TypeScript strict and avoid `any`, ignored errors, and unchecked wire casts.
- Prefer focused modules over abstractions without a current use case.

## Tests

Rule changes require unit tests for success, rejection, idempotency, and money/deed conservation where applicable. Protocol changes require valid and malformed payload coverage. Visual changes require manual checks at the supported widths and low/high quality modes.

For P2P changes, test with isolated browser profiles and include:

- initial join and full snapshot;
- invalid or forged identity;
- active-player disconnect and resume;
- host interruption;
- background/suspended tab recovery;
- direct connectivity and optional TURN where available.

## Editorial changes

For every factual reference:

1. Use a primary official source.
2. Record the institution, document type, stable URL, access date, and limited context.
3. State whether it is a decision, report, allegation, investigation, or clarification.
4. Put the satirical fictional consequence in a separate field.
5. Avoid praise, campaign biography, generic insults, and disrespect toward victims.

## Pull requests

Keep pull requests small and describe:

- player-visible behavior;
- authoritative or protocol impact;
- tests and manual evidence;
- migration or compatibility concerns;
- deployment risk and rollback path.

Do not publish or promote the first production deployment without explicit approval.
