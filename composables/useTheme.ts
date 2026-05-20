import { useEffect } from 'react';
import { storage } from '../lib/storage/adapter';
import type { UserSettings } from '../lib/storage/schema';

type Theme = UserSettings['theme'];

function resolveTheme(setting: Theme): 'dark' | 'light' {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return setting;
}

function applyTheme(setting: Theme) {
  const resolved = resolveTheme(setting);
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Reads UserSettings.theme from storage, resolves system preference,
 * applies data-theme to <html>, and subscribes to future storage changes.
 * Falls back to "dark" if storage is uninitialized.
 */
export function useTheme() {
  useEffect(() => {
    // Subscribe fires immediately with current value, then on each change.
    const unsubscribe = storage.subscribe((root) => {
      applyTheme(root.settings.theme);
    });

    // Also react to system prefers-color-scheme changes when theme === "system"
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      void storage.read().then((root) => {
        if (root.settings.theme === 'system') {
          applyTheme('system');
        }
      });
    };
    mq.addEventListener('change', onSystemChange);

    return () => {
      unsubscribe();
      mq.removeEventListener('change', onSystemChange);
    };
  }, []);
}
