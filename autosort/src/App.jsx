import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useApi } from './hooks/useApi';
import Navigation from './components/Navigation';
import RulesList from './components/RulesList';
import FoldersView from './components/FoldersView';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import OnboardingFlow from './components/OnboardingFlow';
import MagicFolderSetup from './components/MagicFolderSetup';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';

const TABS = {
  RULES: 'rules',
  FOLDERS: 'folders',
  STATS: 'stats',
  SETTINGS: 'settings',
};

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const api = useApi();
  const [activeTab, setActiveTab] = useState(TABS.RULES);
  const [showSetup, setShowSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if user needs to complete setup after authentication
  useEffect(() => {
    if (isAuthenticated) {
      checkMagicFolders();
    } else {
      setCheckingSetup(false);
    }
  }, [isAuthenticated]);

  const checkMagicFolders = async () => {
    try {
      // Check if user already has magic folders in Gmail
      const folders = await api.get('/magic-folders/list');
      if (!folders || folders.length === 0) {
        setShowSetup(true);
      }
    } catch (err) {
      console.error('Failed to check magic folders:', err);
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
  };

  const handleSetupSkip = () => {
    setShowSetup(false);
  };

  if (isLoading || (isAuthenticated && checkingSetup)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 1024 1024" className="rounded-lg">
              <defs>
                <linearGradient id="sweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#63F2D6"/>
                  <stop offset="50%" stopColor="#4AA6FF"/>
                  <stop offset="100%" stopColor="#3B5CFF"/>
                </linearGradient>
              </defs>
              <rect width="1024" height="1024" rx="180" fill="#1B1C3A"/>
              <path
                d="M 736,312 C 672,256 552,272 472,352 C 368,400 384,456 496,480 C 608,512 688,512 624,552 C 552,608 552,672 512,672 C 464,736 376,704 336,608 C 304,592 304,576 320,552"
                fill="none"
                stroke="url(#sweepGradient)"
                strokeWidth="120"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g transform="translate(722, 292)">
                <rect x="-7" y="-45" width="14" height="90" rx="7" fill="#9EF2FF"/>
                <rect x="-45" y="-7" width="90" height="14" rx="7" fill="#9EF2FF"/>
              </g>
            </svg>
            <h1 className="text-xl font-semibold">Sweep</h1>
          </div>
          <Navigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={TABS}
          />
        </div>
      </header>

      <main className="p-4">
        {activeTab === TABS.RULES && <RulesList />}
        {activeTab === TABS.FOLDERS && <FoldersView />}
        {activeTab === TABS.STATS && <StatsView />}
        {activeTab === TABS.SETTINGS && <SettingsView />}
      </main>

      <Toast />

      {showSetup && (
        <MagicFolderSetup
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}
    </div>
  );
}

export default App;
