import { PackageRegistry, PackageResolveContext, PackageSpec } from '../internal.types.mjs';
import { WritableAccessModel } from './index.mjs';

export type PreviewPackageSpec = { namespace: 'preview'; name: string; version: string };

export function packageKey(spec: PreviewPackageSpec): string {
  return `${spec.namespace}:${spec.name}:${spec.version}`;
}

export function extractPreviewPackages(source: string): PreviewPackageSpec[] {
  const pattern = /#import\s+"@preview\/([^:"\s]+):([^"\s]+)"/g;
  const dedup = new Map<string, PreviewPackageSpec>();

  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const [, name, version] = match;
    if (!name || !version) {
      continue;
    }
    const spec: PreviewPackageSpec = {
      namespace: 'preview',
      name,
      version,
    };
    dedup.set(packageKey(spec), spec);
  }

  return [...dedup.values()];
}

export class WorkerPackageRegistry implements PackageRegistry {
  private archives = new Map<string, Uint8Array>();
  private resolved = new Set<string>();
  private readonly logPrefix = '[WorkerPackageRegistry]';

  constructor(private accessModel: WritableAccessModel) {}

  private archiveUrl(spec: PreviewPackageSpec): string {
    return `https://packages.typst.org/preview/${spec.name}-${spec.version}.tar.gz`;
  }

  async preloadFromSource(source: string): Promise<void> {
    const specs = extractPreviewPackages(source);
    console.log(`${this.logPrefix} discovered ${specs.length} top-level package import(s)`);
    await this.preload(specs);
  }

  async preload(specs: PreviewPackageSpec[]): Promise<void> {
    await Promise.all(
      specs.map(async spec => {
        const key = packageKey(spec);
        if (this.archives.has(key)) {
          console.log(`${this.logPrefix} cache hit for ${key}`);
          return;
        }
        const url = this.archiveUrl(spec);
        console.log(`${this.logPrefix} fetching ${key} from ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch Typst package ${key} (${res.status})`);
        }
        const archive = new Uint8Array(await res.arrayBuffer());
        this.archives.set(key, archive);
        console.log(`${this.logPrefix} cached ${key} (${archive.byteLength} bytes)`);
      }),
    );
  }

  resolve(spec: PackageSpec, context: PackageResolveContext): string | undefined {
    if (spec.namespace !== 'preview') {
      return undefined;
    }
    const key = `${spec.namespace}:${spec.name}:${spec.version}`;
    const archive = this.archives.get(key);
    if (!archive) {
      console.warn(`${this.logPrefix} missing archive for ${key}`);
      return undefined;
    }

    const previewDir = `/@memory/fetch/packages/${spec.namespace}/${spec.name}/${spec.version}`;
    if (!this.resolved.has(key)) {
      let fileCount = 0;
      context.untar(archive, (path, data, mtime) => {
        this.accessModel.insertFile(`${previewDir}/${path}`, data, new Date(mtime));
        fileCount += 1;
      });
      this.resolved.add(key);
      console.log(`${this.logPrefix} extracted ${key} into ${previewDir} (${fileCount} file(s))`);
    } else {
      console.log(`${this.logPrefix} resolve cache hit for ${key}`);
    }

    console.log(`${this.logPrefix} resolved ${key} -> ${previewDir}`);
    return previewDir;
  }
}
