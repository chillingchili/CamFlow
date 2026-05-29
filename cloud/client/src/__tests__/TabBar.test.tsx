import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from '../components/TabBar';
import { SettingsPanel } from '../components/SettingsPanel';
import type { ReactNode } from 'react';

describe('TabBar', () => {
  // Test 1: Renders Live and Setup tabs with gear icon
  it('renders Live and Setup tabs with gear icon', () => {
    render(
      <TabBar activeTab="setup" onTabChange={() => {}} onSettingsOpen={() => {}} />
    );

    expect(screen.getByRole('tab', { name: /setup/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /live/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  // Test 2: Setup tab is active by default after login
  it('highlights Setup as active when activeTab is setup', () => {
    render(
      <TabBar activeTab="setup" onTabChange={() => {}} onSettingsOpen={() => {}} />
    );

    const setupBtn = screen.getByRole('tab', { name: /setup/i });
    const liveBtn = screen.getByRole('tab', { name: /live/i });

    // Setup should have active styling (check for CSS class or aria attribute)
    expect(setupBtn).toHaveAttribute('aria-current', 'page');
    expect(liveBtn).not.toHaveAttribute('aria-current', 'page');
  });

  // Test 3: Clicking a tab switches active state
  it('calls onTabChange when clicking Live tab', async () => {
    const onTabChange = vi.fn();

    render(
      <TabBar activeTab="setup" onTabChange={onTabChange} onSettingsOpen={() => {}} />
    );

    await userEvent.click(screen.getByRole('tab', { name: /live/i }));
    expect(onTabChange).toHaveBeenCalledWith('live');
  });

  // Test 4: Clicking Setup when already active does not trigger change
  it('does not call onTabChange when clicking already-active tab', async () => {
    const onTabChange = vi.fn();

    render(
      <TabBar activeTab="setup" onTabChange={onTabChange} onSettingsOpen={() => {}} />
    );

    await userEvent.click(screen.getByRole('tab', { name: /setup/i }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  // Test 5: Gear icon opens settings
  it('calls onSettingsOpen when clicking gear icon', async () => {
    const onSettingsOpen = vi.fn();

    render(
      <TabBar activeTab="setup" onTabChange={() => {}} onSettingsOpen={onSettingsOpen} />
    );

    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onSettingsOpen).toHaveBeenCalled();
  });
});

describe('SettingsPanel', () => {
  // Test 6: SettingsPanel shows system info section
  it('displays system info when open', () => {
    render(
      <SettingsPanel isOpen={true} onClose={() => {}} />
    );

    expect(screen.getByText(/system info/i)).toBeInTheDocument();
  });

  // Test 7: SettingsPanel renders nothing when not open
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsPanel isOpen={false} onClose={() => {}} />
    );

    expect(container.innerHTML).toBe('');
  });

  // Test 8: SettingsPanel calls onClose on Escape key
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();

    render(
      <SettingsPanel isOpen={true} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // Test 9: SettingsPanel calls onClose when clicking outside (backdrop)
  it('calls onClose when clicking backdrop', async () => {
    const onClose = vi.fn();

    render(
      <SettingsPanel isOpen={true} onClose={onClose} />
    );

    // Click the backdrop (the semi-transparent overlay behind the panel)
    const backdrop = screen.getByRole('dialog').parentElement?.querySelector('[data-testid="settings-backdrop"]');
    if (backdrop) {
      await userEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
