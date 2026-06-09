import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blueprintsApi, gamesApi } from '@/lib/api';
import { findStarCitizenGame, fmtDatetime } from '@/lib/utils';
import { scanFiles, type ScanResult } from '@/lib/logImport';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Trash2, Zap, FileSearch, FolderOpen, CheckCircle, AlertTriangle } from 'lucide-react';

export function Blueprints() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ScanResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: games = [] } = useQuery({ queryKey: ['games'], queryFn: gamesApi.list });
  const starCitizenGame = findStarCitizenGame(games as any[]);
  const starCitizenGameId = starCitizenGame?.id;

  const { data: summary } = useQuery({ queryKey: ['blueprints-summary', debouncedSearch], queryFn: () => blueprintsApi.summary({ search: debouncedSearch || undefined }) });
  const { data: blueprints = [] } = useQuery({
    queryKey: ['blueprints', debouncedSearch],
    queryFn: () => blueprintsApi.list({ search: debouncedSearch || undefined }),
  });
  const { data: defaultBlueprints = [] } = useQuery({
    queryKey: ['blueprints-defaults'],
    queryFn: blueprintsApi.defaults,
    staleTime: 60 * 60 * 1000,
  });

  const discoveredNames = new Set((blueprints as any[]).map(bp => String(bp.product_name).toLowerCase()));
  const visibleDefaults = (defaultBlueprints as any[]).filter(d =>
    !discoveredNames.has(String(d.output_name).toLowerCase()) &&
    (!search || String(d.output_name).toLowerCase().includes(search.toLowerCase()))
  );

  const removeMutation = useMutation({
    mutationFn: (id: number) => blueprintsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blueprints'] }),
  });

  const importMutation = useMutation({
    mutationFn: (blueprints: unknown[]) => {
      if (!starCitizenGameId) {
        return Promise.reject(new Error('Star Citizen game record not found'));
      }
      return blueprintsApi.import(starCitizenGameId, blueprints);
    },
    onSuccess: () => {
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ['blueprints'] });
    },
    onError: err => {
      setImportError(err instanceof Error ? err.message : String(err));
    },
  });

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      return;
    }
    setImportError(null);
    setImportResult(null);
    setImporting(true);

    try {
      const result = await scanFiles(Array.from(files));
      if (!result.payload.blueprints.length) {
        setImportError('No blueprints found in selected logs.');
        setImportResult(result);
        return;
      }
      setImportResult(result);
      await importMutation.mutateAsync(result.payload.blueprints);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Blueprints</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Star Citizen blueprints collected from Game.log (auto-tracked on startup)
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".log"
            onChange={handleFileSelect}
            className="hidden"
            {...({ webkitdirectory: true, directory: true } as any)}
          />
          <Button onClick={handleImportClick} disabled={importing || !starCitizenGameId}>
            <FileSearch size={16} /> Import Game.log
          </Button>
          <Button variant="secondary" onClick={() => setImportResult(null)} disabled={importing || !importResult}>
            <FolderOpen size={16} /> Clear
          </Button>
        </div>
      </div>

      {importError && (
        <Card>
          <div className="flex items-start gap-3 p-4 text-sm text-rose-200">
            <AlertTriangle size={20} />
            <div>
              <p className="font-semibold text-rose-100">Import error</p>
              <p>{importError}</p>
            </div>
          </div>
        </Card>
      )}

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Recent import</CardTitle>
          </CardHeader>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Missions</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{importResult.missionsCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Blueprints</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{importResult.blueprintsCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Duplicate GUIDs</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{importResult.duplicateMissions}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle size={18} className="text-emerald-400" />
              <span>{importSuccess ? 'Imported successfully.' : 'Ready to import.'}</span>
            </div>
          </div>
        </Card>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                <p className="text-sm text-slate-400">Total discovered</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-slate-100">{(summary as any).total}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-slate-400">Recently discovered</p>
              <div className="mt-2 space-y-1">
                {((summary as any).recent as any[]).slice(0, 3).map((bp: any) => (
                  <div key={bp.id} className="text-xs text-slate-400">
                    {bp.product_name}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search blueprints</CardTitle>
        </CardHeader>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600"
            />
            </div>
        </div>
      </Card>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Product name</Th>
              <Th>Mission</Th>
              <Th>Trigger</Th>
              <Th>Discovered</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {(blueprints as any[]).map(bp => (
              <Tr key={bp.id}>
                <Td className="font-medium text-slate-200">{bp.product_name}</Td>
                <Td className="max-w-xs truncate text-slate-400">{bp.mission_debug_name || '-'}</Td>
                <Td>
                  {bp.mission_trigger && (
                    <Badge label={bp.mission_trigger} />
                  )}
                </Td>
                <Td className="text-slate-500 text-xs">{fmtDatetime(bp.discovered_at)}</Td>
                <Td>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeMutation.mutate(bp.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 size={12} />
                  </Button>
                </Td>
              </Tr>
            ))}
            {visibleDefaults.map((d: any) => (
              <Tr key={d.key}>
                <Td className="font-medium text-slate-200">{d.output_name}</Td>
                <Td className="text-slate-600">—</Td>
                <Td><Badge label="default" /></Td>
                <Td className="text-slate-600 text-xs">Always available</Td>
                <Td />
              </Tr>
            ))}
          </tbody>
        </Table>
        {(blueprints as any[]).length === 0 && visibleDefaults.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">
            No blueprints discovered yet. The app is auto-tracking Game.log on startup.
          </div>
        )}
      </Card>
    </div>
  );
}
