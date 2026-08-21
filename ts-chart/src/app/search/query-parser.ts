import { Filters, ScopeKey } from './search.types';

export const SCOPE_KEYS: readonly ScopeKey[] = [
  'tab',
  'class',
  'source',
  'freq',
  'unit',
  'ccy',
  'tag',
  'status',
];

export interface ScopeToken {
  key: ScopeKey;
  value: string;
  negated: boolean;
}

export interface ParsedQuery {
  /** Free text with every recognised token removed. */
  text: string;
  filters: Filters;
  exclude: Filters;
  tokens: readonly ScopeToken[];
}

const TOKEN = /(-?)([a-z]+):("([^"]*)"|\S+)/gi;

function push(into: Record<string, string[]>, key: string, value: string): void {
  (into[key] ??= []).push(value);
}

/**
 * Parse `tag:energy brent`, `-tag:gas`, `class:"north sea"` into filters plus
 * leftover free text. Bloomberg-trained users type their scope rather than
 * reaching for a dropdown, so the same vocabulary has to work typed and clicked.
 *
 * Unknown keys stay in the free text on purpose. A ticker like `M+1:` or a
 * pasted `http://…` must not silently vanish into a filter — one surprise like
 * that and nobody trusts the syntax again.
 */
export function parseScopedQuery(raw: string): ParsedQuery {
  const filters: Record<string, string[]> = {};
  const exclude: Record<string, string[]> = {};
  const tokens: ScopeToken[] = [];
  let text = raw;

  for (const m of raw.matchAll(TOKEN)) {
    const key = m[2].toLowerCase() as ScopeKey;
    if (!SCOPE_KEYS.includes(key)) continue;
    const value = (m[4] ?? m[3]).trim();
    if (!value) continue;
    const negated = m[1] === '-';
    push(negated ? exclude : filters, key, value);
    tokens.push({ key, value, negated });
    text = text.replace(m[0], ' ');
  }

  return { text: text.replace(/\s+/g, ' ').trim(), filters, exclude, tokens };
}

/** Render tokens back into a query string (used when a facet chip is clicked). */
export function formatScopedQuery(text: string, tokens: readonly ScopeToken[]): string {
  const parts = tokens.map(
    (t) => `${t.negated ? '-' : ''}${t.key}:${t.value.includes(' ') ? `"${t.value}"` : t.value}`,
  );
  return [...parts, text].filter(Boolean).join(' ');
}
