import { useEffect, useRef } from 'react';

export interface KeyMap {
  [key: string]: () => void;
}

interface KeyUpMap {
  [key: string]: () => void;
}

export function useKeyboard(keyDownMap: KeyMap, keyUpMap?: KeyUpMap) {
  const keyDownMapRef = useRef(keyDownMap);
  const keyUpMapRef = useRef(keyUpMap);

  // Keep refs current without re-registering listeners
  useEffect(() => {
    keyDownMapRef.current = keyDownMap;
  }, [keyDownMap]);

  useEffect(() => {
    keyUpMapRef.current = keyUpMap;
  }, [keyUpMap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const handler = keyDownMapRef.current[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const handler = keyUpMapRef.current?.[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (keyUpMap) {
      document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (keyUpMap) {
        document.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [keyUpMap]);
}
