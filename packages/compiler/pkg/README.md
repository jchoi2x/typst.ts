# typst-ts-web-compiler

The compiler can run in browser. See documentation for details:

- [Get Started](https://myriad-dreamin.github.io/typst.ts/cookery/get-started.html)
- [Compiler interfaces](https://myriad-dreamin.github.io/typst.ts/cookery/guide/compilers.html)

It can also runs in node.js, but limits its access to operating system. Therefore, I'd suggest to use [typst.node](https://github.com/Myriad-Dreamin/typst.ts/tree/main/packages/typst.node) for fully accessing to operating system.

## Wasm size and Cloudflare Workers

The compiled `typst_ts_web_compiler_bg.wasm` embeds a full Typst toolchain (layout, PDF export, optional SVG/IDE helpers, etc.). **Expect on the order of ~20 MiB uncompressed** for the default `web,misc` build after `wasm-opt`—there is no practical way to cut that roughly in half without removing major compiler capabilities upstream.

- **If you need “under 10 MiB” for delivery:** serve the same `.wasm` with **gzip** or **brotli** (typical gzip size is **~8 MiB** for this artifact). Many limits (CDN, browser transfer) care about compressed bytes; the raw file will stay large.
- **Prefer loading Wasm at runtime** from R2, a static route, or a URL (see `createTypstCompiler` / `getModule`), instead of bundling the `.wasm` into the Worker script if your platform caps bundle size.
- Release builds use **`wasm-opt -Oz --converge`** (see `[package.metadata.wasm-pack.profile.release]` in `Cargo.toml`) plus, in `package.json`, **`CARGO_PROFILE_RELEASE_*`** so `cargo` uses size-oriented settings (`opt-level=z`, fat LTO, `panic=abort`) for that `wasm-pack` invocation only. The `--converge` pass runs optimizations until the binary stops shrinking.
- **`npm run build:pdf-only`** builds with `--features web,pdf` (no SVG/incremental/AST/semantic-token helpers). That saves only a small amount versus full `misc`; default `npm run build` keeps **vector + PDF** and other `misc` exports used by `@jchoi2x/typst.ts` in the wild.
- You still need **`wasm-opt` on your `PATH`** when running `wasm-pack` (e.g. `brew install binaryen`).
