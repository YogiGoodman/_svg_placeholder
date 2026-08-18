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
import { TREE_ROW_STYLES } from './tree-row.styles';

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
        [class.is-series]="hasOwnSeries()"
        [class.is-selected]="hasOwnSeries() && selected()"
        [style.--depth]="depth()"
        (click)="activateParent()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-current]="hasOwnSeries() ? selected() : null"
        [tsTooltip]="hasOwnSeries() ? leafTip() : ''"
      >
        <!-- On a group that is also a series the chevron is the only expander:
             the row body charts the node's own data instead. -->
        <lucide-icon
          class="twist"
          [class.open]="expanded()"
          name="chevron-right"
          [size]="14"
          (click)="onTwistClick($event)"
        />
        @if (hasOwnSeries()) {
          <span class="dot" [style.background]="dotColor()"></span>
        } @else if (node().icon) {
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
  styles: [TREE_ROW_STYLES],
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

  /** A group that also carries its own series (e.g. Curve Builder › Brent › M+1). */
  readonly hasOwnSeries = computed(() => !this.isLeaf() && !!this.node().seriesId);

  /**
   * Row-body click on a group. If the group is itself a series it charts that
   * series — expanding is then the chevron's job alone, so a trader can preview
   * M+1 without unfolding twenty-four contracts underneath it.
   */
  activateParent(): void {
    if (this.hasOwnSeries()) this.selectLeaf();
    else this.toggleExpanded();
  }

  /** Chevron: expand only, never chart. */
  onTwistClick(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleExpanded();
  }

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
