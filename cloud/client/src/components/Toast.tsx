import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

type ToastType = 'error' | 'success';

interface ToastState {
  message: string | null;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: null, type: 'error' });
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      clearTimer();
      // New toast replaces previous — reset then set
      setVisible(false);
      // Use setTimeout to allow transition reset
      setTimeout(() => {
        setToast({ message, type });
        setVisible(true);
      }, 50);

      // Auto-dismiss after 5 seconds
      timerRef.current = setTimeout(() => {
        setVisible(false);
        // Remove from DOM after animation
        setTimeout(() => {
          setToast({ message: null, type: 'error' });
        }, 300);
      }, 5000);
    },
    [clearTimer]
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const bgColor = toast.type === 'error' ? 'bg-red-600' : 'bg-green-600';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.message && (
        <div
          role="alert"
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all duration-300 ${bgColor} ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
