import { useState, useEffect, useContext } from 'react';
import { Moon, Sun, LogOut, FolderPlus, Eye, Trash2 } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

function SettingsView() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { signOut } = useAuth();
  const api = useApi();
  const { showToast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isTogglingWatch, setIsTogglingWatch] = useState(false);
  const [settings, setSettings] = useState({
    blackhole_enabled: true,
    blackhole_delete_days: 7
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    loadSettings();
    loadWatchStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadWatchStatus = async () => {
    try {
      const status = await api.get('/watch/status');
      setIsWatching(status.watching);
    } catch (err) {
      console.error('Failed to load watch status:', err);
    }
  };

  const handleToggleWatch = async () => {
    setIsTogglingWatch(true);
    try {
      if (isWatching) {
        await api.post('/watch/stop');
        setIsWatching(false);
        showToast('success', 'Stopped watching for new emails');
      } else {
        await api.post('/watch/start');
        setIsWatching(true);
        showToast('success', 'Now watching for new emails');
      }
    } catch (err) {
      showToast('error', `Failed to ${isWatching ? 'stop' : 'start'} watching`);
    } finally {
      setIsTogglingWatch(false);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setIsSavingSettings(true);
    try {
      await api.put('/settings', { [key]: value });
      showToast('success', 'Settings saved');
    } catch (err) {
      // Revert on error
      setSettings(settings);
      showToast('error', 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetupMagicFolders = async () => {
    setIsSettingUp(true);
    try {
      const result = await api.post('/magic-folders/setup');
      showToast('success', result.message);
    } catch (err) {
      showToast('error', 'Failed to set up magic folders');
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Settings</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        <SettingRow
          icon={isDark ? Moon : Sun}
          title="Dark Mode"
          description="Toggle dark mode appearance"
          action={
            <button
              onClick={toggleTheme}
              className={`
                w-12 h-7 rounded-full transition-colors duration-200
                ${isDark ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <span
                className={`
                  block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                  ${isDark ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          }
        />

        <SettingRow
          icon={Trash2}
          title="@Blackhole Folder"
          description="Emails in @Blackhole are auto-deleted after a set time"
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateSetting('blackhole_enabled', !settings.blackhole_enabled)}
                disabled={isLoadingSettings || isSavingSettings}
                className={`
                  w-12 h-7 rounded-full transition-colors duration-200
                  ${settings.blackhole_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
                  ${(isLoadingSettings || isSavingSettings) ? 'opacity-50' : ''}
                `}
              >
                <span
                  className={`
                    block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                    ${settings.blackhole_enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          }
        />

        {settings.blackhole_enabled && (
          <SettingRow
            icon={() => <span className="text-gray-400 text-sm">Days</span>}
            title="Auto-delete after"
            description="Emails in @Blackhole older than this will be permanently deleted"
            action={
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.blackhole_delete_days}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(365, parseInt(e.target.value) || 7));
                    updateSetting('blackhole_delete_days', value);
                  }}
                  disabled={isLoadingSettings || isSavingSettings}
                  className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center disabled:opacity-50"
                />
                <span className="text-sm text-gray-500">days</span>
              </div>
            }
          />
        )}

        <SettingRow
          icon={FolderPlus}
          title="Magic Folders"
          description="Create magic folders in your Gmail account"
          action={
            <button
              onClick={handleSetupMagicFolders}
              disabled={isSettingUp}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
            >
              {isSettingUp ? 'Setting up...' : 'Set Up Folders'}
            </button>
          }
        />

        <SettingRow
          icon={Eye}
          title="Email Watching"
          description={isWatching ? "Sweep is monitoring your inbox for new emails" : "Enable to automatically process new emails"}
          action={
            <button
              onClick={handleToggleWatch}
              disabled={isTogglingWatch}
              className={`
                w-12 h-7 rounded-full transition-colors duration-200
                ${isWatching ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                ${isTogglingWatch ? 'opacity-50' : ''}
              `}
            >
              <span
                className={`
                  block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200
                  ${isWatching ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          }
        />

        <SettingRow
          icon={LogOut}
          title="Sign Out"
          description="Sign out of your Google account"
          action={
            <button
              onClick={signOut}
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
            >
              Sign Out
            </button>
          }
        />
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Icon size={20} className="text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default SettingsView;
