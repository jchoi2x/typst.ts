import wasmModule from '@jchoi2x/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm';

import { createTypstCompiler } from '@jchoi2x/typst.ts';
import { CompileFormatEnum, type TypstCompiler } from '@jchoi2x/typst.ts/compiler';
import { MemoryAccessModel } from '@jchoi2x/typst.ts/fs/memory';
import { withAccessModel, withPackageRegistry } from '@jchoi2x/typst.ts/options.init';
import { WorkerPackageRegistry, packageKey, type PreviewPackageSpec } from "@jchoi2x/typst.ts/src/fs/package.worker.mjs";
import { DurableObject } from "cloudflare:workers";
import { fetchFontBytes } from "./lib/fetch-font-bytes";
import { parseMissingFontFamilies } from "./lib/parse-missing-font-families";
import { parseMissingPreviewPackages } from './lib/parse-missing-preview-packages';
import SAMPLE_TYP  from './sample_type.typ';

/** Bundled wasm has no embedded fonts; preload bytes so PDF text renders in Workers. */
const LIBERTINUS_REGULAR =
  'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/LibertinusSerif-Regular.otf';
const LIBERTINUS_BOLD =
  'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/LibertinusSerif-Bold.otf';
const NEW_CM_REGULAR =
  'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/NewCM10-Regular.otf';
const DEJAVU_MONO_REGULAR =
  'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/DejaVuSansMono.ttf';
const RENDERCV_FONTS_API_BASE =
  'https://api.github.com/repos/rendercv/rendercv-fonts/contents/rendercv_fonts';

type CompilerRuntime = {
  compiler: TypstCompiler;
  packageRegistry: WorkerPackageRegistry;
};

