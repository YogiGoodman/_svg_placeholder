import { computed, Injectable, signal } from '@angular/core';

/**
 * Everything undo restores. Deliberately NOT the whole workspace:
 *
 *  - Mode/type/interval/as-of are one visible click away and re-doable by eye.
 *    Putting them on the stack means pressing ⌘Z twice expecting a series back
 *    and getting an interval change instead — the shortcut stops meaning
 *    anything.
 *  - They also sit behind two self-correcting effects in `SelectionService`
 *    that rewrite mode/type after a restore, so an undo of them would not be a
 *    clean inverse anyway.
 *
 * `slots` is in here for a reason that is easy to miss: colour slots are
 * path-dependent. Remove a series and its slot is freed for the next arrival,
 * so a naive undo hands the restored series a DIFFERENT colour than the one the
 * user was reading a second ago.
 */
export interface SelectionSnapshot {
  selectedIds: readonly string[];
  hiddenIds: readonly string[];
  compareIds: readonly string[];
  slots: readonly (readonly [string, number])[];
}

interface Entry {
  /** Names the action in the user's words: "remove TTF", "hide Brent". */
  label: string;
  state: SelectionSnapshot;
}

/** Deep enough for a working session, shallow enough to stay honest. */
const CAP = 60;

/**
 * Undo/redo for the selection domain — the destructive one. Command-shaped
 * rather than diff-shaped: each entry is the state BEFORE an action plus a
 * label, which is all a two-button UI and a tooltip need.
 *
 * The owner of the state registers with it (`register`) instead of being
 * injected by it: `SelectionService` already depends on this service to record,
 * and the reverse edge would be a cycle.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly undoStack = signal<readonly Entry[]>([]);
  private readonly redoStack = signal<readonly Entry[]>([]);

  private capture?: () => SelectionSnapshot;
  private apply?: (s: SelectionSnapshot) => void;

  /** True while an undo/redo is being applied — suppresses re-recording. */
  private applying = false;

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  readonly undoLabel = computed(() => this.undoStack().at(-1)?.label ?? null);
  readonly redoLabel = computed(() => this.redoStack().at(-1)?.label ?? null);

  register(capture: () => SelectionSnapshot, apply: (s: SelectionSnapshot) => void): void {
    this.capture = capture;
    this.apply = apply;
  }

  /**
   * Call immediately BEFORE mutating, with a label for the action about to
   * happen. Any new action invalidates the redo branch — the standard model,
   * and the one every editor has trained people on.
   */
  record(label: string): void {
    if (this.applying || !this.capture) return;
    const state = this.capture();
    this.undoStack.update((s) => [...s, { label, state }].slice(-CAP));
    if (this.redoStack().length) this.redoStack.set([]);
  }

  undo(): void {
    const stack = this.undoStack();
    const entry = stack.at(-1);
    if (!entry || !this.capture || !this.apply) return;
    const current = this.capture();
    this.undoStack.set(stack.slice(0, -1));
    this.redoStack.update((s) => [...s, { label: entry.label, state: current }].slice(-CAP));
    this.run(entry.state);
  }

  redo(): void {
    const stack = this.redoStack();
    const entry = stack.at(-1);
    if (!entry || !this.capture || !this.apply) return;
    const current = this.capture();
    this.redoStack.set(stack.slice(0, -1));
    this.undoStack.update((s) => [...s, { label: entry.label, state: current }].slice(-CAP));
    this.run(entry.state);
  }

  /** Dropped on "Reset layout" and anywhere the past stops being meaningful. */
  clear(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  private run(state: SelectionSnapshot): void {
    this.applying = true;
    try {
      this.apply!(state);
    } finally {
      this.applying = false;
    }
  }
}
