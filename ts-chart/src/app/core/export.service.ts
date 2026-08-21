import { Injectable } from '@angular/core';
import { makeZip, ZipEntry } from './zip';

/** Files served from `public/design-kit/` that make up the exportable kit. */
const KIT_FILES = [
  'AGENTS.md',
  'DESIGN_GUIDE.md',
  'CHART_STYLE_GUIDE.md',
  'UX_ENGINEERING_PLAYBOOK.md',
  'WORKSPACE_PERSISTENCE.md',
  'DEVEXTREME_TREELIST_GUIDE.md',
  'ACCESSIBILITY_GUIDE.md',
  'SEARCH_ARCHITECTURE.md',
  'scss/_tokens.scss',
  'scss/_utilities.scss',
  'scss/_reset.scss',
  'tokens/tokens.css',
  'tokens/tokens.json',
];

/**
 * Bundles the design system (docs + SCSS + tokens + agent README) into a single
 * `.zip` the user can download and hand to another trading app or a coding
 * agent. Built entirely client-side — fetches the static kit assets and zips
 * them (STORE mode, see `zip.ts`).
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  async downloadDesignKit(): Promise<void> {
    const enc = new TextEncoder();
    const base = document.baseURI.replace(/\/$/, '');
    const entries: ZipEntry[] = [];

    for (const path of KIT_FILES) {
      try {
        const res = await fetch(`${base}/design-kit/${path}`, { cache: 'no-cache' });
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        entries.push({ name: `ts-chart-design-kit/${path}`, data: buf });
      } catch {
        /* skip a file that can't be fetched rather than fail the whole export */
      }
    }

    if (!entries.length) return;

    // A short top-level manifest so the archive is self-describing.
    entries.unshift({
      name: 'ts-chart-design-kit/README.txt',
      data: enc.encode(
        'TS Chart — Trading SPA UX Kit\n' +
          'Start with AGENTS.md. Import scss/ globally, set data-theme on <html>.\n' +
          `Exported ${new Date().toISOString()}\n`,
      ),
    });

    const blob = makeZip(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ts-chart-design-kit.zip';
    a.click();
    URL.revokeObjectURL(url);
  }
}
