import { packageKey, type PreviewPackageSpec } from "@jchoi2x/typst.ts/src/fs/package.worker.mjs";

export function parseMissingPreviewPackages(diagnostics: unknown[] | undefined): PreviewPackageSpec[] {
  if (!diagnostics) {
    return [];
  }

  const pattern = /searched for @preview\/([^:\s]+):([^\)\s]+)/;
  const out = new Map<string, PreviewPackageSpec>();

  for (const diagnostic of diagnostics as Array<{ message?: string }>) {
    const message = diagnostic?.message;
    if (!message) {
      continue;
    }
    const match = pattern.exec(message);
    if (!match) {
      continue;
    }
    const [, name, version] = match;
    if (!name || !version) {
      continue;
    }
    const spec: PreviewPackageSpec = { namespace: 'preview', name, version };
    out.set(packageKey(spec), spec);
  }

  return [...out.values()];
}
