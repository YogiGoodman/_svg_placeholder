import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CustomStore, type LoadOptions } from 'devextreme/common/data';
import {
  DxTreeListComponent as DxTreeList,
  DxTreeListModule,
} from 'devextreme-angular/ui/tree-list';
import type {
  RowClickEvent,
  RowCollapsingEvent,
  RowExpandingEvent,
} from 'devextreme/ui/tree_list';
import { LucideAngularModule } from 'lucide-angular';
import { TreeNode } from '../../../data/models';
import { SERIES } from '../../../data/series-catalog.data';
import { SeriesColorService } from '../../../core/series-color.service';
import { SelectionService } from '../../../core/selection.service';
import { CHILD_LIMIT_OFF, TreeStateService } from '../../../core/tree-state.service';
import { TooltipDirective } from '../../../core/tooltip.directive';

/** Map key standing in for "no parent" — a Map cannot key on null. */
const ROOT = '__root__';

/**
 * One TreeList row. `hasItems` is DevExtreme's `hasItemsExpr`: it tells the
 * widget to draw an expander before the children have been fetched, which is
 * what makes load-on-demand possible at all.
 */
interface FlatNode {
  id: string;
  parentId: string | null;
  label: string;
  hasItems: boolean;
  caption?: string;
  icon?: string;
  seriesId?: string;
  badge?: string;
  /** Synthetic row: the "+N more" affordance closing a truncated child list. */
  isMore?: boolean;
  moreCount?: number;
}

/** Derived once per tree; row templates read from here instead of walking. */
interface TreeIndex {
  /** Children by parent id (ROOT for top level) — the unit a lazy load returns. */
  byParent: Map<string, TreeNode[]>;
  /** Node by id, to answer "is this branch lazy?" without walking. */
  nodeById: Map<string, TreeNode>;
  /** Every id in this tree, to keep foreign expansion keys out of DevExtreme. */
  ids: Set<string>;
  /** Leaf count under a node id (parents only). */
  leafCount: Map<string, number>;
  /** Series ids under a node id (parents only). */
  seriesIds: Map<string, string[]>;
}

function buildIndex(roots: TreeNode[]): TreeIndex {
  const byParent = new Map<string, TreeNode[]>();
  const nodeById = new Map<string, TreeNode>();
  const ids = new Set<string>();
  const leafCount = new Map<string, number>();
  const seriesIds = new Map<string, string[]>();

  /** Returns [leaf rows, series ids] contained in `nodes`. */
  const walk = (nodes: TreeNode[], parentKey: string): [number, string[]] => {
    byParent.set(parentKey, nodes);
    let leaves = 0;
    const collected: string[] = [];
    for (const node of nodes) {
      ids.add(node.id);
      nodeById.set(node.id, node);
      if (node.children?.length) {
        const [childLeaves, childIds] = walk(node.children, node.id);
        leafCount.set(node.id, childLeaves);
        seriesIds.set(node.id, childIds);
        leaves += childLeaves;
        collected.push(...childIds);
      } else {
        leaves += 1;
        if (node.seriesId) collected.push(node.seriesId);
      }
    }
    return [leaves, collected];
  };
  walk(roots, ROOT);

  return { byParent, nodeById, ids, leafCount, seriesIds };
}

function toRow(node: TreeNode, parentId: string | null): FlatNode {
  return {
    id: node.id,
    parentId,
    label: node.label,
    // Fixture shortcut. In production this MUST come from the payload: a lazy
    // node's children do not exist when its row is built, so deriving it from
    // `children.length` would render every unloaded branch as a leaf.
    hasItems: !!node.children?.length,
    caption: node.caption,
    icon: node.icon,
    seriesId: node.seriesId,
    badge: node.badge,
  };
}

/**
 * DevExtreme TreeList rendered to the ts-chart row spec.
 *
 * Children come from a `CustomStore`: with `remoteOperations.filtering` on,
 * DevExtreme calls `load()` with only the `parentIds` it is about to render.
 *
 * Only contract lists are lazy (`TreeNode.lazy`) — the taxonomy above them is
 * known upfront and is answered synchronously, so opening a group never waits
 * on anything. A lazy branch is fetched once and cached for the session, which
 * means the second expand, and every refresh after it, is also synchronous.
 * `loadChildren` returning an array rather than a promise is what keeps the
 * widget from flashing a load panel at a trader mid-scan.
 *
 * Long child lists are truncated to `TreeStateService.childLimit` and closed
 * with a "+N more" row. Truncation happens inside the load that produced the
 * branch — one `slice` on data already in hand, no second pass, and no row
 * objects built for children that are not shown.
 */
