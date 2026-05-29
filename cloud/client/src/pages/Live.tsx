import { CameraSwitcher } from '../components/CameraSwitcher';

export function Live() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          Camera
        </h2>
        <CameraSwitcher />
      </section>

      {/* Collapsible Joystick placeholder (Task 3) */}
      <section className="mt-8">
        <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-800 dark:hover:text-gray-100 select-none">
            PTZ Joystick
          </summary>
          <div className="p-4 pt-0 text-center text-gray-400">
            PTZ joystick coming soon
          </div>
        </details>
      </section>
    </div>
  );
}
