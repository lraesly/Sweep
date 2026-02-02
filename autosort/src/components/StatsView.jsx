import { useState, useEffect, useMemo } from 'react';
import { Mail, ListChecks, Clock, RefreshCw, Trophy } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import LoadingSpinner from './LoadingSpinner';

function StatsView() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, rulesData] = await Promise.all([
        api.get('/stats'),
        api.get('/rules'),
      ]);
      setStats(statsData);
      setRules(rulesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const topRules = useMemo(() => {
    return [...rules]
      .filter(r => r.times_applied > 0)
      .sort((a, b) => b.times_applied - a.times_applied)
      .slice(0, 10);
  }, [rules]);

  const folderStats = useMemo(() => {
    const byFolder = {};
    rules.forEach(rule => {
      const folder = rule.destination_label_name || (rule.action === 'block_delete' ? 'Blocked' : 'Other');
      if (!byFolder[folder]) byFolder[folder] = 0;
      byFolder[folder] += rule.times_applied;
    });
    return Object.entries(byFolder)
      .map(([name, count]) => ({ name, count }))
      .filter(f => f.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [rules]);

  const readByFolder = useMemo(() => {
    const byFolder = {};
    rules.forEach(rule => {
      const folder = rule.destination_label_name;
      if (!folder || rule.times_applied === 0) return;
      if (!byFolder[folder]) byFolder[folder] = { move: 0, readArchive: 0 };
      if (rule.action === 'read_archive') {
        byFolder[folder].readArchive += rule.times_applied;
      } else if (rule.action === 'move') {
        byFolder[folder].move += rule.times_applied;
      }
    });
    return Object.entries(byFolder)
      .map(([name, data]) => ({
        name,
        move: data.move,
        readArchive: data.readArchive,
        total: data.move + data.readArchive,
      }))
      .filter(f => f.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [rules]);

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
          onClick={fetchData}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const maxFolderCount = folderStats.length > 0 ? folderStats[0].count : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Processing Statistics</h2>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Mail}
          label="Emails Processed"
          value={stats?.emails_processed || 0}
          color="blue"
        />
        <StatCard
          icon={ListChecks}
          label="Active Rules"
          value={stats?.rules_count || 0}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Last Processed"
          value={formatDate(stats?.last_processed_at)}
          isText
          color="purple"
        />
      </div>

      {/* Top Rules */}
      {topRules.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Top Rules</h3>
          </div>
          <div className="space-y-3">
            {topRules.map((rule, i) => (
              <div key={rule.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {rule.email_pattern}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                      {rule.times_applied.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${(rule.times_applied / topRules[0].times_applied) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails by Folder */}
      {folderStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Emails by Folder</h3>
          <div className="space-y-3">
            {folderStats.map(folder => (
              <div key={folder.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {folder.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                    {folder.count.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(folder.count / maxFolderCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read by Folder */}
      {readByFolder.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Read by Folder</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            User read vs. marked read by Sweep before archiving
          </p>
          <div className="space-y-3">
            {readByFolder.map(folder => {
              const movePct = folder.total > 0 ? (folder.move / folder.total) * 100 : 0;
              const readArchivePct = folder.total > 0 ? (folder.readArchive / folder.total) * 100 : 0;
              return (
                <div key={folder.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {folder.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                      {folder.total.toLocaleString()} total
                    </span>
                  </div>
                  <div className="w-full flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                    {movePct > 0 && (
                      <div
                        className="bg-emerald-500 h-2"
                        style={{ width: `${movePct}%` }}
                        title={`User read: ${folder.move} (${Math.round(movePct)}%)`}
                      />
                    )}
                    {readArchivePct > 0 && (
                      <div
                        className="bg-violet-500 h-2"
                        style={{ width: `${readArchivePct}%` }}
                        title={`Sweep read: ${folder.readArchive} (${Math.round(readArchivePct)}%)`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>User read</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span>Sweep read</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, isText = false, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`${isText ? 'text-sm' : 'text-2xl'} font-semibold text-gray-900 dark:text-white`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default StatsView;
