import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TreeNode } from '../../data/models';
import { SERIES } from '../../data/series-catalog.data';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { TreeStateService } from '../../core/tree-state.service';
import { TooltipDirective } from '../../core/tooltip.directive';

/** Recursive tree row. Parents expand/collapse; leaves select a series. */
@Component({
  selector: 'app-tree-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective],
  template: `
    @if (isLeaf()) {
      <button
        class="row leaf"
        [class.is-selected]="selected()"
        [class.is-disabled]="disabled()"
        [style.--depth]="depth()"
        (click)="selectLeaf()"
        [attr.aria-current]="selected()"
        [tsTooltip]="leafTip()"
      >
        <span class="dot" [style.background]="dotColor()"></span>
        <span class="label ts-truncate">{{ node().label }}</span>
        @if (node().badge) {
          <lucide-icon
            class="node-ic"
            [class.locked]="node().badge === 'locked'"
            [name]="node().badge === 'locked' ? 'lock' : 'triangle-alert'"
            [size]="12"
          />
        } @else {
          <span class="caption ts-mono">{{ node().caption }}</span>
        }
      </button>
    } @else {
      <button
        class="row parent"
        [style.--depth]="depth()"
        (click)="toggleExpanded()"
        [attr.aria-expanded]="expanded()"
      >
        <lucide-icon
          class="twist"
          [class.open]="expanded()"
          name="chevron-right"
          [size]="14"
        />
        @if (node().icon) {
          <lucide-icon class="folder-ico" [name]="node().icon!" [size]="15" />
        }
        <span class="label ts-truncate">{{ node().label }}</span>
        <!-- Collapsed group with active selections underneath: surface it so a
             hidden selection is never invisible. -->
        @if (!expanded() && selectedInside() > 0) {
          <span
            class="sel-badge ts-mono"
            [tsTooltip]="selectedInside() + ' selected in this group'"
          >
            {{ selectedInside() }}
          </span>
        }
        <span class="count">{{ leafCount() }}</span>
      </button>

      @if (expanded()) {
        <div class="children">
          @for (child of node().children; track child.id) {
            <app-tree-node [node]="child" [depth]="depth() + 1" />
          }
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        width: 100%;
        height: var(--ts-row-h);
        padding-left: calc(var(--ts-space-3) + var(--depth, 0) * 14px);
        padding-right: var(--ts-space-3);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-secondary);
        cursor: pointer;
        transition: background var(--ts-dur-1) var(--ts-ease),
          color var(--ts-dur-1) var(--ts-ease);
      }
      .row:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      .parent {
        font-weight: var(--ts-fw-medium);
        color: var(--ts-text);
      }
      .twist {
        color: var(--ts-text-muted);
        transition: transform var(--ts-dur-2) var(--ts-ease);
        flex: none;
      }
      .twist.open {
        transform: rotate(90deg);
      }
      .folder-ico {
        color: var(--ts-text-muted);
        flex: none;
      }
      .label {
        flex: 1;
        font-size: var(--ts-fs-sm);
        text-align: left;
      }
      .count {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-faint);
        font-variant-numeric: tabular-nums;
      }
      .sel-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 15px;
        padding: 0 5px;
        border-radius: var(--ts-radius-pill);
        background: var(--ts-accent-weak);
        color: var(--ts-accent-strong);
        font-size: var(--ts-fs-xxs);
        font-weight: var(--ts-fw-bold);
        flex: none;
      }
      /* Leaf */
      .leaf {
        color: var(--ts-text-secondary);
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
        margin-left: 15px;
        box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, transparent);
      }
      .leaf.is-selected {
        background: var(--ts-accent-weak);
        color: var(--ts-text-bright);
      }
      .caption {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-faint);
      }
      .node-ic {
        color: var(--ts-text-muted);
        flex: none;
      }
      .node-ic.locked {
        color: var(--ts-warn);
      }
      .leaf.is-disabled {
        opacity: 0.65;
      }
      .children {
        animation: reveal var(--ts-dur-2) var(--ts-ease);
      }
      @keyframes reveal {
        from {
          opacity: 0;
          transform: translateY(-2px);
        }
      }
    `,
  ],
})
export class TreeNodeComponent {
  readonly node = input.required<TreeNode>();
  readonly depth = input(0);

  private readonly selection = inject(SelectionService);
  private readonly colors = inject(SeriesColorService);
  private readonly treeState = inject(TreeStateService);

  /** App-wide expansion state — survives tab switches (nodes are recreated). */
  readonly expanded = computed(() => this.treeState.set().has(this.node().id));

  toggleExpanded(): void {
    this.treeState.toggle(this.node().id);
  }

  readonly isLeaf = computed(() => !this.node().children?.length);

  readonly selected = computed(() => {
    const id = this.node().seriesId;
    return id ? this.selection.selectedIds().includes(id) : false;
  });

  readonly disabled = computed(() => {
    const id = this.node().seriesId;
    return id ? SERIES[id]?.status && SERIES[id]?.status !== 'ok' : false;
  });

  /** Assigned color when selected; invisible placeholder keeps rows aligned. */
  readonly dotColor = computed(() => {
    const id = this.node().seriesId;
    return id && this.selected() ? this.colors.color(id) : 'transparent';
  });

  /** Full name for the themed tooltip; note the reason when a leaf is disabled. */
  readonly leafTip = computed(() => {
    const id = this.node().seriesId;
    const s = id ? SERIES[id] : undefined;
    if (!s) return this.node().label;
    if (s.status === 'forbidden') return `${s.name} — restricted (entitlement required)`;
    if (s.status === 'missing') return `${s.name} — no data available`;
    return `${s.name} · ${s.unit}`;
  });

  readonly leafCount = computed(() => countLeaves(this.node()));

  /** How many series under this (collapsed) parent are currently selected. */
  readonly selectedInside = computed(() => {
    if (this.isLeaf()) return 0;
    const sel = new Set(this.selection.selectedIds());
    let n = 0;
    for (const id of seriesIdsIn(this.node())) if (sel.has(id)) n++;
    return n;
  });

  selectLeaf(): void {
    const id = this.node().seriesId;
    if (id) this.selection.toggle(id);
  }
}

function countLeaves(node: TreeNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((n, c) => n + countLeaves(c), 0);
}

/** All series ids under a node (leaves only). */
function seriesIdsIn(node: TreeNode): string[] {
  if (!node.children?.length) return node.seriesId ? [node.seriesId] : [];
  return node.children.flatMap(seriesIdsIn);
}
