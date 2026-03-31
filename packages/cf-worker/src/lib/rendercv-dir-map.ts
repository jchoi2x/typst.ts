import { normalizeFamilyName } from './normalize-font-family-name';

const RENDERCV_FONTS_API_BASE =
  'https://api.github.com/repos/rendercv/rendercv-fonts/contents/rendercv_fonts';

export const renderCvDirMap = async () => {
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
  const entries = await res.json<Array<{ type?: string; name?: string }>>();
  for (const entry of entries) {
    if (entry.type !== 'dir' || !entry.name) {
      continue;
    }
    result.set(normalizeFamilyName(entry.name), entry.name);
  }
  return result;
};
