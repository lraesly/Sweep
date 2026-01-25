import { useState } from 'react';
import { Mail, Shield, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

function OnboardingFlow() {
  const { signIn, isLoading } = useAuth();
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <svg width="64" height="64" viewBox="0 0 1024 1024" className="rounded-2xl mx-auto mb-4">
            <defs>
              <linearGradient id="sweepGradientOnboard" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#63F2D6"/>
                <stop offset="50%" stopColor="#4AA6FF"/>
                <stop offset="100%" stopColor="#3B5CFF"/>
              </linearGradient>
            </defs>
            <rect width="1024" height="1024" rx="180" fill="#1B1C3A"/>
            <path
              d="M 736,312 C 672,256 552,272 472,352 C 368,400 384,456 496,480 C 608,512 688,512 624,552 C 552,608 552,672 512,672 C 464,736 376,704 336,608 C 304,592 304,576 320,552"
              fill="none"
              stroke="url(#sweepGradientOnboard)"
              strokeWidth="120"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g transform="translate(722, 292)">
              <rect x="-7" y="-45" width="14" height="90" rx="7" fill="#9EF2FF"/>
              <rect x="-45" y="-7" width="90" height="14" rx="7" fill="#9EF2FF"/>
            </g>
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Sweep
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Automatically sort your emails with magic folders
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <Feature
            icon={Mail}
            title="Magic Folders"
            description="Drag emails to special folders to create sorting rules"
          />
          <Feature
            icon={Zap}
            title="Real-time Processing"
            description="New emails are sorted automatically as they arrive"
          />
          <Feature
            icon={Shield}
            title="Secure"
            description="Your credentials are stored securely on your device"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {isLoading ? (
            <LoadingSpinner size="small" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, description }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
        <Icon size={20} className="text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}

export default OnboardingFlow;
