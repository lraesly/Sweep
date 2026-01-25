import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { useLocalStorage } from './useLocalStorage';
import { useToast } from './useToast';

export function useRules() {
  const api = useApi();
  const { showToast } = useToast();

  const [cachedRules, setCachedRules] = useLocalStorage('autosort_rules', []);

  const [rules, setRules] = useState(cachedRules);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (rules.length > 0) {
      setCachedRules(rules);
    }
  }, [rules, setCachedRules]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get('/rules');
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      setError(err.message || 'Failed to load rules');
      setRules(cachedRules);
    } finally {
      setIsLoading(false);
    }
  }, [api, cachedRules]);

  const createRule = useCallback(async (ruleData) => {
    try {
      const newRule = await api.post('/rules', ruleData);
      setRules(prev => [...prev, newRule]);
      showToast('success', 'Rule created');
      return newRule;
    } catch (err) {
      showToast('error', 'Failed to create rule');
      throw err;
    }
  }, [api, showToast]);

  const updateRule = useCallback(async (ruleId, updates) => {
    const previousRules = rules;
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, ...updates } : r
    ));

    try {
      const updated = await api.put(`/rules/${ruleId}`, updates);
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      showToast('success', 'Rule updated');
      return updated;
    } catch (err) {
      setRules(previousRules);
      showToast('error', 'Failed to update rule');
      throw err;
    }
  }, [api, rules, showToast]);

  const deleteRule = useCallback(async (ruleId) => {
    const previousRules = rules;
    setRules(prev => prev.filter(r => r.id !== ruleId));

    try {
      await api.delete(`/rules/${ruleId}`);
      showToast('success', 'Rule deleted');
    } catch (err) {
      setRules(previousRules);
      showToast('error', 'Failed to delete rule');
      throw err;
    }
  }, [api, rules, showToast]);

  return {
    rules,
    isLoading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
  };
}
