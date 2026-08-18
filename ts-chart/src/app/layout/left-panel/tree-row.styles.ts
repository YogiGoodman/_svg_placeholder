export const TREE_ROW_STYLES = `
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
  /* On a group that is also a series the chevron is the only expander — give it
     a real hit area so it is not a 14px target inside a clickable row. */
  .parent.is-series .twist {
    margin: 0 -2px;
    padding: 0 2px;
    border-radius: var(--ts-radius-sm);
  }
  .parent.is-series .twist:hover {
    color: var(--ts-text-bright);
    background: var(--ts-bg-active, var(--ts-bg-hover));
  }
  /* Same color dot as a leaf, so the series reads identically everywhere. */
  .parent .dot {
    margin-left: 0;
  }
  .parent.is-selected {
    background: var(--ts-accent-weak);
    color: var(--ts-text-bright);
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
`;
