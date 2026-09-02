# GitHub Pages operations

Use the canonical [Pages deployment guide](./pages-deployment.md) for the complete operational
procedure.

- **First-run:** select GitHub Actions as the Pages source, restrict the `github-pages` environment to
  `main`, and retain the successful workflow URL and commit SHA.
- **Rollback:** merge a normal revert to the last known-good tree; never rewrite `main` or upload a
  hand-built artifact.
- **Smoke evidence:** the workflow installs Chromium and runs the Playwright root and deep-link reload
  suite. Preserve its screenshot, trace, and video output when a check fails.
