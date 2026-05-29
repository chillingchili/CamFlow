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
  let buttonClass =
    'w-full py-5 px-6 rounded-xl text-base font-semibold transition-all duration-200';

  if (isPending) {
    buttonClass +=
      ' ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-offset-1';
  } else if (isActive) {
    buttonClass += ' bg-green-600 text-white shadow-md shadow-green-600/30';
  } else {
    buttonClass +=
      ' bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400';
  }

  return (
    <button
      onClick={onSwitch}
      disabled={isPending}
      className={buttonClass}
      aria-label={label}
    >
      {isPending ? 'Switching...' : label}
    </button>
  );
}

export function CameraSwitcher() {
  const { activeScene, sceneStatus, pendingScene, switchScene } = useCommandState();

  return (
    <div className="space-y-4">
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
  );
}
