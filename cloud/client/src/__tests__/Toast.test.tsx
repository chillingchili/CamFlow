import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/Toast';
import { useContext, createContext } from 'react';
import type { ReactNode } from 'react';

// Test component that uses toast
function ToastTrigger({ message, type }: { message: string; type: 'error' | 'success' }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>Show Toast</button>;
}

function renderWithProvider(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appears with error message when triggered', async () => {
    renderWithProvider(<ToastTrigger message="Something went wrong" type="error" />);

    // Click to trigger toast
    act(() => {
      screen.getByText('Show Toast').click();
    });

    // Advance timers to let the toast appear (50ms delay in showToast)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', async () => {
    renderWithProvider(<ToastTrigger message="Temporary message" type="success" />);

    act(() => {
      screen.getByText('Show Toast').click();
    });

    // Let the toast appear
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Temporary message')).toBeInTheDocument();

    // Advance time by 5 seconds (auto-dismiss)
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Wait for exit animation (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();
  });

  it('new toast replaces previous toast', async () => {
    // Use two different messages to test replacement
    let messageToShow = 'First message';
    function DynamicTrigger() {
      const { showToast } = useToast();
      return (
        <button
          onClick={() => {
            showToast(messageToShow, 'error');
            messageToShow = 'Second message';
          }}
        >
          Show Toast
        </button>
      );
    }

    renderWithProvider(<DynamicTrigger />);

    // Click once — shows "First message"
    act(() => {
      screen.getByText('Show Toast').click();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('First message')).toBeInTheDocument();

    // Click again — should show "Second message", replacing the first
    act(() => {
      screen.getByText('Show Toast').click();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // First message should be gone, second should be visible
    expect(screen.queryByText('First message')).not.toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });
});
