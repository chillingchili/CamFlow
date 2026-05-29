import { PresetGrid } from '../components/PresetGrid';
import { Joystick } from '../components/Joystick';

export function Setup() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          Presets
        </h2>
        <PresetGrid />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          PTZ Control
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Joystick />
        </div>
      </section>
    </div>
  );
}