export class TypstCompilerDO extends DurableObject<Env> {
  private compilerPromise: Promise<CompilerRuntime> | null = null;
  private readonly extraPreloadPackages = new Map<string, PreviewPackageSpec>();
  private readonly dynamicFontUrls = new Set<string>();
  private readonly fontFamilyUrlMap = new Map<string, string[]>();
  private readonly renderCvFamilyUrlCache = new Map<string, string[]>();
  private renderCvDirMapPromise: Promise<Map<string, string>> | null = null;
  private readonly fontBytesPromise: Promise<[Uint8Array, Uint8Array]>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.fontBytesPromise = Promise.all([
      fetchFontBytes(LIBERTINUS_REGULAR),
      fetchFontBytes(LIBERTINUS_BOLD),
    ]);
    this.loadDefaultFontFamilyMap();
    this.loadFontMapFromEnv();
  }

  private normalizeFamilyName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private setFontFamilyMapping(name: string, urls: string[]): void {
    const normalized = this.normalizeFamilyName(name);
    const filtered = urls.filter(url => url.trim().length > 0);
    if (filtered.length === 0) {
      return;
    }
    this.fontFamilyUrlMap.set(normalized, filtered);
  }

  private prioritizeFontFile(name: string): number {
    const n = name.toLowerCase();
    if (n.includes('regular') || n.includes('-400') || n.includes('roman')) {
      return 0;
    }
    if (n.includes('variable')) {
      return 1;
    }
    if (n.includes('book')) {
      return 2;
    }
    if (n.includes('bold') || n.includes('semibold')) {
      return 3;
    }
    if (n.includes('italic') || n.includes('oblique')) {
      return 4;
    }
    return 10;
  }

  private mapFamilyToRenderCvDir(family: string): string {
    const normalized = this.normalizeFamilyName(family);
    if (normalized.startsWith('font awesome 7')) {
      return 'Font Awesome 7';
    }
    return family;
  }

  private async getRenderCvDirMap(): Promise<Map<string, string>> {
    if (!this.renderCvDirMapPromise) {
      this.renderCvDirMapPromise = (async () => {
        const result = new Map<string, string>();
        const res = await fetch(RENDERCV_FONTS_API_BASE, {
          headers: {
            accept: 'application/vnd.github+json',
            'user-agent': 'typst-cf-worker',
          },
        });
        if (!res.ok) {
          return result;
        }
        const entries = (await res.json()) as Array<{ type?: string; name?: string }>;
        for (const entry of entries) {
          if (entry.type !== 'dir' || !entry.name) {
            continue;
          }
          result.set(this.normalizeFamilyName(entry.name), entry.name);
        }
        return result;
      })();
    }
    return this.renderCvDirMapPromise;
  }

  private async fetchRenderCvFontUrls(family: string): Promise<string[]> {
    const normalized = this.normalizeFamilyName(family);
    if (this.renderCvFamilyUrlCache.has(normalized)) {
      return this.renderCvFamilyUrlCache.get(normalized) ?? [];
    }

    const dirMap = await this.getRenderCvDirMap();
    const requestedDir = this.mapFamilyToRenderCvDir(family);
    const resolvedDir = dirMap.get(this.normalizeFamilyName(requestedDir)) ?? requestedDir;
    const endpoint = `${RENDERCV_FONTS_API_BASE}/${encodeURIComponent(resolvedDir)}`;
    try {
      const res = await fetch(endpoint, {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'typst-cf-worker',
        },
      });
      if (!res.ok) {
        this.renderCvFamilyUrlCache.set(normalized, []);
        return [];
      }

      const files = (await res.json()) as Array<{
        type?: string;
        name?: string;
        download_url?: string | null;
      }>;

      let candidates = files
        .filter(f => f.type === 'file' && !!f.name && !!f.download_url)
        .filter(f => /\.(ttf|otf)$/i.test(f.name!))
        .sort((a, b) => this.prioritizeFontFile(a.name!) - this.prioritizeFontFile(b.name!));

      // Select matching variants for Font Awesome families.
      if (normalized.includes('font awesome 7')) {
        if (normalized.includes('brands')) {
          candidates = candidates.filter(f => f.name!.toLowerCase().includes('brands'));
        } else if (normalized.includes('free')) {
          candidates = candidates.filter(f => f.name!.toLowerCase().includes('free'));
        }
      }

      const urls = candidates.map(f => f.download_url!) as string[];

      // Keep payload bounded while still covering common styles.
      const selected = urls.slice(0, 6);
      this.renderCvFamilyUrlCache.set(normalized, selected);
      return selected;
    } catch (error) {
      console.warn(`[TypstCompilerDO] rendercv font lookup failed for "${family}":`, error);
      this.renderCvFamilyUrlCache.set(normalized, []);
      return [];
    }
  }

  private loadDefaultFontFamilyMap(): void {
    // RenderCV advertises many families; map them to stable Worker-safe fallbacks.
    const serifFallback = [LIBERTINUS_REGULAR, NEW_CM_REGULAR];
    const sansFallback = [LIBERTINUS_REGULAR];
    const monoFallback = [DEJAVU_MONO_REGULAR];

    for (const name of [
      'Aptos',
      'Arial',
      'Arial Rounded MT',
      'Arial Unicode MS',
      'Comic Sans MS',
      'Didot',
      'EB Garamond',
      'Fontin',
      'Garamond',
      'Gentium Book Plus',
      'Georgia',
      'Gill Sans',
      'Helvetica',
      'Impact',
      'Inter',
      'Lato',
      'Libertinus Serif',
      'Lucida Sans Unicode',
      'Mukta',
      'Noto Sans',
      'Open Sans',
      'Open Sauce Sans',
      'Poppins',
      'Raleway',
      'Roboto',
      'Source Sans 3',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Ubuntu',
      'Verdana',
      'XCharter',
    ]) {
      this.setFontFamilyMapping(name, sansFallback);
    }
    this.setFontFamilyMapping('New Computer Modern', [NEW_CM_REGULAR]);
    this.setFontFamilyMapping('Courier New', monoFallback);
    this.setFontFamilyMapping('DejaVu Sans Mono', monoFallback);
    // Font Awesome families need explicit icon font URLs from your own host.
    this.setFontFamilyMapping('font awesome 7 free', sansFallback);
    this.setFontFamilyMapping('font awesome 7 brands', sansFallback);
  }

  private loadFontMapFromEnv(): void {
    const raw = (this.env as unknown as Record<string, unknown>)['FONT_FAMILY_URLS_JSON'];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string | string[]>;
      for (const [family, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          this.setFontFamilyMapping(family, [value]);
          continue;
        }
        if (Array.isArray(value)) {
          this.setFontFamilyMapping(family, value.filter((entry): entry is string => typeof entry === 'string'));
        }
      }
    } catch (error) {
      console.warn('[TypstCompilerDO] invalid FONT_FAMILY_URLS_JSON:', error);
    }
  }

  private async resolveDynamicFontUrls(families: string[]): Promise<string[]> {
    const discovered = new Set<string>();
    for (const family of families) {
      const mapped = this.fontFamilyUrlMap.get(this.normalizeFamilyName(family));
      if (mapped) {
        for (const url of mapped) {
          discovered.add(url);
        }
      }

      // Also query RenderCV's canonical font repository for family-specific files.
      const renderCvUrls = await this.fetchRenderCvFontUrls(family);
      for (const url of renderCvUrls) {
        discovered.add(url);
      }
    }
    return [...discovered.values()];
  }

  private async getCompilerRuntime(): Promise<CompilerRuntime> {
    if (!this.compilerPromise) {
      this.compilerPromise = (async () => {
        const [regular, bold] = await this.fontBytesPromise;
        const dynamicFontBytes: Uint8Array[] = [];
        for (const url of this.dynamicFontUrls.values()) {
          try {
            dynamicFontBytes.push(await fetchFontBytes(url));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[TypstCompilerDO] skipping dynamic font URL (${url}): ${message}`);
          }
        }

        const workerSafeFontLoader = Object.assign(
          async (_: unknown, { builder }: { builder: { add_raw_font(data: Uint8Array): Promise<void> } }) => {
            await builder.add_raw_font(regular);
            await builder.add_raw_font(bold);
            for (const bytes of dynamicFontBytes) {
              await builder.add_raw_font(bytes);
            }
          },
          {
            _kind: 'fontLoader',
            _preloadRemoteFontOptions: { assets: false },
          },
        );

        const compiler = createTypstCompiler();
        const accessModel = new MemoryAccessModel();
        const packageRegistry = new WorkerPackageRegistry(accessModel);
        await packageRegistry.preloadFromSource(SAMPLE_TYP);
        const extraSpecs = [...this.extraPreloadPackages.values()];
        if (extraSpecs.length > 0) {
          console.log(
            `[WorkerPackageRegistry] preloading ${extraSpecs.length} discovered dependency package(s): ${extraSpecs.map(packageKey).join(', ')}`,
          );
          await packageRegistry.preload(extraSpecs);
        }
        await compiler.init({
          getModule: () => wasmModule,
          // Avoid loadFonts(): it uses dynamic codegen (new Function), blocked in Workers.
          beforeBuild: [
            workerSafeFontLoader as any,
            withAccessModel(accessModel),
            withPackageRegistry(packageRegistry as any),
          ],
        });
        compiler.addSource('/main.typ', SAMPLE_TYP);
        return { compiler, packageRegistry };
      })();
    }
    return this.compilerPromise;
  }

  private async compilePdfResponse(): Promise<Response> {
    let runtime = await this.getCompilerRuntime();
    let out = await runtime.compiler.compile({
      mainFilePath: '/main.typ',
      format: CompileFormatEnum.pdf,
      diagnostics: 'full',
    });

    for (let i = 0; i < 5 && !out.result; i++) {
      const missingPackages = parseMissingPreviewPackages(out.diagnostics as unknown[] | undefined);
      const missingFamilies = parseMissingFontFamilies(out.diagnostics as unknown[] | undefined);

      let changed = false;
      if (missingPackages.length > 0) {
        console.log(
          `[WorkerPackageRegistry] compile retry ${i + 1}: discovered missing package(s): ${missingPackages.map(packageKey).join(', ')}`,
        );
        for (const spec of missingPackages) {
          this.extraPreloadPackages.set(packageKey(spec), spec);
        }
        changed = true;
      }

      if (missingFamilies.length > 0) {
        const discoveredUrls = await this.resolveDynamicFontUrls(missingFamilies);
        const newUrls = discoveredUrls.filter(url => !this.dynamicFontUrls.has(url));
        if (newUrls.length > 0) {
          console.log(
            `[TypstCompilerDO] compile retry ${i + 1}: discovered missing font(s): ${missingFamilies.join(', ')}; loading ${newUrls.length} mapped font file(s)`,
          );
          for (const url of newUrls) {
            this.dynamicFontUrls.add(url);
          }
          changed = true;
        } else {
          console.warn(
            `[TypstCompilerDO] missing font family/families detected but no mapped URLs found: ${missingFamilies.join(', ')}`,
          );
        }
      }

      if (!changed) {
        break;
      }

      // Recreate compiler so package resolution retries with expanded registry preload.
      this.compilerPromise = null;
      runtime = await this.getCompilerRuntime();
      out = await runtime.compiler.compile({
        mainFilePath: '/main.typ',
        format: CompileFormatEnum.pdf,
        diagnostics: 'full',
      });
    }

    if (!out.result) {
      return Response.json(
        {
          ok: false,
          error: 'Compilation produced no PDF',
          diagnostics: out.diagnostics ?? [],
        },
        { status: 500 },
      );
    }

    return new Response(out.result, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'inline; filename="sample.pdf"',
        'cache-control': 'no-store',
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/compile-pdf') {
      try {
        return await this.compilePdfResponse();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ ok: false, error: message }, { status: 500 });
      }
    }
    return Response.json({ ok: false, error: 'Not Found' }, { status: 404 });
  }
}
