import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useApi } from '../hooks/useApi';

function RuleEditor({ rule, onSave, onClose }) {
  const api = useApi();
  const [formData, setFormData] = useState({
    email_pattern: rule?.email_pattern || '',
    match_type: rule?.match_type || 'exact',
    action: rule?.action || 'move',
    destination_label_id: rule?.destination_label_id || '',
    destination_label_name: rule?.destination_label_name || '',
    enabled: rule?.enabled ?? true,
    mark_as_read: rule?.mark_as_read ?? false,
  });
  const [folders, setFolders] = useState(null);
  const [foldersError, setFoldersError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/magic-folders/list')
      .then((data) => { if (!cancelled) setFolders(data || []); })
      .catch((err) => {
        console.error('Failed to load folders:', err);
        if (!cancelled) setFoldersError(true);
      });
    return () => { cancelled = true; };
    // Fetch once on mount; useApi returns a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Include the rule's current destination even if it isn't a magic folder,
  // so editing a rule never silently drops its folder.
  const folderOptions = (() => {
    if (!folders) return [];
    const list = [...folders];
    if (formData.destination_label_id && !list.some(f => f.id === formData.destination_label_id)) {
      list.unshift({ id: formData.destination_label_id, name: formData.destination_label_name });
    }
    return list;
  })();

  const handleFolderChange = (e) => {
    const folder = folderOptions.find(f => f.id === e.target.value);
    setFormData({
      ...formData,
      destination_label_id: folder?.id || '',
      destination_label_name: folder?.name || '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.action === 'move') {
      // Always send both fields together so the backend stores a matching pair.
      if (!payload.destination_label_id) delete payload.destination_label_id;
    } else {
      delete payload.destination_label_id;
      delete payload.destination_label_name;
    }
    onSave(payload);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {rule ? 'Edit Rule' : 'Create Rule'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Pattern
            </label>
            <input
              type="text"
              value={formData.email_pattern}
              onChange={(e) => setFormData({ ...formData, email_pattern: e.target.value })}
              placeholder="sender@example.com"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Match Type
            </label>
            <select
              value={formData.match_type}
              onChange={(e) => setFormData({ ...formData, match_type: e.target.value })}
              className={inputClass}
            >
              <option value="exact">Exact Match</option>
              <option value="domain">Domain Match</option>
              <option value="contains">Contains</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action
            </label>
            <select
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              className={inputClass}
            >
              <option value="move">Move to Folder</option>
              <option value="block_delete">Block & Delete</option>
              <option value="read_archive">Mark Read & Archive</option>
            </select>
          </div>

          {formData.action === 'move' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destination Folder
              </label>
              {foldersError ? (
                <input
                  type="text"
                  value={formData.destination_label_name}
                  onChange={(e) => setFormData({
                    ...formData,
                    destination_label_id: '',
                    destination_label_name: e.target.value,
                  })}
                  placeholder="@Work"
                  className={inputClass}
                  required
                />
              ) : (
                <select
                  value={formData.destination_label_id}
                  onChange={handleFolderChange}
                  disabled={!folders}
                  className={inputClass}
                  required
                >
                  <option value="">
                    {folders ? 'Select a folder…' : 'Loading folders…'}
                  </option>
                  {folderOptions.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Rule enabled
              </label>
            </div>
            {formData.action === 'move' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mark_as_read"
                  checked={formData.mark_as_read}
                  onChange={(e) => setFormData({ ...formData, mark_as_read: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="mark_as_read" className="text-sm text-gray-700 dark:text-gray-300">
                  Mark as read
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RuleEditor;
