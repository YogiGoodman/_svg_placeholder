/** One run of a highlighted fragment. `hit` marks the matched span. */
export interface HlPart {
  text: string;
  hit: boolean;
}

const MARK = /<em>(.*?)<\/em>/gis;

/**
 * Split a highlight fragment into plain runs.
 *
 * Splits on `<em>` ONLY; everything else is literal text that Angular's
 * interpolation escapes. That is the whole safety argument: there is no
 * `[innerHTML]` and no `bypassSecurityTrust` anywhere in this path, so a
 * fragment arriving from a future Elasticsearch cluster cannot inject markup
 * no matter what is in the index. It also means the local and server render
 * paths are byte-identical — no `if (isLocal)` branch to drift.
 */
export function parseFragment(fragment: string): readonly HlPart[] {
  const parts: HlPart[] = [];
  let last = 0;
  for (const m of fragment.matchAll(MARK)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: fragment.slice(last, i), hit: false });
    parts.push({ text: m[1], hit: true });
    last = i + m[0].length;
  }
  if (last < fragment.length) parts.push({ text: fragment.slice(last), hit: false });
  return parts.length ? parts : [{ text: fragment, hit: false }];
}

/** Wrap the first case-insensitive occurrence of `q`, mirroring the server. */
export function localHighlight(text: string, q: string): string {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return `${text.slice(0, i)}<em>${text.slice(i, i + q.length)}</em>${text.slice(i + q.length)}`;
}
