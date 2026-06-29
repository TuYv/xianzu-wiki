import { useRef, useState, type ChangeEvent, type JSX } from 'react';
import { useAuth } from '../state/auth';
import { exportData, importData } from '../api/io';
import type { ImportPayload } from '../types';

export function ImportExport(): JSX.Element | null {
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');

  if (!isAdmin) {
    return null;
  }

  async function handleExport(): Promise<void> {
    setMessage('');
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xjxz-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('导出完成');
    } catch (err) {
      setMessage(`导出失败:${(err as Error).message}`);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setMessage('');
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ImportPayload;
      const result = await importData(payload);
      setMessage(`导入完成:人物 ${result.imported_characters},关系 ${result.imported_relationships}`);
    } catch (err) {
      setMessage(`导入失败:${(err as Error).message}`);
    } finally {
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  return (
    <div className="import-export">
      <button type="button" onClick={handleExport}>
        导出 JSON
      </button>
      <label>
        导入 JSON
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          data-testid="import-input"
          onChange={handleImportFile}
        />
      </label>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
