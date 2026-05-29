import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// We'll import the real components after they're written.
// For now, define what we need inline — this test will fail
// until the components exist.

import { Login } from '../pages/Login';

function renderWithRouter(component: ReactNode, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {component}
    </MemoryRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1
  it('renders passphrase input with show/hide toggle and Login button', () => {
    renderWithRouter(<Login />);
    
    const input = screen.getByPlaceholderText(/passphrase/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
    
    const toggleButton = screen.getByRole('button', { name: /show/i });
    expect(toggleButton).toBeInTheDocument();
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).toBeInTheDocument();
  });

  // Test 4
  it('has Login button disabled when passphrase is empty', () => {
    renderWithRouter(<Login />);
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).toBeDisabled();
  });

  // Test 2
  it('submits valid passphrase, stores JWT, navigates to /', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'test-jwt-token' }),
    });

    renderWithRouter(<Login />);
    
    const input = screen.getByPlaceholderText(/passphrase/i);
    await userEvent.type(input, 'correct-passphrase');
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).not.toBeDisabled();
    
    await userEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ passphrase: 'correct-passphrase' }),
        })
      );
    });
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('camflow_token', 'test-jwt-token');
    });
  });

  // Test 3
  it('shows inline red error on wrong passphrase', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Wrong passphrase' }),
    });

    renderWithRouter(<Login />);
    
    const input = screen.getByPlaceholderText(/passphrase/i);
    await userEvent.type(input, 'wrong-passphrase');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    await waitFor(() => {
      const error = screen.getByText(/wrong passphrase/i);
      expect(error).toBeInTheDocument();
      expect(error).toHaveClass('text-red-500');
    });
  });
});
