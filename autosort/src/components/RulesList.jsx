import { useState, useMemo } from 'react';
import { Plus, Search, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useRules } from '../hooks/useRules';
import RuleRow from './RuleRow';
import RuleEditor from './RuleEditor';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

const SORT_COLUMNS = {
  STATUS: 'enabled',
  PATTERN: 'email_pattern',
  MATCH_TYPE: 'match_type',
  DESTINATION: 'destination_label_name',
  CREATED: 'created_at',
  USED: 'times_applied'
};

function RulesList() {
  const {
    rules,
    isLoading,
    error,
    refresh,
    updateRule,
    deleteRule,
    createRule
  } = useRules();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortColumn, setSortColumn] = useState(SORT_COLUMNS.CREATED);
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedAndFilteredRules = useMemo(() => {
    let filtered = rules.filter(rule =>
      rule.email_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rule.destination_label_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle boolean (enabled status)
      if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }

      // Handle dates
      if (sortColumn === 'created_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      const comparison = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rules, searchQuery, sortColumn, sortDirection]);

  const handleToggleEnabled = async (rule) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
  };

  const handleDelete = async (rule) => {
    await deleteRule(rule.id);
  };

  const handleSaveRule = async (ruleData) => {
    if (editingRule) {
      await updateRule(editingRule.id, ruleData);
      setEditingRule(null);
    } else {
      await createRule(ruleData);
      setShowCreateModal(false);
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={refresh}
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
        <div className="relative flex-1 max-w-sm">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={18} />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {isLoading && rules.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : sortedAndFilteredRules.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching rules" : "No rules yet"}
          description={
            searchQuery
              ? "Try a different search term"
              : "Drag emails to magic folders (starting with @) in your email client to create rules automatically, or click 'Add Rule' to create one manually."
          }
          action={
            !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create First Rule
              </button>
            )
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <SortableHeader
              label="Status"
              column={SORT_COLUMNS.STATUS}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-1"
            />
            <SortableHeader
              label="Email Pattern"
              column={SORT_COLUMNS.PATTERN}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-3"
            />
            <SortableHeader
              label="Match"
              column={SORT_COLUMNS.MATCH_TYPE}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-1"
            />
            <SortableHeader
              label="Destination"
              column={SORT_COLUMNS.DESTINATION}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-3"
            />
            <SortableHeader
              label="Created"
              column={SORT_COLUMNS.CREATED}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-2"
            />
            <SortableHeader
              label="Used"
              column={SORT_COLUMNS.USED}
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="col-span-1 justify-end"
            />
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedAndFilteredRules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => setEditingRule(rule)}
                onToggleEnabled={() => handleToggleEnabled(rule)}
                onDelete={() => handleDelete(rule)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{sortedAndFilteredRules.length} rules{searchQuery && ` matching "${searchQuery}"`}</span>
        <span>{rules.filter(r => r.enabled).length} active</span>
      </div>

      {editingRule && (
        <RuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}

      {showCreateModal && (
        <RuleEditor
          onSave={handleSaveRule}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function SortableHeader({ label, column, currentColumn, direction, onSort, className = '' }) {
  const isActive = currentColumn === column;

  return (
    <button
      onClick={() => onSort(column)}
      className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors ${className}`}
    >
      <span>{label}</span>
      <span className="flex flex-col">
        <ChevronUp
          size={12}
          className={`-mb-1 ${isActive && direction === 'asc' ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`}
        />
        <ChevronDown
          size={12}
          className={`${isActive && direction === 'desc' ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`}
        />
      </span>
    </button>
  );
}

export default RulesList;
