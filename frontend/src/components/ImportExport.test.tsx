import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../api/io', () => ({
  exportData: vi.fn(),
  importData: vi.fn(),
}));
vi.mock('../state/auth', () => ({
  useAuth: vi.fn(),
}));

import { exportData, importData } from '../api/io';
import { useAuth } from '../state/auth';
import { ImportExport } from './ImportExport';
import type { ExportPayload, ImportPayload } from '../types';

const mockedExport = vi.mocked(exportData);
const mockedImport = vi.mocked(importData);
const mockedUseAuth = vi.mocked(useAuth);

function setAdmin(isAdmin: boolean): void {
  mockedUseAuth.mockReturnValue({ isAdmin, login: vi.fn(), logout: vi.fn() });
}

describe('ImportExport', () => {
  beforeEach(() => {
    mockedExport.mockReset();
    mockedImport.mockReset();
    mockedUseAuth.mockReset();
  });

  it('renders nothing for non-admin', () => {
    setAdmin(false);
    const { container } = render(<ImportExport />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('导出 JSON')).toBeNull();
  });

  it('export click downloads a JSON blob containing the data', async () => {
    setAdmin(true);
    mockedExport.mockResolvedValue({
      characters: [{ id: 1, name: 'A', aliases: [], gender: 'unknown', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null }],
      relationships: [],
    } satisfies ExportPayload);

    const createUrl = vi.fn((_blob: Blob) => 'blob:mock');
    const revokeUrl = vi.fn();
    (URL as unknown as { createObjectURL: typeof createUrl }).createObjectURL = createUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeUrl }).revokeObjectURL = revokeUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ImportExport />);
    fireEvent.click(screen.getByText('导出 JSON'));

    await waitFor(() => expect(mockedExport).toHaveBeenCalledTimes(1));
    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = createUrl.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toContain('"name": "A"');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:mock');

    clickSpy.mockRestore();
  });

  it('import parses the selected file and calls importData with the parsed payload', async () => {
    setAdmin(true);
    mockedImport.mockResolvedValue({ imported_characters: 1, imported_relationships: 0 });
    const payload: ImportPayload = { characters: [{ name: 'A' }], relationships: [] };

    render(<ImportExport />);
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File([JSON.stringify(payload)], 'data.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockedImport).toHaveBeenCalledWith(payload));
  });

  it('import shows error when file contains malformed JSON', async () => {
    setAdmin(true);
    render(<ImportExport />);
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByRole('status'));
    expect(screen.getByRole('status').textContent).toMatch(/导入失败/);
  });

  it('import shows error when importData rejects', async () => {
    setAdmin(true);
    mockedImport.mockRejectedValue(new Error('500'));
    const payload: ImportPayload = { characters: [{ name: 'A' }], relationships: [] };

    render(<ImportExport />);
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File([JSON.stringify(payload)], 'data.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByRole('status'));
    expect(screen.getByRole('status').textContent).toContain('导入失败');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
