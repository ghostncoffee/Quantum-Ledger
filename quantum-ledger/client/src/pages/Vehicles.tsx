import { useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi, gamesApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Plus, Trash2, FileSearch, AlertTriangle, CheckCircle } from 'lucide-react';
import { VEHICLE_TYPES, findStarCitizenGame, getShipMetaByCode } from '@/lib/utils';

function NewVehicleModal({ open, onClose, defaultGameId }: { open: boolean; onClose: () => void; defaultGameId?: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'mining', crewMin: '1', crewMax: '1', scuCapacity: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: (d: unknown) => vehiclesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); onClose(); },
  });

  return (
    <Modal open={open} onClose={onClose} title="Add Vehicle / Ship">
      <form onSubmit={e => {
        e.preventDefault();
        add.mutate({
          name: form.name,
          type: form.type,
          crew_min: Number(form.crewMin) || 1,
          crew_max: Number(form.crewMax) || 1,
          scu_capacity: form.scuCapacity ? Number(form.scuCapacity) : undefined,
          gameId: defaultGameId,
        });
      }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. MISC Prospector" required />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Crew min</label>
            <input
              type="number"
              min="1"
              value={form.crewMin}
              onChange={e => set('crewMin', e.target.value)}
              placeholder="1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Crew max</label>
            <input
              type="number"
              min="1"
              value={form.crewMax}
              onChange={e => set('crewMax', e.target.value)}
              placeholder="1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">SCU capacity</label>
            <input
              type="number"
              min="0"
              value={form.scuCapacity}
              onChange={e => set('scuCapacity', e.target.value)}
              placeholder="SCU"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={add.isPending}><Plus size={14} /> Add</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Vehicles() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: games = [] } = useQuery({ queryKey: ['games'], queryFn: gamesApi.list });
  const scGame = findStarCitizenGame(games as any[]);
  const scGameId = scGame?.id;
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles', scGameId], queryFn: () => vehiclesApi.list(scGameId ? { gameId: scGameId } : undefined) });
  const { data: shipMatrix = [] } = useQuery({
    queryKey: ['ship-matrix'],
    queryFn: vehiclesApi.shipMatrix,
    staleTime: 60 * 60 * 1000,
  });
  const matrixByName = new Map((shipMatrix as any[]).map(s => [String(s.name).toLowerCase(), s]));

  const remove = useMutation({
    mutationFn: (id: number) => vehiclesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const handleHangarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      (vehicles as any[]).length > 0 &&
      !window.confirm('Importing a hangar file replaces your tracked ships: all currently tracked ships will be deleted before the new list is loaded. Continue?')
    ) {
      event.target.value = '';
      return;
    }

    setImportError(null);
    setImportSuccess(false);
    setImporting(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const ships = Array.isArray(parsed) ? parsed : parsed.shiplist || [];
      if (!Array.isArray(ships)) {
        throw new Error('Invalid hangar JSON format.');
      }

      const payload = ships.flatMap((item: any) => {
        const name = String(item.name || item.ship_name || '').trim();
        if (!name) return [];
        const userGivenName = String(item.ship_name || '').trim();
        const nickname = userGivenName && userGivenName !== name ? userGivenName : undefined;
        const meta = getShipMetaByCode(String(item.ship_code || ''), name);
        return [{ name, type: meta.type, crew_min: meta.crewMin, crew_max: meta.crewMax, scu_capacity: meta.scuCapacity || undefined, nickname }];
      });

      if (payload.length === 0) {
        setImportError('The hangar file contained no ships.');
        return;
      }

      await vehiclesApi.importHangar(scGameId!, payload);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      setImportSuccess(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openHangarImport = () => fileInputRef.current?.click();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Vehicles & Ships</h1>
          <p className="text-sm text-slate-500 mt-0.5">{(vehicles as any[]).length} registered</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleHangarFile}
            className="hidden"
          />
          <Button onClick={openHangarImport} disabled={importing}>
            <FileSearch size={15} /> Import Hangar
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus size={15} /> Add Vehicle
          </Button>
        </div>
      </div>

      {(importError || importSuccess) && (
        <Card>
          <div className="flex flex-col gap-3 p-4 text-sm">
            {importError && (
              <div className="flex items-start gap-3 text-rose-200">
                <AlertTriangle size={18} />
                <div>
                  <p className="font-semibold text-rose-100">Import failed</p>
                  <p>{importError}</p>
                </div>
              </div>
            )}
            {importSuccess && (
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle size={18} />
                <span>Hangar data imported successfully.</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <Table>
          <thead><tr><Th>Name</Th><Th>Type</Th><Th>Foci</Th><Th>Crew</Th><Th>Cargo (SCU)</Th><Th /></tr></thead>
          <tbody>
            {(vehicles as any[]).length === 0 ? (
              <Tr><Td colSpan={6} className="text-center text-slate-500">No vehicles yet.</Td></Tr>
            ) : (
              (vehicles as any[]).map((v: any) => {
                const matrix = matrixByName.get(String(v.name).toLowerCase());
                const crewMin = matrix?.crewMin ?? v.crew_min ?? 1;
                const crewMax = matrix?.crewMax ?? v.crew_max ?? 1;
                const cargo = matrix?.cargo || v.scu_capacity || 0;
                const foci = matrix?.foci?.length ? matrix.foci.join(', ') : '—';
                return (
                  <Tr key={v.id}>
                    <Td className="font-medium text-slate-200">
                    {v.name}
                    {v.nickname && <span className="italic font-normal text-slate-400"> – {v.nickname}</span>}
                  </Td>
                    <Td><Badge label={v.type} /></Td>
                    <Td className="text-slate-400">{foci}</Td>
                    <Td className="text-slate-400">{crewMin}–{crewMax}</Td>
                    <Td className="text-slate-400">{cargo || '—'}</Td>
                    <Td><Button variant="danger" size="sm" onClick={() => remove.mutate(v.id)}><Trash2 size={12} /></Button></Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <NewVehicleModal open={newOpen} onClose={() => setNewOpen(false)} defaultGameId={scGameId} />
    </div>
  );
}
