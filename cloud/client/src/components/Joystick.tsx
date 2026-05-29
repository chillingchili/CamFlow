import { useState, useCallback, useRef } from 'react';
import { useKeyboard } from '../hooks/useKeyboard';
import * as api from '../services/api';

function DirectionButton({
  label,
  direction,
  keyHint,
  onPress,
  onRelease,
}: {
  label: string;
  direction: string;
  keyHint: string;
  onPress: (direction: string) => void;
  onRelease: () => void;
}) {
  const pressedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!pressedRef.current) {
      pressedRef.current = true;
      onPress(direction);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pressedRef.current) {
      pressedRef.current = false;
      onRelease();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (pressedRef.current) {
      pressedRef.current = false;
      onRelease();
    }
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="relative flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-blue-100 dark:active:bg-blue-900/30 rounded-xl border border-gray-200 dark:border-gray-600 transition-colors select-none touch-none"
      aria-label={label}
    >
      <svg
        className={`w-5 h-5 text-gray-700 dark:text-gray-200 ${
          label === 'Up' ? '-rotate-90' : label === 'Down' ? 'rotate-90' : label === 'Left' ? 'rotate-180' : ''
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M12 19V5m-7 7l7-7 7 7" />
      </svg>
      <span className="absolute top-0.5 right-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
        {keyHint}
      </span>
    </button>
  );
}

function ZoomButton({
  label,
  direction,
  keyHint,
  onPress,
  onRelease,
}: {
  label: string;
  direction: string;
  keyHint: string;
  onPress: (direction: string) => void;
  onRelease: () => void;
}) {
  const pressedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!pressedRef.current) {
      pressedRef.current = true;
      onPress(direction);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pressedRef.current) {
      pressedRef.current = false;
      onRelease();
    }
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="relative flex items-center justify-center w-12 h-14 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-purple-100 dark:active:bg-purple-900/30 rounded-xl border border-gray-200 dark:border-gray-600 transition-colors select-none touch-none"
      aria-label={label}
    >
      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
        {label === 'Zoom In' ? '+' : '−'}
      </span>
      <span className="absolute top-0.5 right-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
        {keyHint}
      </span>
    </button>
  );
}

export function Joystick() {
  const [panSpeed, setPanSpeed] = useState(50);
  const [zoomSpeed, setZoomSpeed] = useState(50);
  const moveRef = useRef(false);

  const sendMove = useCallback(
    async (direction: string) => {
      moveRef.current = true;
      try {
        await api.ptzMove(direction, panSpeed);
      } catch {
        // Movement failed silently — stop will fire on release
      }
    },
    [panSpeed]
  );

  const sendZoom = useCallback(
    async (direction: string) => {
      moveRef.current = true;
      try {
        await api.ptzZoom(direction, zoomSpeed);
      } catch {
        // Zoom failed silently
      }
    },
    [zoomSpeed]
  );

  const sendStop = useCallback(async () => {
    if (moveRef.current) {
      moveRef.current = false;
      try {
        await api.ptzStop();
      } catch {
        // Stop failed silently
      }
    }
  }, []);

  // Keyboard shortcuts
  const keyDownMap = {
    w: () => sendMove('up'),
    a: () => sendMove('left'),
    s: () => sendMove('down'),
    d: () => sendMove('right'),
    r: () => sendZoom('out'),
    t: () => sendZoom('in'),
    f: () => setPanSpeed((s) => Math.max(1, s - 1)),
    g: () => setPanSpeed((s) => Math.min(100, s + 1)),
    v: () => setZoomSpeed((s) => Math.max(1, s - 1)),
    b: () => setZoomSpeed((s) => Math.min(100, s + 1)),
  };

  const keyUpMap = {
    w: sendStop,
    a: sendStop,
    s: sendStop,
    d: sendStop,
    r: sendStop,
    t: sendStop,
  };

  useKeyboard(keyDownMap, keyUpMap);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Cross D-pad + Zoom buttons row */}
      <div className="flex items-center gap-2">
        {/* D-pad */}
        <div className="grid grid-cols-3 gap-1">
          {/* Empty top-left */}
          <div />
          <DirectionButton
            label="Up"
            direction="up"
            keyHint="W"
            onPress={sendMove}
            onRelease={sendStop}
          />
          {/* Empty top-right */}
          <div />

          <DirectionButton
            label="Left"
            direction="left"
            keyHint="A"
            onPress={sendMove}
            onRelease={sendStop}
          />
          {/* Center stop button */}
          <div className="flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-600">
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">STOP</span>
          </div>
          <DirectionButton
            label="Right"
            direction="right"
            keyHint="D"
            onPress={sendMove}
            onRelease={sendStop}
          />

          {/* Empty bottom-left */}
          <div />
          <DirectionButton
            label="Down"
            direction="down"
            keyHint="S"
            onPress={sendMove}
            onRelease={sendStop}
          />
          {/* Empty bottom-right */}
          <div />
        </div>

        {/* Zoom buttons (to the right of D-pad) */}
        <div className="flex flex-col gap-1 ml-2">
          <ZoomButton
            label="Zoom In"
            direction="in"
            keyHint="T"
            onPress={sendZoom}
            onRelease={sendStop}
          />
          <ZoomButton
            label="Zoom Out"
            direction="out"
            keyHint="R"
            onPress={sendZoom}
            onRelease={sendStop}
          />
        </div>
      </div>

      {/* Speed sliders */}
      <div className="w-full max-w-xs space-y-3">
        {/* Pan Speed */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Pan Speed
            </label>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
              {panSpeed}
              <span className="ml-1 text-[10px]">F/G</span>
            </span>
          </div>
          <input
            type="range"
            role="slider"
            min="1"
            max="100"
            value={panSpeed}
            onChange={(e) => setPanSpeed(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            aria-label="Pan speed"
          />
        </div>

        {/* Zoom Speed */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Zoom Speed
            </label>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
              {zoomSpeed}
              <span className="ml-1 text-[10px]">V/B</span>
            </span>
          </div>
          <input
            type="range"
            role="slider"
            min="1"
            max="100"
            value={zoomSpeed}
            onChange={(e) => setZoomSpeed(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            aria-label="Zoom speed"
          />
        </div>
      </div>
    </div>
  );
}
