export const BROWSE_CHROME_STYLES = `
  :host,
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .panel {
    background: var(--ts-bg-elevated);
  }
  /* Dock header */
  .phead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--ts-tabbar-h);
    padding: 0 var(--ts-space-2) 0 var(--ts-space-4);
    border-bottom: 1px solid var(--ts-border);
    font-size: var(--ts-fs-sm);
    font-weight: var(--ts-fw-semibold);
    color: var(--ts-text-bright);
  }
  .phead__close {
    width: 26px;
    height: 26px;
    flex: none;
  }
  /* Tabs */
  .tabs {
    display: flex;
    height: var(--ts-tabbar-h);
    padding: 0 var(--ts-space-2);
    gap: 2px;
    border-bottom: 1px solid var(--ts-border);
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--ts-space-2);
    padding: 0 var(--ts-space-2);
    flex: 1;
    justify-content: center;
    font-size: var(--ts-fs-xs);
    font-weight: var(--ts-fw-medium);
    color: var(--ts-text-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color var(--ts-dur-1) var(--ts-ease),
      border-color var(--ts-dur-1) var(--ts-ease);
  }
  .tab:hover {
    color: var(--ts-text-bright);
  }
  .tab.is-active {
    color: var(--ts-accent-strong);
    border-bottom-color: var(--ts-accent);
  }
  .tab__label {
    white-space: nowrap;
  }
  /* Search */
  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin: var(--ts-space-2);
  }
  .search__ico {
    position: absolute;
    left: var(--ts-space-2);
    color: var(--ts-text-muted);
    pointer-events: none;
  }
  .search input {
    width: 100%;
    height: 32px;
    padding: 0 var(--ts-space-2) 0 30px;
    border-radius: var(--ts-radius-md);
    border: 1px solid var(--ts-border);
    background: var(--ts-bg-inset);
    color: var(--ts-text-bright);
    font-size: var(--ts-fs-sm);
    transition: border-color var(--ts-dur-1) var(--ts-ease),
      box-shadow var(--ts-dur-1) var(--ts-ease);
  }
  .search input::placeholder {
    color: var(--ts-text-faint);
  }
  .search input:focus {
    outline: none;
    border-color: var(--ts-accent);
    box-shadow: 0 0 0 3px var(--ts-accent-weak);
  }
  .search__clear {
    position: absolute;
    right: 2px;
    width: 26px;
    height: 26px;
  }
  /* Body */
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--ts-space-1) var(--ts-space-2) var(--ts-space-3);
  }
  .tree {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  /* Search results */
  .results {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .results__meta {
    display: block;
    padding: var(--ts-space-2) var(--ts-space-2) var(--ts-space-1);
    font-size: var(--ts-fs-xxs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ts-text-muted);
  }
  .result {
    display: flex;
    align-items: center;
    gap: var(--ts-space-2);
    padding: var(--ts-space-2);
    border-radius: var(--ts-radius-sm);
    cursor: pointer;
    transition: background var(--ts-dur-1) var(--ts-ease);
  }
  .result:hover {
    background: var(--ts-bg-hover);
  }
  .result.is-selected {
    background: var(--ts-accent-weak);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .result__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .result__name {
    font-size: var(--ts-fs-sm);
    color: var(--ts-text-bright);
  }
  .result__path {
    font-size: var(--ts-fs-xxs);
    color: var(--ts-text-muted);
  }
  .result__sym {
    font-size: var(--ts-fs-xxs);
    color: var(--ts-text-secondary);
    flex: none;
  }
  .ts-empty.small {
    gap: var(--ts-space-3);
    padding: var(--ts-space-6) var(--ts-space-4);
  }
  .ts-empty.small img {
    max-width: 140px;
  }
  .ts-empty.small h3 {
    font-size: var(--ts-fs-md);
  }
  /* Footer */
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ts-space-2) var(--ts-space-3);
    border-top: 1px solid var(--ts-border);
    font-size: var(--ts-fs-xxs);
    color: var(--ts-text-muted);
  }
  .clear-all {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px var(--ts-space-2);
    border-radius: var(--ts-radius-sm);
    color: var(--ts-text-muted);
    cursor: pointer;
    transition:
      background var(--ts-dur-1) var(--ts-ease),
      color var(--ts-dur-1) var(--ts-ease);
  }
  .clear-all:hover {
    background: color-mix(in srgb, var(--ts-down) 14%, transparent);
    color: var(--ts-down);
  }
`;