@Component({
  selector: 'app-dx-tree-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // DX renders its own DOM outside Angular's emulated encapsulation; every rule
  // in the stylesheet is scoped under `.dxtree` to keep the leak contained.
  encapsulation: ViewEncapsulation.None,
  imports: [DxTreeListModule, LucideAngularModule, TooltipDirective],
  templateUrl: './dx-tree-list.component.html',
  styleUrl: './dx-tree-list.component.scss',
})
export class DxTreeListComponent {
  readonly roots = input.required<TreeNode[]>();

  private readonly colors = inject(SeriesColorService);
  private readonly selection = inject(SelectionService);
  private readonly treeState = inject(TreeStateService);
  private readonly grid = viewChild(DxTreeList);

  private readonly index = computed(() => buildIndex(this.roots()));
  private readonly selectedSet = computed(() => new Set(this.selection.selectedIds()));

  /** Parents whose full child list the operator has asked to see. */
  private readonly revealed = signal<ReadonlySet<string>>(new Set());

  /**
   * Children of lazy branches, fetched once and kept for the session. Present
   * here means "already paid for": the load answers synchronously and the row
   * never shows a pending state again.
   */
  private readonly fetched = new Map<string, TreeNode[]>();

  /** Expansion is app state; scoped to this tree so DX never sees foreign keys. */
  readonly expandedKeys = computed(() => {
    const { ids } = this.index();
    return [...this.treeState.set()].filter((id) => ids.has(id));
  });

  readonly store = new CustomStore<FlatNode, string>({
    key: 'id',
    // DevExtreme asks for exactly the branches it is about to render.
    load: (options: LoadOptions<FlatNode>) => {
      const parents = (options.parentIds as (string | null)[] | undefined) ?? [null];
      const branches = parents.map((parentId) => this.loadChildren(parentId));
      // Only go async when a branch genuinely has to be fetched. Returning a
      // promise is what makes DevExtreme raise a pending state, so a batch of
      // already-cached branches must resolve on this tick.
      return branches.some((branch) => branch instanceof Promise)
        ? Promise.all(branches).then((all) => all.flat())
        : (branches as FlatNode[][]).flat();
    },
  });

  constructor() {
    // A new tree means the store must be re-asked. Reveals are keyed by branch
    // id, so they survive a tab switch untouched.
    effect(() => {
      this.roots();
      untracked(() => this.reload());
    });

    // A different cap changes what is folded, so existing reveals no longer apply.
    effect(() => {
      this.treeState.childLimit();
      untracked(() => {
        this.revealed.set(new Set());
        this.reload();
      });
    });
  }

  /**
   * Re-ask the store for what is currently on screen; `changesOnly` repaints
   * only the rows that differ. A no-op before the widget exists, which is what
   * keeps the two setup effects from each forcing a load on the first render.
   */
  private reload(): void {
    this.grid()?.instance?.refresh(true);
  }

  /**
   * The load-on-demand boundary. Synchronous for everything already held —
   * the whole taxonomy, and any lazy branch fetched earlier — so only a
   * first-time contract list returns a promise.
   */
  private loadChildren(parentId: string | null): FlatNode[] | Promise<FlatNode[]> {
    const key = parentId ?? ROOT;
    const node = parentId ? this.index().nodeById.get(parentId) : undefined;

    if (node?.lazy && !this.fetched.has(key)) {
      return this.fetchBranch(key, node).then((children) => this.render(key, children, parentId));
    }

    const children = this.fetched.get(key) ?? this.index().byParent.get(key) ?? [];
    return this.render(key, children, parentId);
  }

  /**
   * One in-flight request per branch. DevExtreme can ask for the same parent
   * twice before the first answer lands (a refresh while a load is pending), and
   * without this that becomes two calls.
   */
  private readonly inFlight = new Map<string, Promise<TreeNode[]>>();

  /**
   * Fetch a lazy branch once. The cache is written when the response *arrives*,
   * never before, and a failure is not cached — so the next expand retries
   * instead of showing a branch that is permanently empty.
   */
  private fetchBranch(key: string, node: TreeNode): Promise<TreeNode[]> {
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.requestChildren(node)
      .then((children) => {
        this.fetched.set(key, children);
        this.inFlight.delete(key);
        return children;
      })
      .catch((error: unknown) => {
        this.inFlight.delete(key);
        throw error;
      });

    this.inFlight.set(key, request);
    return request;
  }

