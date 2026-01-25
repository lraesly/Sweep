import { useState } from 'react';
import { Plus, X, HelpCircle, FolderPlus, Sparkles } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const DEFAULT_FOLDERS = [
  { name: 'Newsletters', description: 'Email newsletters and digests' },
  { name: 'Shopping', description: 'Order confirmations and shipping updates' },
  { name: 'Receipts', description: 'Purchase receipts and invoices' },
  { name: 'Social', description: 'Social media notifications' },
  { name: 'Travel', description: 'Flight, hotel, and travel bookings' },
  { name: 'Finance', description: 'Bank statements and financial alerts' },
];

function MagicFolderSetup({ onComplete, onSkip }) {
  const [selectedFolders, setSelectedFolders] = useState(
    DEFAULT_FOLDERS.map(f => f.name)
  );
  const [customFolder, setCustomFolder] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState(null);

  const toggleFolder = (name) => {
    setSelectedFolders(prev =>
      prev.includes(name)
        ? prev.filter(f => f !== name)
        : [...prev, name]
    );
  };

  const addCustomFolder = () => {
    const name = customFolder.trim();
    if (name && !selectedFolders.includes(name)) {
      setSelectedFolders(prev => [...prev, name]);
      setCustomFolder('');
    }
  };

  const removeFolder = (name) => {
    setSelectedFolders(prev => prev.filter(f => f !== name));
  };

  const handleCreate = async () => {
    if (selectedFolders.length === 0) {
      onSkip?.();
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const token = await invoke('get_stored_token');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://autosort-backend-405056809295.us-west1.run.app'}/api/v1/magic-folders/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ folders: selectedFolders }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create folders');
      }

      const result = await response.json();
      onComplete?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Sparkles className="text-primary-600 dark:text-primary-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Set Up Magic Folders
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose folders to automatically sort your emails
              </p>
            </div>
          </div>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              How Magic Folders Work
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Magic folders start with @ (e.g., @Newsletters)</li>
              <li>2. Drag any email into a magic folder</li>
              <li>3. A rule is automatically created for that sender</li>
              <li>4. Future emails from that sender go there automatically</li>
            </ul>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Got it
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Select folders to create:
            </span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              <HelpCircle size={16} />
              How does this work?
            </button>
          </div>

          {/* Selected Folders */}
          {selectedFolders.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Folders to create:
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedFolders.map(name => {
                  const defaultFolder = DEFAULT_FOLDERS.find(d => d.name === name);
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-full text-sm"
                    >
                      <span className="text-primary-700 dark:text-primary-300">@{name}</span>
                      <button
                        onClick={() => removeFolder(name)}
                        className="text-primary-400 hover:text-red-500 ml-1"
                        title="Remove folder"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested Folders (only show unselected ones) */}
          {DEFAULT_FOLDERS.filter(f => !selectedFolders.includes(f.name)).length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Suggested folders:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_FOLDERS.filter(f => !selectedFolders.includes(f.name)).map(folder => (
                  <button
                    key={folder.name}
                    onClick={() => toggleFolder(folder.name)}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 text-left transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      @{folder.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {folder.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomFolder()}
                placeholder="Add custom folder..."
                className="w-full pl-7 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={addCustomFolder}
              disabled={!customFolder.trim()}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <Plus size={20} />
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Skip for now
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isCreating ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <FolderPlus size={18} />
                  Create {selectedFolders.length} Folder{selectedFolders.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MagicFolderSetup;
