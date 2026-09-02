# GitHub Pages deployment

The public Demo is deployed to `https://xilovesyu.github.io/comparison-table/` by
`.github/workflows/pages.yml`. The workflow accepts a push to `main` or an explicit
`workflow_dispatch`, and every build, deploy, and smoke job independently rejects non-`main` refs.
It does not publish npm packages.

## First-run setup

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open **Settings → Environments → github-pages** and keep the deployment branch policy restricted
   to `main`.
4. Merge a verified change to `main`, or dispatch **Deploy Demo to GitHub Pages** while viewing
   `main`.
5. Confirm that build, deploy, and the Chromium Playwright smoke job all succeed. Record the workflow
   run URL and deployed commit SHA as release evidence.

The build uses the dedicated `/comparison-table/` Vite base, validates that `apps/demo/dist` contains
only `index.html` and generated `assets/`, and uploads that directory as the Pages artifact. Source
maps, dotfiles, `.env` files, `.npmrc`, workspace sources, and root-level files other than
`index.html` are rejected before upload.

## Post-deployment smoke

The smoke job receives the deployment action's `page_url` as `PAGES_URL`, installs Chromium without
caching browser binaries, and reloads the root plus these stable URLs:

- `#example-keyed-array`
- `#example-container-summary`
- `#example-advanced-configuration`

For each route, Playwright verifies the example heading, current navigation item, recursive comparison
region, asset responses, browser console, and page errors. Screenshots, traces, and videos are retained
on failure by `playwright.config.ts`.

To repeat the smoke against an existing live deployment without deploying, set `PAGES_URL` to the
HTTPS Pages root and run:

```bash
pnpm exec playwright install chromium
PAGES_URL=https://xilovesyu.github.io/comparison-table/ pnpm run test:pages-smoke
```

The configuration intentionally rejects an empty URL, `localhost`, `127.0.0.1`, and non-HTTPS URLs so
local output cannot be mistaken for production evidence.

## Rollback

1. Identify the last known-good commit and its successful Pages workflow run.
2. Revert the faulty `main` commit with a normal reviewable revert; do not rewrite `main` history.
3. Merge the revert. The normal main-only workflow rebuilds, deploys, and smoke-tests that restored
   tree.
4. Verify the live root and three deep links, then record both the revert SHA and successful workflow
   URL.

If deployment is unavailable because of a GitHub Pages service or environment-policy failure, keep
the failing run and logs as evidence. Do not bypass the environment or manually upload an unverified
artifact.
