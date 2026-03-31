



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

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return Response.json({
        service: 'typst-cf-worker',
        message: 'Cloudflare Worker is up.',
        hint: 'GET /pdf for a sample PDF. GET /probe to verify wasm npm packages import.',
      });
    }

    if (url.pathname === '/probe') {
      try {
        const probe = await probeTypstPackages();
        return Response.json({
          ok: true,
          packages: ['@jchoi2x/typst-ts-web-compiler', '@jchoi2x/typst-ts-renderer'],
          probe,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ ok: false, error: message, }, { status: 500 });
      }
    }

    if (url.pathname === '/pdf') {
      try {
        const id = env.TYPST_COMPILER_DO.idFromName('singleton');
        const stub = env.TYPST_COMPILER_DO.get(id);
        const doUrl = new URL(request.url);
        doUrl.pathname = '/compile-pdf';
        return await stub.fetch(doUrl.toString(), { method: 'GET' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ ok: false, error: message }, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;


export * from './typst.do';
