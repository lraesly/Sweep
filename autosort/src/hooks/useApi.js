import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { API_BASE_URL } from '../constants/api';

export function useApi() {
  const { getAccessToken, signOut } = useAuth();

  const request = useCallback(async (endpoint, options = {}) => {
    const token = await getAccessToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${API_BASE_URL}/api/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      await signOut();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API error: ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }, [getAccessToken, signOut]);

  const get = useCallback((endpoint) => {
    return request(endpoint, { method: 'GET' });
  }, [request]);

  const post = useCallback((endpoint, data) => {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [request]);

  const put = useCallback((endpoint, data) => {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }, [request]);

  const del = useCallback((endpoint) => {
    return request(endpoint, { method: 'DELETE' });
  }, [request]);

  return { get, post, put, delete: del, request };
}
