import { useState, useMemo, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Download, FileSearch, FolderOpen, AlertTriangle } from 'lucide-react';
import { blueprintsApi, gamesApi } from '@/lib/api';
import { findStarCitizenGame } from '@/lib/utils';
import { scanFiles, type ScanResult } from '@/lib/logImport';

export function LogImport() {
  const qc = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: gamesApi.list,
  });

  const starCitizenGameId = useMemo(() => {
    const game = findStarCitizenGame((games as any[]) ?? []);
    return game?.id;
  }, [games]);

  const importBlueprints = useMutation({
    mutationFn: (blueprints: unknown[]) => {
      if (!starCitizenGameId) {
        return Promise.reject(new Error('Star Citizen game record not found'));}
      return blueprintsApi.import(starCitizenGameId, blueprints);
    },
    onSuccess: () => {
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 2500);
      qc.invalidateQueries({ queryKey: ['blueprints'] });
    },
    onError: err => {
      setError(err instanceof Error ? err.message : String(err));
    },
  });

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      setSelectedFiles([]);
      return;
    }
    setSelectedFiles(Array.from(files).sort((a, b) => {
      const aName = a.webkitRelativePath || a.name;
      const bName = b.webkitRelativePath || b.name;
      return aName.localeCompare(bName);
    }));
  };

  const buildPayload = async () => {
    setError(null);
    setResult(null);
    if (selectedFiles.length === 0) {
      setError('Select one or more Star Citizen .log files first.');
      return;
    }

    setIsLoading(true);
    try {
      const scanResult = await scanFiles(selectedFiles);
      setResult(scanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResult = () => {
    if (!result) {
      return;
    }
    const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `scmdb-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">SCMDB Log Import</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Import Star Citizen Game.log or backup log files and export the parsed mission + blueprint summary.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose log files</CardTitle>
        </CardHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-400">
            Select one or more `.log` files from your Star Citizen install. For a full import, choose the `logbackups` directory or one or more backup files.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 shadow-sm hover:border-slate-500">
              <span className="inline-flex items-center gap-2">
                <FolderOpen size={16} /> Select files
              </span>
              <input
                type="file"
                multiple
                accept=".log"
                onChange={handleFileSelection}
                className="hidden"
                {...({ webkitdirectory: true, directory: true } as any)}
              />
            </label>
            <Button onClick={buildPayload} disabled={selectedFiles.length === 0 || isLoading}>
              <FileSearch size={16} /> Parse selected logs
            </Button>
          </div>
          {selectedFiles.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              <p className="font-medium text-slate-100">Selected files:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {selectedFiles.slice(0, 20).map(file => (
                  <li key={file.name + file.size}>{file.webkitRelativePath || file.name}</li>
                ))}
                {selectedFiles.length > 20 && (
                  <li>and {selectedFiles.length - 20} more selected files...</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Card>
          <div className="flex items-start gap-3 p-4 text-sm text-rose-200">
            <AlertTriangle size={20} />
            <div>
              <p className="font-semibold text-rose-100">Import error</p>
              <p>{error}</p>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
          </CardHeader>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Missions</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{result.missionsCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Blueprints</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{result.blueprintsCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Duplicate GUIDs</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{result.duplicateMissions}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Exported {result.payload.sourceLogs.length} file(s).</p>
                <p className="text-sm text-slate-400">Channel: {result.payload.channel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={downloadResult}>
                  <Download size={16} /> Download JSON
                </Button>
                <Button
                  onClick={() => importBlueprints.mutate(result.payload.blueprints)}
                  disabled={importBlueprints.isPending || result.payload.blueprints.length === 0}
                >
                  Import blueprints
                </Button>
                {importSuccess && (
                  <span className="text-sm text-emerald-400">Imported successfully.</span>
                )}
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Log file</Th>
                  <Th className="text-right">Missions</Th>
                  <Th className="text-right">Blueprints</Th>
                </tr>
              </thead>
              <tbody>
                {result.payload.sourceLogs.map((name, index) => (
                  <Tr key={`${name}-${index}`}>
                    <Td>{name}</Td>
                    <Td className="text-right">-</Td>
                    <Td className="text-right">-</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
