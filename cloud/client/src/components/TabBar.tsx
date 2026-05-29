interface TabBarProps {
  activeTab: 'setup' | 'live';
  onTabChange: (tab: 'setup' | 'live') => void;
  onSettingsOpen: () => void;
}

export function TabBar({ activeTab, onTabChange, onSettingsOpen }: TabBarProps) {
  const baseTabClass =
    'px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px';
  const activeClass = 'border-blue-500 text-blue-600';
  const inactiveClass =
    'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200';

  const handleTabClick = (tab: 'setup' | 'live') => {
    if (tab !== activeTab) {
      onTabChange(tab);
    }
  };

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4">
      <nav className="flex gap-1" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'setup'}
          aria-current={activeTab === 'setup' ? 'page' : undefined}
          className={`${baseTabClass} ${activeTab === 'setup' ? activeClass : inactiveClass}`}
          onClick={() => handleTabClick('setup')}
          aria-label="Setup"
        >
          Setup
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'live'}
          aria-current={activeTab === 'live' ? 'page' : undefined}
          className={`${baseTabClass} ${activeTab === 'live' ? activeClass : inactiveClass}`}
          onClick={() => handleTabClick('live')}
          aria-label="Live"
        >
          Live
        </button>
      </nav>

      <div className="ml-auto">
        <button
          onClick={onSettingsOpen}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
