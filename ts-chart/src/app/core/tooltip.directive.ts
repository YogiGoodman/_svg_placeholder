import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
} from '@angular/core';

/**
 * Lightweight themed tooltip. Renders a token-styled bubble in `document.body`
 * so it escapes overflow-clipped panels (tree rows, chart chrome). Because it
 * reads `--ts-*` custom properties, it automatically follows the light/dark
 * theme set via `data-theme` on `<html>`. Use where truncation hides text or a
 * control needs an explanation (e.g. disabled chart modes).
 *
 * Usage: `<span [tsTooltip]="series.name">…</span>`
 */
@Directive({
  selector: '[tsTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  readonly tsTooltip = input<string | null | undefined>('');

  private readonly host = inject(ElementRef<HTMLElement>);
  private el: HTMLDivElement | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  @HostListener('mouseenter')
  @HostListener('focus')
  show(): void {
    const text = (this.tsTooltip() ?? '').trim();
    if (!text) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.render(text), 260);
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  @HostListener('click')
  hide(): void {
    clearTimeout(this.timer);
    this.el?.remove();
    this.el = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private render(text: string): void {
    this.el?.remove();
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

    const r = this.host.nativeElement.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const gap = 8;
    let top = r.top - tr.height - gap; // prefer above
    if (top < 4) top = r.bottom + gap; // flip below if clipped
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tr.width - 4));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    requestAnimationFrame(() => (tip.style.opacity = '1'));
    this.el = tip;
  }
}
