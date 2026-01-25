import { Pencil, Trash2, MoreVertical, Folder, Ban } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const MATCH_TYPE_LABELS = {
  exact: 'Exact',
  domain: 'Domain',
  contains: 'Contains',
};

function RuleRow({ rule, onEdit, onToggleEnabled, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = () => {
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 120);
    }
    setShowMenu(!showMenu);
  };

  const isBlockRule = rule.action === 'block_delete';

  return (
    <div
      className={`
        grid grid-cols-12 gap-4 px-4 py-3 items-center
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        ${!rule.enabled ? 'opacity-50' : ''}
      `}
    >
      <div className="col-span-1">
        <button
          onClick={onToggleEnabled}
          className={`
            w-10 h-6 rounded-full transition-colors duration-200
            ${rule.enabled
              ? 'bg-green-500'
              : 'bg-gray-300 dark:bg-gray-600'}
          `}
        >
          <span
            className={`
              block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${rule.enabled ? 'translate-x-5' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      <div className="col-span-4 min-w-0">
        <span className="font-medium text-gray-900 dark:text-gray-100 block truncate" title={rule.email_pattern}>
          {rule.email_pattern}
        </span>
      </div>

      <div className="col-span-2">
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {MATCH_TYPE_LABELS[rule.match_type] || rule.match_type}
        </span>
      </div>

      <div className="col-span-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {isBlockRule ? (
            <>
              <Ban size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-red-600 dark:text-red-400 truncate">Block & Delete</span>
            </>
          ) : (
            <>
              <Folder size={16} className="text-blue-500 flex-shrink-0" />
              <span className="truncate" title={rule.destination_label_name || 'Unknown'}>{rule.destination_label_name || 'Unknown'}</span>
            </>
          )}
        </div>
      </div>

      <div className="col-span-1 text-right">
        <span className="text-gray-500 dark:text-gray-400">
          {rule.times_applied || 0}x
        </span>
      </div>

      <div className="col-span-1 text-right relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <MoreVertical size={18} />
        </button>

        {showMenu && (
          <div className={`absolute right-0 z-50 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 ${openUpward ? 'bottom-8' : 'top-8'}`}>
            <button
              onClick={() => {
                setShowMenu(false);
                onEdit();
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onDelete();
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RuleRow;
