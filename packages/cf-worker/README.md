# typst-cf-worker

Cloudflare Worker package that imports both Typst wasm npm packages:

- `@jchoi2x/typst-ts-web-compiler`
- `@jchoi2x/typst-ts-renderer`

## Local run

From repo root:

```bash
bun install --frozen-lockfile
bun --cwd packages/cf-worker run dev
```

Probe routes:

- `GET /` for service info
- `GET /probe` to verify both wasm packages are importable

## Fixture sources

Fixtures copied from:

- `fuzzers/corpora/math/long-clip-arrow.typ`
- `fuzzers/corpora/visualize/gradient-text-perf.typ`
