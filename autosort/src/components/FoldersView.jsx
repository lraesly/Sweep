import { useState, useEffect } from 'react';
import { Folder, RefreshCw, Trash2, Plus, Sparkles, AlertTriangle, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from './LoadingSpinner';

function FoldersView() {
  const api = useApi();
  const { showToast } = useToast();
  const [magicFolders, setMagicFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [expandedFolder, setExpandedFolder] = useState(null);
  const [folderSettings, setFolderSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(null);

  const fetchFolders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get('/magic-folders/list');
      setMagicFolders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolderSettings = async (folderId) => {
    if (folderSettings[folderId]) return; // Already loaded
    try {
      const settings = await api.get(`/magic-folders/${folderId}/settings`);
      setFolderSettings(prev => ({ ...prev, [folderId]: settings }));
    } catch (err) {
      console.error('Failed to load folder settings:', err);
    }
  };

  const handleExpandFolder = (folderId) => {
    if (expandedFolder === folderId) {
      setExpandedFolder(null);
    } else {
      setExpandedFolder(folderId);
      fetchFolderSettings(folderId);
    }
  };

  const updateFolderSetting = async (folderId, key, value) => {
    setSavingSettings(folderId);
    const currentSettings = folderSettings[folderId] || {};
    const newSettings = { ...currentSettings, [key]: value };
    setFolderSettings(prev => ({ ...prev, [folderId]: newSettings }));

    try {
      await api.put(`/magic-folders/${folderId}/settings`, { [key]: value });
      showToast('success', 'Settings saved');
    } catch (err) {
      // Revert on error
      setFolderSettings(prev => ({ ...prev, [folderId]: currentSettings }));
      showToast('error', 'Failed to save settings');
    } finally {
      setSavingSettings(null);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      await api.post('/magic-folders/create', { folders: [name] });
      setNewFolderName('');
      showToast('success', `Created @${name}`);
      fetchFolders();
    } catch (err) {
      showToast('error', `Failed to create folder: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteFolder = async (folder) => {
    setDeletingFolder(folder.id);
    try {
      const result = await api.delete(`/magic-folders/${folder.id}`);
      showToast('success', `Deleted ${folder.name} and ${result.rules_deleted} associated rule${result.rules_deleted !== 1 ? 's' : ''}`);
      setMagicFolders(prev => prev.filter(f => f.id !== folder.id));
    } catch (err) {
      showToast('error', `Failed to delete folder: ${err.message}`);
    } finally {
      setDeletingFolder(null);
      setShowDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchFolders}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={20} className="text-primary-500" />
            Magic Folders
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag emails to magic folders to automatically create sorting rules
          </p>
        </div>
        <button
          onClick={fetchFolders}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>How magic folders work:</strong> Folders starting with @ automatically learn
          from emails you drag into them. A rule is created for each sender, so future emails
          go to the same folder automatically.
        </p>
      </div>

      {/* Add new folder */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="New folder name..."
            className="w-full pl-7 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleCreateFolder}
          disabled={!newFolderName.trim() || isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {isCreating ? <LoadingSpinner size="small" /> : <Plus size={18} />}
          Add
        </button>
      </div>

      {magicFolders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No magic folders yet. Create one above or in your email client.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {magicFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolder === folder.id}
              onToggleExpand={() => handleExpandFolder(folder.id)}
              settings={folderSettings[folder.id]}
              onUpdateSetting={(key, value) => updateFolderSetting(folder.id, key, value)}
              isSaving={savingSettings === folder.id}
              showDeleteConfirm={showDeleteConfirm === folder.id}
              onShowDeleteConfirm={() => setShowDeleteConfirm(folder.id)}
              onCancelDelete={() => setShowDeleteConfirm(null)}
              onDelete={() => handleDeleteFolder(folder)}
              isDeleting={deletingFolder === folder.id}
            />
          ))}
        </div>
      )}

      <div className="text-sm text-gray-500 dark:text-gray-400">
        {magicFolders.length} magic folder{magicFolders.length !== 1 ? 's' : ''}
      </div>

      {/* Warning about deletion */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 dark:text-amber-200">
          Deleting a magic folder also removes all rules associated with it. Emails already
          sorted will stay in place, but new emails from those senders will no longer be
          automatically sorted.
        </p>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  isExpanded,
  onToggleExpand,
  settings,
  onUpdateSetting,
  isSaving,
  showDeleteConfirm,
  onShowDeleteConfirm,
  onCancelDelete,
  onDelete,
  isDeleting
}) {
  // Don't show archive settings for @Blackhole
  const showArchiveSettings = folder.name !== '@Blackhole';

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <div className="flex items-center gap-3 flex-1">
          {showArchiveSettings ? (
            <button
              onClick={onToggleExpand}
              className="p-1 -ml-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-6" />
          )}
          <Folder size={20} className="text-primary-500" />
          <span className="font-medium">{folder.name}</span>
        </div>

        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Delete folder and rules?</span>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={onCancelDelete}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onShowDeleteConfirm}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete folder and associated rules"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {isExpanded && showArchiveSettings && (
        <div className="px-4 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
            <Archive size={16} />
            <span className="font-medium">Auto-Archive Settings</span>
          </div>

          {!settings ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="small" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Archive read emails */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Archive read emails
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Move read emails out of this folder after a set time
                  </div>
                </div>
                <button
                  onClick={() => onUpdateSetting('archive_read_enabled', !settings.archive_read_enabled)}
                  disabled={isSaving}
                  className={`
                    w-12 h-7 rounded-full transition-colors duration-200
                    ${settings.archive_read_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
                    ${isSaving ? 'opacity-50' : ''}
                  `}
                >
                  <span
                    className={`
                      block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                      ${settings.archive_read_enabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {settings.archive_read_enabled && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">After</span>
                  <input
                    type="number"
                    min="1"
                    max={settings.archive_read_unit === 'hours' ? 720 : 365}
                    value={settings.archive_read_value || 30}
                    onChange={(e) => {
                      const max = settings.archive_read_unit === 'hours' ? 720 : 365;
                      const value = Math.max(1, Math.min(max, parseInt(e.target.value) || 30));
                      onUpdateSetting('archive_read_value', value);
                    }}
                    disabled={isSaving}
                    className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center text-sm disabled:opacity-50"
                  />
                  <select
                    value={settings.archive_read_unit || 'days'}
                    onChange={(e) => onUpdateSetting('archive_read_unit', e.target.value)}
                    disabled={isSaving}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              )}

              {/* Archive unread emails */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Archive unread emails
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Move unread emails out and mark them as read after a set time
                  </div>
                </div>
                <button
                  onClick={() => onUpdateSetting('archive_unread_enabled', !settings.archive_unread_enabled)}
                  disabled={isSaving}
                  className={`
                    w-12 h-7 rounded-full transition-colors duration-200
                    ${settings.archive_unread_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
                    ${isSaving ? 'opacity-50' : ''}
                  `}
                >
                  <span
                    className={`
                      block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                      ${settings.archive_unread_enabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {settings.archive_unread_enabled && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">After</span>
                  <input
                    type="number"
                    min="1"
                    max={settings.archive_unread_unit === 'hours' ? 720 : 365}
                    value={settings.archive_unread_value || 60}
                    onChange={(e) => {
                      const max = settings.archive_unread_unit === 'hours' ? 720 : 365;
                      const value = Math.max(1, Math.min(max, parseInt(e.target.value) || 60));
                      onUpdateSetting('archive_unread_value', value);
                    }}
                    disabled={isSaving}
                    className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center text-sm disabled:opacity-50"
                  />
                  <select
                    value={settings.archive_unread_unit || 'days'}
                    onChange={(e) => onUpdateSetting('archive_unread_unit', e.target.value)}
                    disabled={isSaving}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FoldersView;
