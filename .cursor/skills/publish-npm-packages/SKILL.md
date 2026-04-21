---
name: publish-npm-packages
description: Bumps unified workspace semver from git history, runs bump-packages and turbo publish:lib to GitHub npm registry, then reports per-package results in a table. Use when publishing @jchoi2x packages from this monorepo, cutting a release, or running the npm publish workflow after merges.
---

# Publish npm packages (typst.ts monorepo)

## Scope

- **Version source of truth**: Root `package.json` `version` field. All `packages/**` and `projects/**` package versions and `Cargo.toml` crate version must stay aligned; `scripts/bump_version.py` enforces that in one step.
- **Publish command**: From repo root, `bun run publish:lib` runs `turbo run prepublish publish:lib --filter=./packages/*` (only **packages/**, not **projects/**).
- **Registry**: Packages use `publishConfig.registry` → `https://npm.pkg.github.com` where set.

## Preconditions

- Run from monorepo root; `bun` and `python3` available (`bump-packages` calls `python scripts/bump_version.py`).
- npm auth for GitHub Packages (`~/.npmrc` or env such as `NODE_AUTH_TOKEN` with `registry=https://npm.pkg.github.com` / scope mapping as per GitHub docs). Without auth, publish steps fail with auth errors—capture those in the summary table.
- Working tree: bump touches many files (including `Cargo.toml`). User may want a clean branch and a follow-up commit; the skill does not require git commit unless the user asks.

## 1. Read current version

- Parse `"version"` from root `package.json` → `current` (must match `x.y.z`; the bump script rejects versions whose `split('.')` length is not 3).

## 2. Baseline commit (“last version bump”)

Find the commit that introduced `current` into root `package.json`:

```bash
git log -1 --format=%H -S "\"version\": \"$CURRENT\"" -- package.json
```

- If this returns **empty** (rename, shallow history, etc.), treat **“commits since bump”** as unknown and default the bump kind to **patch** only; mention the uncertainty in the summary.
- Otherwise `baseline` is that commit hash. Relevant history is **`baseline..HEAD`** (exclusive of `baseline`: use commits *after* the bump commit).

## 3. Infer semver bump (default patch)

Scan **subject and body** of each commit in `baseline..HEAD` (e.g. `git log --format=%B $baseline..HEAD`).

**Precedence (highest wins):**

1. **Major** if any commit indicates a breaking change:
   - Subject matches conventional `type!:` (e.g. `feat!:`, `chore!:`), or
   - Body contains a line starting with `BREAKING CHANGE` (case-insensitive).
2. Else **minor** if any subject starts with `feat` as a conventional type (e.g. `feat:`, `feat(`).
3. Else **patch**.

If there are **no commits** after `baseline`, default **patch** (same as “only chore/docs”).

**User override**: If the user specifies `major`, `minor`, or `patch`, use that instead of the inferred bump.

## 4. Compute `new` version

Parse `current` as integers `MAJOR.MINOR.PATCH` and apply:

| Kind  | Rule                                      |
|-------|-------------------------------------------|
| patch | `PATCH + 1`                               |
| minor | `MINOR + 1`, `PATCH = 0`                  |
| major | `MAJOR + 1`, `MINOR = 0`, `PATCH = 0`     |

## 5. Apply version bump

From repo root:

```bash
bun run bump-packages "$CURRENT" "$NEW"
```

This runs `python scripts/bump_version.py` and updates `Cargo.toml`, root `package.json`, and every `packages/**/package.json` and `projects/**/package.json` using the `"version": "<ver>"` pattern.

**Sanity check**: Spot-check that root and a few packages show `"version": "$NEW"`.

## 6. Publish

Capture **full stdout and stderr** (e.g. `tee` to a file):

```bash
bun run publish:lib 2>&1 | tee publish-lib.log
```

Note the final exit code. Optional: if available, `turbo run ... --summarize` may emit a run summary (Turbo 1.x+); use project’s supported flags without breaking the pipeline.

### Repo-specific caveat

Some `publish:lib` scripts append `|| exit 0`, so **npm publish can fail while the process still exits 0**. For a trustworthy table, map each package’s log lines for `npm publish` / `ERR!` / `404` / `403` and, when unclear, suggest verifying versions on the registry or re-running `publish:dry` for suspect packages.

`packages/typst.node` defines `publish:lib` as **`exit 0`** (intentional no-op in this turbo graph); show it as **skipped / not published via this task** unless a separate manual `publish-gh:lib` flow is run.

## 7. Summary table (required output)

Print a **Markdown table** for the user:

| Package | Version | Status | Error / notes |
|---------|---------|--------|----------------|
| `@scope/name` | `x.y.z` | Deployed / Failed / Skipped | Short message or empty |

Rules:

- **Version column**: the published target **`NEW`** (or “—” if skipped before publish).
- **Status**: **Deployed** only if logs show success for that package’s publish task; **Failed** if a clear error is tied to that package; **Skipped** for intentional no-ops or filtered-out workspaces.
- **Error**: First substantive npm/turbo error line(s), truncated if very long.
- Include a one-line preamble: inferred bump kind (**major/minor/patch**), `CURRENT → NEW`, and baseline commit (short SHA) or note that baseline was unknown.

## Quick reference

| Item | Location / command |
|------|---------------------|
| Bump script | `scripts/bump_version.py` |
| Workspace bump | `bun run bump-packages <old> <new>` |
| Turbo publish | `bun run publish:lib` |
| Dry run | `bun run publish:dry` |
