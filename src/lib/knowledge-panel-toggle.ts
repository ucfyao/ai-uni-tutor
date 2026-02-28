interface HandleKnowledgePanelToggleParams {
  isCompact: boolean;
  openDrawer: () => void;
  toggleDesktopPanel: () => void;
}

/**
 * Keep knowledge panel toggle behavior consistent across chat modes:
 * compact screens open drawer, desktop screens toggle the fixed panel.
 */
export function handleKnowledgePanelToggle({
  isCompact,
  openDrawer,
  toggleDesktopPanel,
}: HandleKnowledgePanelToggleParams): void {
  if (isCompact) {
    openDrawer();
    return;
  }

  toggleDesktopPanel();
}
