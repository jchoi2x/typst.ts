# Publishing & installing from GitHub Packages (`npm.pkg.github.com`)

This fork is configured so **`@jchoi2x/*` packages use GitHub’s npm registry**, not `registry.npmjs.org`.

## Requirements

1. **GitHub account or org name must match the scope**  
   Scoped packages are `@jchoi2x/...`. GitHub Packages ties them to the **`jchoi2x`** user or organization on GitHub.

2. **`repository` in `package.json`**  
   For `GITHUB_TOKEN` publishes from Actions, the package’s `repository` URL should point at **your** GitHub repo (e.g. `https://github.com/jchoi2x/typst.ts`). Published packages in this fork already set `repository` / `bugs` / `homepage` accordingly.

## GitHub repository secrets checklist

If this repo was forked from upstream and still has an **`NPM_TOKEN`** (or other npmjs-only) secret:

1. Open **GitHub → Repository → Settings → Secrets and variables → Actions**.
2. **Remove** `NPM_TOKEN` if you only publish to GitHub Packages (this fork uses `GITHUB_TOKEN` / `NODE_AUTH_TOKEN` with `npm.pkg.github.com`).
3. You cannot delete secrets via git; it must be done in the GitHub UI.

## Repo configuration

- **Root `.npmrc`** — sets `@jchoi2x:registry=https://npm.pkg.github.com`.
- **`publishConfig.registry`** — set to `https://npm.pkg.github.com` on packages that are published.
- **`.github/workflows/release-node.yaml`** — `publish` job uses `actions/setup-node` with `registry-url: https://npm.pkg.github.com`, `scope: '@jchoi2x'`, and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, plus `permissions.packages: write`.

## Publish locally (optional)

```bash
export NODE_AUTH_TOKEN=ghp_xxx   # classic PAT with write:packages, or fine-grained with Packages: Write
npm publish --access public
# run from each package directory, or use your turbo/publish scripts
```

## Install `@jchoi2x/*` from GitHub (consumers)

In the project that **installs** these packages, add `.npmrc` (see **`.npmrc.example`** in this repo for a copy-paste template):

```ini
@jchoi2x:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then use a PAT with **`read:packages`** (and `repo` if the packages are in a private repo).

```bash
export NODE_AUTH_TOKEN=ghp_xxx
npm install @jchoi2x/typst.ts
```

## Unscoped packages

GitHub’s npm registry is aimed at **scoped** packages (`@owner/name`). The **`hexo-renderer-typst`** package is currently **unscoped**; publishing it to GitHub Packages may require renaming to something like `@jchoi2x/hexo-renderer-typst` or keeping that one on npmjs.

## npm provenance

`--provenance` is oriented toward **npmjs.org**. It was removed from the node-compiler publish script for GitHub Packages compatibility.
