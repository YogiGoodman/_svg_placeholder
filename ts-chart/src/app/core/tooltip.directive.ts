import { Directive, ElementRef, HostListener, inject, OnDestroy, effect, input } from '@angular/core';

/**
 * Lightweight themed tooltip. Renders a token-styled bubble in `document.body`
 * so it escapes overflow-clipped panels (tree rows, chart chrome). Because it
 * reads `--ts-*` custom properties it follows the light/dark theme set via
 * `data-theme` on `<html>`. Use where truncation hides text or a control needs
 * an explanation (e.g. disabled chart modes).
 *
 * Usage: `<span [tsTooltip]="series.name">…</span>`
 *
 * ## Why this is more than a mouseenter/mouseleave pair
 *
 * Hiding on `mouseleave` alone leaks bubbles, because there are many ways for a
 * hovered host to stop being hovered without ever emitting one:
 *  - the host is hidden with `[hidden]`/CSS rather than destroyed (the chart and
 *    data views do exactly this when you toggle between them);
 *  - a full-screen dropdown backdrop is inserted over the host;
 *  - the host sits inside a `.dim { pointer-events: none }` wrapper;
 *  - an overlay closes and the element under the cursor changes silently.
 *
 * Rather than enumerate those, the visible bubble is policed by a single
 * capture-phase `pointermove` listener on the document: if the pointer is not
 * over the owning host any more, hide. One rule, every leak. The listener only
 * exists while a bubble is on screen, so it costs nothing at rest.
 *
 * A module-level singleton makes two bubbles impossible even if two directives
 * both believe they are showing.
 */

/** The one bubble that may exist at any moment, and who owns it. */
let activeEl: HTMLDivElement | null = null;
let activeOwner: TooltipDirective | null = null;
/** Timestamp of the last hide, for the warm-up/cool-down window. */
let lastHideAt = 0;

const SHOW_DELAY = 260;
/** Re-show instantly if the previous bubble closed within this window, so
 *  sweeping across a toolbar feels continuous rather than stuttering. */
const REARM_WINDOW = 300;

@Directive({
  selector: '[tsTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  readonly tsTooltip = input<string | null | undefined>('');

  private readonly host = inject(ElementRef<HTMLElement>);
  private timer?: ReturnType<typeof setTimeout>;
  private bound = false;

  constructor() {
    // Keep a visible bubble truthful if its text changes under it.
    effect(() => {
      const text = (this.tsTooltip() ?? '').trim();
      if (activeOwner !== this || !activeEl) return;
      if (!text) this.hide();
      else if (activeEl.textContent !== text) {
        activeEl.textContent = text;
        this.place(activeEl);
      }
    });
  }

  @HostListener('pointerenter')
  @HostListener('focus')
  show(): void {
    const text = (this.tsTooltip() ?? '').trim();
    if (!text) return;
    clearTimeout(this.timer);
    const warm = Date.now() - lastHideAt < REARM_WINDOW;
    if (warm) this.render(text);
    else this.timer = setTimeout(() => this.render(text), SHOW_DELAY);
  }

  @HostListener('pointerleave')
  @HostListener('blur')
  @HostListener('click')
  @HostListener('pointerdown')
  hide(): void {
    clearTimeout(this.timer);
    if (activeOwner !== this) return;
    activeEl?.remove();
    activeEl = null;
    activeOwner = null;
    lastHideAt = Date.now();
    this.unbindGuards();
  }

  ngOnDestroy(): void {
    this.hide();
    clearTimeout(this.timer);
  }

  // --- global guards, live only while a bubble is on screen -------------------
  private readonly onDocPointerMove = (e: Event) => {
    const t = e.target as Node | null;
    const el = this.host.nativeElement;
    if (t && (el === t || el.contains(t))) return;
    this.hide();
  };
  private readonly onDismiss = () => this.hide();

  private bindGuards(): void {
    if (this.bound) return;
    this.bound = true;
    document.addEventListener('pointermove', this.onDocPointerMove, true);
    document.addEventListener('wheel', this.onDismiss, true);
    document.addEventListener('scroll', this.onDismiss, true);
    document.addEventListener('keydown', this.onDismiss, true);
    document.addEventListener('visibilitychange', this.onDismiss, true);
    window.addEventListener('blur', this.onDismiss, true);
  }

  private unbindGuards(): void {
    if (!this.bound) return;
    this.bound = false;
    document.removeEventListener('pointermove', this.onDocPointerMove, true);
    document.removeEventListener('wheel', this.onDismiss, true);
    document.removeEventListener('scroll', this.onDismiss, true);
    document.removeEventListener('keydown', this.onDismiss, true);
    document.removeEventListener('visibilitychange', this.onDismiss, true);
    window.removeEventListener('blur', this.onDismiss, true);
  }

  private render(text: string): void {
    // A host removed between the hover and the timer firing must not paint.
    if (!this.host.nativeElement.isConnected) return;

    // Evict whatever was showing — one bubble, always.
    activeEl?.remove();
    activeOwner?.unbindGuards();

    const tip = document.createElement('div');
    tip.textContent = text;
    tip.setAttribute('role', 'tooltip');
    Object.assign(tip.style, {
      position: 'fixed',
      zIndex: '9999',
      maxWidth: '260px',
      padding: '5px 8px',
      borderRadius: 'var(--ts-radius-sm, 6px)',
      background: 'var(--ts-bg-active)',
      border: '1px solid var(--ts-border-strong, var(--ts-border))',
      color: 'var(--ts-text-bright)',
      font: '500 11px/1.35 var(--ts-font-sans, sans-serif)',
      boxShadow: 'var(--ts-shadow-2)',
      pointerEvents: 'none',
      whiteSpace: 'normal',
      opacity: '0',
      transition: 'opacity var(--ts-dur-1, 120ms) var(--ts-ease, ease)',
    } as CSSStyleDeclaration);
    document.body.appendChild(tip);

    activeEl = tip;
    activeOwner = this;
    this.place(tip);
    requestAnimationFrame(() => (tip.style.opacity = '1'));
    this.bindGuards();
  }

  /** Prefer above the host, flip below when clipped, clamp horizontally. */
  private place(tip: HTMLDivElement): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const gap = 8;
    let top = r.top - tr.height - gap;
    if (top < 4) top = r.bottom + gap;
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tr.width - 4));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }
}
