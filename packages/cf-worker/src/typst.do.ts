import { DurableObject } from 'cloudflare:workers';
import SAMPLE_TYP from './sample_type.typ';
import { Hono } from 'hono';
import { TypstCompilerManager } from './typst-compiler-manager';

export * from './typst-compiler-manager';

export class TypstCompilerDO extends DurableObject<Env> {
  private readonly manager: TypstCompilerManager;
  private readonly app = new Hono<{ Bindings: Env }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.manager = new TypstCompilerManager();
    this.initServer();
  }

  private initServer(): void {
    this.app.get('/compile-pdf', async (c) => {
      try {
        return await this.manager.compilePdfResponse(10, SAMPLE_TYP);
      } catch (error) {
        console.error('Error compiling PDF:', error);
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ ok: false, error: message }, { status: 500 });
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
