# Performance Lab

The Performance Lab is a private, reproducible browser benchmark for the comparison table. It is not
part of the Demo, GitHub Pages artifact, or published npm package, and ordinary `pnpm test` runs never
execute its timing matrix.

## Run locally

Install Chromium once, then run the production Vite host and the full catalog:

```bash
pnpm exec playwright install chromium
pnpm run perf:lab
```

The default JSON artifact is `.performance-lab/results/performance-lab.v1.json`. Override the deterministic
seed or output path when reproducing a run:

```bash
pnpm run perf:lab -- --seed 20260902 --output .performance-lab/results/reproduction.json
```

Use `pnpm run perf:lab:quick` only to validate the production host, browser protocol, real ARIA table, and
semantic oracle. It is not a performance result.

## V1 catalog and protocol

The checked-in manifest fixes seed `20260902`, three version profiles (2, 3, and 8 versions), and seven
adversarial cases: empty data, null/missing/undefined values, a 10,240-character string, depth 20, width
1,000, keyed presence/reorder, and a 1,024-item keyed array. The generator validates every keyed identity
as a unique non-blank string. The host rebuilds each fixture from its seed inside a measured browser-event
transaction; the Node runner sends only the case/profile/seed descriptor and drives user operations. A pure
oracle exercises the package's public row builder, search filter, and difference filter before the separate
ARIA DOM oracle checks the committed table.

Each full run uses two warmups and seven recorded samples. Scenario order rotates by Latin rotation on each
round. A sample ends only after React commits, the semantic oracle checks the real ARIA table, and two
consecutive `requestAnimationFrame` callbacks complete. The keyed-presence case also records global search,
only-differences, expand/collapse, node search, and controlled-expansion operations with raw duration and
row/cell evidence. The depth-20, width-1,000, keyed-presence, and 1,024-item keyed pressure profiles retain
seven raw samples and an R-7 summary for every operation. Protocol timeouts, stale tokens, browser errors,
and partial results are explicit; they are not converted to timing values. R-7 summaries use linear
interpolation and report finite min, median, p95, and max values with no pass/fail threshold.

Long-task telemetry is captured by default and can be disabled with `--no-longtask`; Chromium heap telemetry
remains opt-in (`--heap`) because availability and overhead vary by host. The schema records the pnpm/browser
runtime, viewport, device scale factor, headless mode, and separate raw/gzip/brotli partitions for the public
library, Demo, and private host bundles. Build, preview, navigation, protocol, measurement, and report failures
are written atomically as schema-valid partial evidence while retaining successfully collected scenarios.
The private runner exposes injectable catalog, environment, measurement, summarize, and report stages so
failure-path checks can prove the same state machine and exact failure category without altering production
fixtures or running the full timing matrix.

## Scheduled operation

`.github/workflows/performance-lab.yml` runs each Monday at 03:17 UTC and supports a main-guarded manual run.
It installs Chromium only, does not cache browser binaries, has read-only repository permission, never
publishes or deploys, and uploads the JSON evidence for 30 days. Concurrency is serialized without cancelling
an older run. The 45-minute job limit is an operational guard, not a benchmark threshold.

Compare artifacts only when seed, manifest version, commit, browser, OS, CPU, memory, and bundle metadata are
understood. Host noise can move timings; this lab records evidence and trends but does not enforce release
budgets.
