# Typst.ts

This package is a fork of [Typst.ts](https://github.com/Myriad-Dreamin/typst.ts), optimized to run in Cloudflare Workers.

Usage:

```typescript
import { $typst } from '@jchoi2x/typst.ts';
console.log(
  (
    await $typst.svg({
      mainContent: 'Hello, typst!',
    })
  ).length,
);
// :-> 7317
```

See [Typst.ts](https://github.com/Myriad-Dreamin/typst.ts) and documentation for details:

- [Get Started](https://myriad-dreamin.github.io/typst.ts/cookery/get-started.html)
- [Compiler interfaces](https://myriad-dreamin.github.io/typst.ts/cookery/guide/compilers.html)
