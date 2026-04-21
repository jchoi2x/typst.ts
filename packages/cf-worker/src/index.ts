import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();



let probePromise: Promise<Record<string, unknown>> | null = null;

async function probeTypstPackages(): Promise<Record<string, unknown>> {
  if (!probePromise) {
    probePromise = (async () => {
      const compiler = await import('@jchoi2x/typst-ts-web-compiler');
      const renderer = await import('@jchoi2x/typst-ts-renderer');
      return {
        compilerExportCount: Object.keys(compiler).length,
        rendererExportCount: Object.keys(renderer).length,
        hasCompilerDefaultInit: typeof compiler.default === 'function',
        hasRendererDefaultInit: typeof renderer.default === 'function',
      };
    })();
  }
  return probePromise;
}


app.get('/', (c) => c.json({
  service: 'typst-cf-worker',
  message: 'Cloudflare Worker is up.',
  hint: 'GET /pdf for a sample PDF. GET /probe to verify wasm npm packages import.',
}));
app.get('/probe', async (c) => {
  try {
    const probe = await probeTypstPackages();
    return c.json({
      ok: true,
      packages: ['@jchoi2x/typst-ts-web-compiler', '@jchoi2x/typst-ts-renderer'],
      probe,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, { status: 500 });
  }
});

app.get('/pdf', async (c) => {
  try {
    const id = c.env.TYPST_COMPILER_DO.idFromName('singleton');
    const stub = c.env.TYPST_COMPILER_DO.get(id);
    const doUrl = new URL(c.req.url);
    doUrl.pathname = '/compile-pdf';
    const response = await stub.fetch(doUrl.toString(), { method: 'GET' });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, { status: 500 });
  }
});

app.notFound((c) => c.json({ ok: false, error: 'Not Found' }, { status: 404 }));

export default app;

export * from './typst.do';
