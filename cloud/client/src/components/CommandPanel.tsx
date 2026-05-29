import { useCommandState } from '../hooks/useCommandState';

function CameraButton({
  label,
  isActive,
  isPending,
  onSwitch,
}: {
  label: string;
  isActive: boolean;
  isPending: boolean;
  onSwitch: () => void;
}) {
  let buttonClass = 'w-full py-4 px-4 rounded-xl text-sm font-semibold transition-all duration-200';

  if (isPending) {
    buttonClass += ' ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
  } else if (isActive) {
    buttonClass += ' bg-green-600 text-white shadow-md';
  } else {
    buttonClass += ' bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400';
  }

  return (
    <button
      onClick={onSwitch}
      disabled={isPending}
      className={buttonClass}
      aria-label={label}
    >
      {isPending ? `Switching...` : label}
    </button>
  );
}

function PresetCard({
  number,
  isPending,
  pendingType,
  onRecall,
  onSave,
}: {
  number: number;
  isPending: boolean;
  pendingType: 'recall' | 'save' | null;
  onRecall: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        Preset {number}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={onRecall}
          disabled={isPending}
          className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white"
          aria-label={`Recall ${number}`}
        >
          {isPending && pendingType === 'recall' ? 'Recalling...' : 'Recall'}
        </button>
        <button
          onClick={onSave}
          disabled={isPending}
          className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white"
          aria-label={`Save ${number}`}
        >
          {isPending && pendingType === 'save' ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function CommandPanel() {
  const {
    activeScene,
    sceneStatus,
    pendingScene,
    presetStatuses,
    pendingPresets,
    switchScene,
    recallPreset,
    savePreset,
  } = useCommandState();

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Camera Switcher */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Camera
          </h2>
          <div className="space-y-3">
            <CameraButton
              label="Cam 1 PTZ"
              isActive={activeScene === 'Cam 1 PTZ'}
              isPending={pendingScene === 'Cam 1 PTZ' && sceneStatus === 'pending'}
              onSwitch={() => switchScene('Cam 1 PTZ')}
            />
            <CameraButton
              label="Cam 2 Wide"
              isActive={activeScene === 'Cam 2 Wide'}
              isPending={pendingScene === 'Cam 2 Wide' && sceneStatus === 'pending'}
              onSwitch={() => switchScene('Cam 2 Wide')}
            />
          </div>
        </section>

        {/* Right: PTZ Presets */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            PTZ Presets
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
              <PresetCard
                key={num}
                number={num}
                isPending={presetStatuses[num] === 'pending'}
                pendingType={pendingPresets[num] || null}
                onRecall={() => recallPreset(num)}
                onSave={() => savePreset(num)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
