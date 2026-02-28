import { describe, expect, it, vi } from 'vitest';
import { handleKnowledgePanelToggle } from './knowledge-panel-toggle';

describe('handleKnowledgePanelToggle', () => {
  it('opens mobile drawer on compact screens', () => {
    const openDrawer = vi.fn();
    const toggleDesktopPanel = vi.fn();

    handleKnowledgePanelToggle({
      isCompact: true,
      openDrawer,
      toggleDesktopPanel,
    });

    expect(openDrawer).toHaveBeenCalledTimes(1);
    expect(toggleDesktopPanel).not.toHaveBeenCalled();
  });

  it('toggles desktop panel on wide screens', () => {
    const openDrawer = vi.fn();
    const toggleDesktopPanel = vi.fn();

    handleKnowledgePanelToggle({
      isCompact: false,
      openDrawer,
      toggleDesktopPanel,
    });

    expect(toggleDesktopPanel).toHaveBeenCalledTimes(1);
    expect(openDrawer).not.toHaveBeenCalled();
  });
});
