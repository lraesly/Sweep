import { List, FolderCog, BarChart2, Settings } from 'lucide-react';

function Navigation({ activeTab, onTabChange, tabs }) {
  const navItems = [
    { id: tabs.RULES, label: 'Rules', icon: List },
    { id: tabs.FOLDERS, label: 'Folders', icon: FolderCog },
    { id: tabs.STATS, label: 'Stats', icon: BarChart2 },
    { id: tabs.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              transition-colors duration-150
              ${isActive
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default Navigation;
