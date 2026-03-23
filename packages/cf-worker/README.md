# typst-cf-worker

Cloudflare Worker package that imports both Typst wasm npm packages:

- `@myriaddreamin/typst-ts-web-compiler`
- `@myriaddreamin/typst-ts-renderer`

## Local run

From repo root:

```bash
yarn install --pure-lockfile
yarn workspace @myriaddreamin/typst-cf-worker dev
```

Probe routes:

- `GET /` for service info
- `GET /probe` to verify both wasm packages are importable

## Fixture sources

Fixtures copied from:

- `fuzzers/corpora/math/long-clip-arrow.typ`
- `fuzzers/corpora/visualize/gradient-text-perf.typ`
