import { createContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { useToast } from '../hooks/useToast';
import { API_BASE_URL } from '../constants/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    console.log('checkAuth called');
    setIsLoading(true);
    try {
      const token = await invoke('get_stored_token');
      console.log('checkAuth: got token:', token ? 'yes' : 'no');
      if (token) {
        console.log('checkAuth: validating token with API...');
        const response = await fetch(`${API_BASE_URL}/api/v1/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('checkAuth: API response status:', response.status);

        if (response.ok) {
          console.log('checkAuth: token valid, setting authenticated');
          setIsAuthenticated(true);

          // Ensure Gmail watch is active
          try {
            await fetch(`${API_BASE_URL}/api/v1/watch/start`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('checkAuth: Gmail watch started/renewed');
          } catch (e) {
            console.error('checkAuth: Failed to start watch:', e);
          }
        } else {
          console.log('checkAuth: token invalid, deleting');
          await invoke('delete_token');
          setIsAuthenticated(false);
        }
      } else {
        console.log('checkAuth: no token found');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      console.log('checkAuth: done, setting isLoading false');
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('Starting sign in, API_BASE_URL:', API_BASE_URL);
      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`);
      const { authorization_url } = await loginResponse.json();
      console.log('Got authorization URL');

      const callbackPromise = invoke('start_oauth_callback_server');
      console.log('Started callback server');

      // Give the callback server a moment to start listening
      await new Promise(resolve => setTimeout(resolve, 500));

      await open(authorization_url);
      console.log('Opened browser');

      const code = await callbackPromise;
      console.log('Got auth code:', code ? 'yes' : 'no');

      const tokenResponse = await fetch(`${API_BASE_URL}/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: 'http://localhost:9876/callback'
        })
      });

      console.log('Token response status:', tokenResponse.status);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange error:', errorText);
        throw new Error('Token exchange failed: ' + errorText);
      }

      const tokens = await tokenResponse.json();
      console.log('Got tokens, storing...');

      await invoke('store_token', { token: tokens.access_token });
      console.log('Stored access token');

      if (tokens.refresh_token) {
        await invoke('store_refresh_token', { token: tokens.refresh_token });
        console.log('Stored refresh token');
      }

      console.log('About to setIsAuthenticated(true)');
      setIsAuthenticated(true);
      console.log('setIsAuthenticated(true) called');

      // Start Gmail watch for push notifications
      console.log('Starting Gmail watch...');
      try {
        const watchResponse = await fetch(`${API_BASE_URL}/api/v1/watch/start`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (watchResponse.ok) {
          console.log('Gmail watch started successfully');
        } else {
          console.error('Failed to start Gmail watch:', await watchResponse.text());
        }
      } catch (watchError) {
        console.error('Error starting Gmail watch:', watchError);
      }

      showToast('success', 'Signed in successfully');
      console.log('Sign in complete, isAuthenticated should be true');

    } catch (error) {
      console.error('Sign in failed:', error);
      showToast('error', 'Sign in failed: ' + error.message);
      throw error;
    } finally {
      console.log('Finally block - setting isLoading to false');
      setIsLoading(false);
    }
  }, [showToast]);

  const signOut = useCallback(async () => {
    try {
      await invoke('delete_token');
      await invoke('delete_refresh_token');
      setIsAuthenticated(false);
      setUser(null);
      showToast('success', 'Signed out');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [showToast]);

  const getAccessToken = useCallback(async () => {
    try {
      return await invoke('get_stored_token');
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      signIn,
      signOut,
      getAccessToken,
      checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
