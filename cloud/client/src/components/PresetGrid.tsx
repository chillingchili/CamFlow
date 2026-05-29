import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './Toast';
import * as api from '../services/api';
import type { Preset } from '../services/api';

function PresetCard({
  preset,
  onUpdate,
  onDragStart,
  onDragOver,
  onDrop,
  index,
}: {
  preset: Preset;
  onUpdate: (id: number, data: Partial<Preset>) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  index: number;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(preset.name);
  const [settleValue, setSettleValue] = useState(String(preset.settle_time));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external preset changes
  useEffect(() => {
    setNameValue(preset.name);
  }, [preset.name]);

  useEffect(() => {
    setSettleValue(String(preset.settle_time));
  }, [preset.settle_time]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const handleNameClick = () => {
    setEditingName(true);
  };

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== preset.name) {
      onUpdate(preset.id, { name: trimmed });
    } else if (!trimmed) {
      // Revert to original if empty
      setNameValue(preset.name);
    }
    setEditingName(false);
  }, [nameValue, preset.name, preset.id, onUpdate]);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitName();
    } else if (e.key === 'Escape') {
      setNameValue(preset.name);
      setEditingName(false);
    }
  };

  const handleSettleBlur = () => {
    const num = parseFloat(settleValue);
    if (!isNaN(num) && num > 0 && num !== preset.settle_time) {
      onUpdate(preset.id, { settle_time: num });
    } else if (isNaN(num) || num <= 0) {
      setSettleValue(String(preset.settle_time));
    }
  };

  const handleToggle = () => {
    onUpdate(preset.id, { active: !preset.active });
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onClick={handleToggle}
      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
        preset.active
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Drag Handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0"
        aria-label={`Drag preset ${preset.ptz_number}`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

      {/* PTZ Number Badge */}
      <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
        {preset.ptz_number}
      </span>

      {/* Name (clickable) */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleNameKeyDown}
            className="w-full text-sm font-medium bg-white dark:bg-gray-700 border border-blue-400 rounded px-2 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Edit preset name"
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-left truncate w-full cursor-pointer"
            aria-label={`Edit name for ${preset.name}`}
          >
            {preset.name}
          </button>
        )}
      </div>

      {/* Settle Time */}
      <div className="flex-shrink-0 w-20">
        <input
          type="number"
          role="spinbutton"
          value={settleValue}
          onChange={(e) => setSettleValue(e.target.value)}
          onBlur={handleSettleBlur}
          step="0.5"
          min="0.5"
          className="w-full text-xs text-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1 py-1 text-gray-700 dark:text-gray-300"
          aria-label={`Settle time for ${preset.name}`}
        />
      </div>

    </div>
  );
}

export function PresetGrid() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { showToast } = useToast();

  // Fetch presets on mount
  useEffect(() => {
    let cancelled = false;
    api
      .getPresets()
      .then((data) => {
        if (!cancelled) {
          setPresets(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          showToast('Failed to load presets', 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleUpdate = useCallback(
    async (id: number, data: Partial<Preset>) => {
      // Optimistic update
      const previous = [...presets];
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );

      try {
        await api.updatePreset(id, data);
      } catch (err) {
        // Revert on error
        setPresets(previous);
        showToast(`Failed to update preset`, 'error');
      }
    },
    [presets, showToast]
  );

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const fromIndex = dragIndex;
      setDragIndex(null);

      if (fromIndex === null || fromIndex === dropIndex) return;

      // Reorder locally
      const reordered = [...presets];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(dropIndex, 0, moved);

      // Update sort_order values
      const updated = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
      setPresets(updated);

      // Persist to server
      const orderPayload = updated.map((p) => ({
        id: p.id,
        sort_order: p.sort_order,
      }));

      try {
        await api.reorderPresets(orderPayload);
      } catch (err) {
        // Revert to original order
        setPresets(presets);
        showToast('Failed to reorder presets', 'error');
      }
    },
    [dragIndex, presets, showToast]
  );

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">Loading presets...</div>
    );
  }

  return (
    <div className="space-y-2">
      {presets.map((preset, index) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          index={index}
          onUpdate={handleUpdate}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
