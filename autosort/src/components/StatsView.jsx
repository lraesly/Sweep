import { useState, useEffect } from 'react';
import { Mail, ListChecks, Clock, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import LoadingSpinner from './LoadingSpinner';

function StatsView() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get('/stats');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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
          onClick={fetchStats}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Processing Statistics</h2>
        <button
          onClick={fetchStats}
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
