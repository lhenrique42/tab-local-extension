import { useState } from 'react';
import { storage } from '../lib/storage/adapter';
import type { StorageRoot } from '../lib/storage/schema';
import { migrateRoot } from '../lib/storage/migrations';

export function useImportExport() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const root = await storage.read();
      const jsonString = JSON.stringify(root, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const filename = `tablocal-export-${year}-${month}-${day}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data', err);
    }
  };

  const handleImportFile = (file: File): Promise<StorageRoot> => {
    setError(null);
    setSuccess(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Imported data must be a JSON object');
          }

          if (!('__version' in parsed) && !('groups' in parsed) && !('collections' in parsed)) {
            throw new Error('Invalid TabLocal import file structure');
          }

          const migrated = migrateRoot(parsed);
          resolve(migrated);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Invalid JSON file';
          setError(errMsg);
          reject(err);
        }
      };
      reader.onerror = () => {
        const errMsg = 'Failed to read file';
        setError(errMsg);
        reject(new Error(errMsg));
      };
      reader.readAsText(file);
    });
  };

  return {
    error,
    setError,
    success,
    setSuccess,
    handleExport,
    handleImportFile,
  };
}