  /** The data call — the only method that changes when this talks to a server. */
  private requestChildren(node: TreeNode): Promise<TreeNode[]> {
    return Promise.resolve(node.children ?? []);
  }

  /** Cap a branch and close it with the "+N more" affordance when it overflows. */
  private render(key: string, children: TreeNode[], parentId: string | null): FlatNode[] {
    const limit = this.treeState.childLimit();

    if (limit === CHILD_LIMIT_OFF || children.length <= limit || this.revealed().has(key)) {
      return children.map((child) => toRow(child, parentId));
    }

    const rows = children.slice(0, limit).map((child) => toRow(child, parentId));
    rows.push({
      id: `${key}::more`,
      parentId,
      label: '',
      hasItems: false,
      isMore: true,
      moreCount: children.length - limit,
    });
    return rows;
  }

  /** Reveal the rest of a truncated branch, then repaint only what changed. */
  revealMore(row: FlatNode): void {
    const key = row.parentId ?? ROOT;
    this.revealed.update((prev) => new Set(prev).add(key));
    this.reload();
  }

  isNodeExpanded(id: string): boolean {
    return this.treeState.set().has(id);
  }

  /** A group node can carry its own series, so this is not leaf-only. */
  isSelected(row: FlatNode): boolean {
    return !!row.seriesId && this.selectedSet().has(row.seriesId);
  }

  isDisabled(row: FlatNode): boolean {
    const s = row.seriesId ? SERIES[row.seriesId] : undefined;
    return !!s?.status && s.status !== 'ok';
  }

  /** Assigned color when selected; invisible placeholder keeps rows aligned. */
  getDotColor(row: FlatNode): string {
    return row.seriesId && this.isSelected(row) ? this.colors.color(row.seriesId) : 'transparent';
  }

  /** Full name for the themed tooltip; note the reason when a leaf is disabled. */
  leafTip(row: FlatNode): string {
    const s = row.seriesId ? SERIES[row.seriesId] : undefined;
    if (!s) return row.label;
    if (s.status === 'forbidden') return `${s.name} — restricted (entitlement required)`;
    if (s.status === 'missing') return `${s.name} — no data available`;
    return `${s.name} · ${s.unit}`;
  }

  /** Groups that are also a series explain both roles; plain groups need no tip. */
  parentTip(row: FlatNode): string {
    return row.seriesId ? `${this.leafTip(row)} — click to chart, chevron to expand` : '';
  }

  getLeafCount(row: FlatNode): number {
    return this.index().leafCount.get(row.id) ?? 0;
  }

  /** How many series under this (collapsed) parent are currently selected. */
  getSelectedInside(row: FlatNode): number {
    const ids = this.index().seriesIds.get(row.id);
    if (!ids?.length) return 0;
    const sel = this.selectedSet();
    let n = 0;
    for (const id of ids) if (sel.has(id)) n += 1;
    return n;
  }

  /**
   * Row-body click. Any node carrying a series charts it — including a group that
   * is also a series (e.g. Curve Builder › Brent › M+1), where expanding is the
   * chevron's job alone. A plain group has nothing to chart, so it toggles.
   */
  onRowClick(e: RowClickEvent<FlatNode, string>): void {
    const row = e.data;
    if (!row) return;
    if (row.isMore) this.revealMore(row);
    else if (row.seriesId) this.selection.toggle(row.seriesId);
    else if (row.hasItems) this.treeState.toggle(row.id);
  }

  /**
   * Chevron click. Expands only, and stops the event so a group that is also a
   * series is not charted at the same time.
   */
  onTwistClick(event: MouseEvent, row: FlatNode): void {
    event.stopPropagation();
    this.treeState.toggle(row.id);
  }

  /**
   * DevExtreme's own expand path — keyboard navigation (→ / ←) and any
   * `expandRow()` call. Cancelling hands the decision to the service, which then
   * pushes it back through `[expandedRowKeys]`.
   *
   * Without this the widget expands a row in its own private state while the
   * service knows nothing: the chevron keeps pointing right at an open branch,
   * and the next unrelated toggle rewrites `expandedRowKeys` and silently
   * collapses it again. One writer, or the two states drift.
   */
  onExpanding(e: RowExpandingEvent<FlatNode, string>): void {
    e.cancel = true;
    if (!this.treeState.set().has(e.key)) this.treeState.toggle(e.key);
  }

  onCollapsing(e: RowCollapsingEvent<FlatNode, string>): void {
    e.cancel = true;
    if (this.treeState.set().has(e.key)) this.treeState.toggle(e.key);
  }
}
