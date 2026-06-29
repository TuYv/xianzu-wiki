import { useRef, useState, type ChangeEvent, type JSX } from 'react';
import { useAuth } from '../state/auth';
import { exportData, importData } from '../api/io';
import type { ExportPayload, ImportPayload } from '../types';

/** 导出为发布用 data.json 的形状:只保留公开字段,剥离 notes 与时间戳。 */
function toPublishData(exp: ExportPayload): ExportPayload {
  return {
    characters: exp.characters.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      gender: c.gender,
      generation: c.generation,
      realm: c.realm,
      affiliation: c.affiliation,
      status: c.status,
      avatar_url: c.avatar_url,
      bio: c.bio,
    })),
    relationships: exp.relationships,
  };
}

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
      const data = toPublishData(await exportData());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      // 直接用 data.json 命名:覆盖 frontend/public/data.json 即可发布。
      anchor.download = 'data.json';
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
