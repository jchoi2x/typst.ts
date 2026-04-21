# `@jchoi2x/typst-ts-node-compiler`

# Usage

Fork / packages: [github.com/jchoi2x/typst.ts](https://github.com/jchoi2x/typst.ts).  
Upstream cookbook (may differ slightly): [all-in-one Node guide](https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one-node.html).

## Support matrix

### Operating Systems

|                  | node14 | node16 | node18 |
| ---------------- | ------ | ------ | ------ |
| Windows x64      | ✓      | ✓      | ✓      |
| Windows x32      | ✓      | ✓      | ✓      |
| Windows arm64    | ✓      | ✓      | ✓      |
| macOS x64        | ✓      | ✓      | ✓      |
| macOS arm64      | ✓      | ✓      | ✓      |
| Linux x64 gnu    | ✓      | ✓      | ✓      |
| Linux x64 musl   | ✓      | ✓      | ✓      |
| Linux arm gnu    | ✓      | ✓      | ✓      |
| Linux arm64 gnu  | ✓      | ✓      | ✓      |
| Linux arm64 musl | ✓      | ✓      | ✓      |
| Android arm64    | ✓      | ✓      | ✓      |
| Android armv7    | ✓      | ✓      | ✓      |
| FreeBSD x64      | ✓      | ✓      | ✓      |

## Ability

### Build

After `bun run build/npm run build` command, you can see `typst-ts-node-compiler.[darwin|win32|linux].node` file in project root. This is the native addon built from [lib.rs](./src/lib.rs).

### Test

With [ava](https://github.com/avajs/ava), run `bun run test/npm run test` to testing native addon. You can also switch to another testing framework if you want.

### CI

With GitHub Actions, each commit and pull request will be built and tested automatically in [`node@14`, `node@16`, `@node18`] x [`macOS`, `Linux`, `Windows`] matrix. You will never be afraid of the native addon broken in these platforms.

### Release

Release native package is very difficult in old days. Native packages may ask developers who use it to install `build toolchain` like `gcc/llvm`, `node-gyp` or something more.

With `GitHub actions`, we can easily prebuild a `binary` for major platforms. And with `N-API`, we should never be afraid of **ABI Compatible**.

The other problem is how to deliver prebuild `binary` to users. Downloading it in `postinstall` script is a common way that most packages do it right now. The problem with this solution is it introduced many other packages to download binary that has not been used by `runtime codes`. The other problem is some users may not easily download the binary from `GitHub/CDN` if they are behind a private network (But in most cases, they have a private NPM mirror).

In this package, we choose a better way to solve this problem. We release different `npm packages` for different platforms. And add it to `optionalDependencies` before releasing the `Major` package to npm.

`NPM` will choose which native package should download from `registry` automatically. You can see [npm](./npm) dir for details. And you can also run `bun add @jchoi2x/typst-ts-node-compiler` to see how it works.

## Develop requirements

- Install the latest `Rust`
- Install `Node.js@10+` which fully supported `Node-API`
- Install `bun`

## Test in local

- bun install
- bun run build
- bun run test

And you will see:

```bash
$ ava --verbose

  ✔ sync function from native code
  ✔ sleep function from native code (201ms)
  ─

  2 tests passed
✨  Done in 1.12s.
```

## Release package

This fork publishes **`@jchoi2x/*`** to **GitHub Packages** (`npm.pkg.github.com`), not npmjs.

- **CI**: `.github/workflows/release-node.yaml` uses `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `registry-url: https://npm.pkg.github.com`. No `NPM_TOKEN` is required.
- **Local publish**: set `NODE_AUTH_TOKEN` to a PAT with **`write:packages`**, then `npm publish` from the package directory. See **`docs/github-packages.md`** and root **`.npmrc.example`**.
- If the repo still has an unused **`NPM_TOKEN`** secret from upstream, remove it under **GitHub → Settings → Secrets and variables → Actions** (not editable from git).

When you want to release the package:

```
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]

git push
```

GitHub actions will do the rest job for you.
