import { useState, useRef, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useWebSocket, type CommandResult } from './useWebSocket';
import * as api from '../services/api';

type CommandStatus = 'idle' | 'pending' | 'ok' | 'error';

export function useCommandState() {
  const { onCommandResult } = useWebSocket();
  const { showToast } = useToast();

  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [sceneStatus, setSceneStatus] = useState<CommandStatus>('idle');
  const [pendingScene, setPendingScene] = useState<string | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);
  const [presetStatuses, setPresetStatuses] = useState<Record<number, CommandStatus>>({});
  const [pendingPresets, setPendingPresets] = useState<Record<number, 'recall' | 'save' | null>>({});

  const executeCommand = useCallback(
    (
      requestId: string,
      action: string,
      onSuccess: () => void,
      onError: () => void
    ) => {
      // Latest-command-wins: replace any pending callback
      pendingRequestIdRef.current = requestId;

      onCommandResult(requestId, (result: CommandResult) => {
        if (result.requestId !== pendingRequestIdRef.current) {
          // A newer command replaced this one — ignore
          return;
        }
        pendingRequestIdRef.current = null;

        if (result.status === 'ok') {
          onSuccess();
        } else {
          showToast(`${action} failed: ${result.error || 'unknown error'}`, 'error');
          onError();
        }
      });
    },
    [onCommandResult, showToast]
  );

  const switchScene = useCallback(
    async (sceneName: string) => {
      setSceneStatus('pending');
      setPendingScene(sceneName);

      try {
        const { requestId } = await api.switchScene(sceneName);
        executeCommand(
          requestId,
          `Switch to ${sceneName}`,
          () => {
            setActiveScene(sceneName);
            setSceneStatus('ok');
            setPendingScene(null);
            // Brief highlight then back to idle
            setTimeout(() => setSceneStatus('idle'), 2000);
          },
          () => {
            setSceneStatus('error');
            setPendingScene(null);
          }
        );
      } catch {
        setSceneStatus('error');
        setPendingScene(null);
        showToast(`Switch to ${sceneName} failed`, 'error');
      }
    },
    [executeCommand, showToast]
  );

  const recallPreset = useCallback(
    async (presetNumber: number) => {
      setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'pending' }));
      setPendingPresets(prev => ({ ...prev, [presetNumber]: 'recall' }));

      try {
        const { requestId } = await api.recallPreset(presetNumber);
        executeCommand(
          requestId,
          `Recall preset ${presetNumber}`,
          () => {
            setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'ok' }));
            setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
            setTimeout(() => {
              setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'idle' }));
            }, 2000);
          },
          () => {
            setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'error' }));
            setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
            setTimeout(() => {
              setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'idle' }));
            }, 2000);
          }
        );
      } catch {
        setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'error' }));
        setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
        showToast(`Recall preset ${presetNumber} failed`, 'error');
      }
    },
    [executeCommand, showToast]
  );

  const savePreset = useCallback(
    async (presetNumber: number) => {
      setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'pending' }));
      setPendingPresets(prev => ({ ...prev, [presetNumber]: 'save' }));

      try {
        const { requestId } = await api.savePreset(presetNumber);
        executeCommand(
          requestId,
          `Save preset ${presetNumber}`,
          () => {
            setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'ok' }));
            setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
            setTimeout(() => {
              setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'idle' }));
            }, 2000);
          },
          () => {
            setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'error' }));
            setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
            setTimeout(() => {
              setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'idle' }));
            }, 2000);
          }
        );
      } catch {
        setPresetStatuses(prev => ({ ...prev, [presetNumber]: 'error' }));
        setPendingPresets(prev => ({ ...prev, [presetNumber]: null }));
        showToast(`Save preset ${presetNumber} failed`, 'error');
      }
    },
    [executeCommand, showToast]
  );

  return {
    activeScene,
    sceneStatus,
    pendingScene,
    presetStatuses,
    pendingPresets,
    switchScene,
    recallPreset,
    savePreset,
  };
}
