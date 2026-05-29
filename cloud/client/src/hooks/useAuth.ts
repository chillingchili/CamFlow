import { useCallback } from 'react';
import { useNavigate } from 'react-router';

const TOKEN_KEY = 'camflow_token';

export function useAuth() {
  const navigate = useNavigate();

  const getToken = useCallback((): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  const isAuthenticated = useCallback((): boolean => {
    return getToken() !== null;
  }, [getToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/login');
  }, [navigate]);

  return { getToken, isAuthenticated, logout };
}
