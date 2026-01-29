import { useState } from 'react';
import { X } from 'lucide-react';

function RuleEditor({ rule, onSave, onClose }) {
  const [formData, setFormData] = useState({
    email_pattern: rule?.email_pattern || '',
    match_type: rule?.match_type || 'exact',
    action: rule?.action || 'move',
    destination_label_name: rule?.destination_label_name || '',
    enabled: rule?.enabled ?? true,
    mark_as_read: rule?.mark_as_read ?? false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              <input
                type="text"
                value={formData.destination_label_name}
                onChange={(e) => setFormData({ ...formData, destination_label_name: e.target.value })}
                placeholder="Work"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
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
