# GitHub and Vercel deployment

Bolsonópolis is a static Vite application. Vercel serves the compiled assets; multiplayer continues to use PeerJS signalling and direct WebRTC/TURN rather than a Vercel game server.

## Pre-deployment gate

Run locally:

```bash
npm ci
npm run ci
npm audit
```

Do not promote the first production deployment without explicit approval.

## Connect GitHub through the Vercel interface

1. Create or select the GitHub repository and push `main`.
2. In Vercel, choose **Add New → Project**.
3. Install/authorize the Vercel GitHub App for only the required repository when possible.
4. Import the repository.
5. Confirm the framework preset is **Vite**.
6. Confirm the install command is `npm ci`, the build command is `npm run ci`, and the output directory is `dist`.
7. Leave the root directory at the repository root.
8. Add optional TURN variables for Preview and Production as appropriate.
9. Create a preview deployment first and complete the validation checklist below.

`vercel.json` is the deploy-side safety gate. Vercel executes lint, strict types, unit tests, and the production build before it can publish the candidate. This does not assume that Vercel waits for GitHub Actions.

## Git branch environments

In **Project Settings → Git**:

- set **Production Branch** to `main`;
- leave automatic deployments enabled for temporary branches so they receive Preview deployments;
- do not configure another permanent environment branch;
- keep comments/checks from the Git integration enabled if desired.

GitHub Actions independently runs for pushes to `main` and pull requests targeting `main`. Protect `main` with the CI status check in GitHub. Vercel and GitHub therefore validate the same scripts independently.

## Environment variables

Optional variables:

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `VITE_TURN_URL` | TURN/TURNS relay URL | Public bundle |
| `VITE_TURN_USERNAME` | Relay username | Public bundle |
| `VITE_TURN_CREDENTIAL` | Relay credential | Public bundle |

Because Vite exposes `VITE_*` values to every browser, use ephemeral and application-restricted TURN credentials. Do not store general infrastructure passwords, long-lived API secrets, or private keys in these values.

Use separate credentials for Preview and Production when the TURN provider supports it. Redeploy after changing build-time variables.

## Preview validation

Validate the generated HTTPS preview before production:

1. Load home, lobby, game, rules, settings, and reference views without console errors.
2. Check 1440, 1024, 768, and 390 CSS-pixel widths.
3. Inspect property levels `0–4`, architecture variants, labels, shadows, and the player-focus camera.
4. Create a host in one browser and join from an isolated profile/browser.
5. Exercise purchase, decline/auction, rent, build, trade, mortgage, debt, and end-game paths.
6. Disconnect the active guest and verify pause/resume with the same session token.
7. Interrupt the host and verify the guest does not mutate state while reconnecting.
8. Test from distinct networks when possible, both without and with configured TURN.
9. Observe frame rate and memory while rotating/zooming and after multiple matches.

## Production promotion

After explicit approval:

1. Confirm the approved commit is on `main`.
2. Confirm GitHub CI passed for that commit.
3. Confirm the Vercel deployment log shows `npm run ci` passing.
4. Promote the already validated preview or allow the `main` deployment to complete.
5. Smoke-test the production URL and one P2P room.

Never use `npx vercel --prod` as an undocumented bypass around the connected Git workflow.

## Failure and rollback

If a build fails, Vercel does not replace the active deployment because `npm run ci` exits non-zero.

If a valid build has a runtime regression:

1. In Vercel **Deployments**, open the last known-good production deployment.
2. Use **Promote to Production** or **Redeploy** according to the current Vercel interface.
3. Revert the faulty commit on `main` with a new commit; do not rewrite shared history.
4. Wait for GitHub CI and Vercel validation.
5. Re-test storage migration and P2P compatibility when the rollback crosses a protocol change.

Static deployment rollback does not restore browser-local checkpoints. The current storage migration preserves old keys, but rooms using the former PeerJS prefix cannot connect to the renamed build.

## Operational limitations

- Vercel hosts no authoritative server, room registry, database, or checkpoint backup.
- PeerJS Cloud signalling and third-party ICE availability are outside this deployment's SLA.
- TURN improves reachability but does not make the host trustworthy or enable host migration.
- Source maps are generated for diagnostics and may expose readable application structure; review this policy before handling proprietary logic.
- Google Fonts are external and fall back locally when unavailable.
