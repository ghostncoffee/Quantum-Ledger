import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { miningApi, refinerySessionsApi, salesApi } from '@/lib/api';
import { mergeOreNames } from '@/lib/ores';
import { MathInput } from '@/components/ui/MathInput';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fmtCurrency } from '@/lib/utils';
import {
  Plus, CheckCircle, Trash2, ChevronRight, DollarSign, Pencil,
  ExternalLink, Bell, FlaskConical, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type LineForm = {
  key: string;
  material: string;
  quality: string;    // display only
  inputScu: string;
  outputMaterial: string;
  expectedScu: string;
  oreLineIds: number[]; // mining_ore_lines IDs to remove when session is submitted
};

type JobBuilderState = {
  station: string;
  method: string;
  durationHrs: string;
  totalCost: string;
  lines: LineForm[];
};

const EMPTY_JOB: JobBuilderState = {
  station: '', method: '', durationHrs: '', totalCost: '', lines: [],
};

type QualityBand = { quality: number | null; totalScu: number; bags: { scu: number; bagLabel: string }[]; oreLineIds: number[] };
type MatEntry    = { totalScu: number; bands: QualityBand[] };
type StationEntry = { bags: any[]; materials: Record<string, MatEntry>; anchorBagId: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
function qualityColor(q: number | null | undefined) {
  if (q == null) return 'text-slate-500';
  if (q >= 700) return 'text-emerald-400';
  if (q >= 400) return 'text-amber-400';
  return 'text-slate-400';
}

function fmtCountdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(title, { body });
}

function newKey() { return Math.random().toString(36).slice(2); }

// ── Component ─────────────────────────────────────────────────────────────────
export function Refining() {
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: committedBags = [] } = useQuery({
    queryKey: ['committed-bags'],
    queryFn:  () => miningApi.getCommitted(),
  });
  const { data: rawSessions = [] } = useQuery({
    queryKey: ['refinery-sessions'],
    queryFn:  () => refinerySessionsApi.list(),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['refinery-sessions'] });
    qc.invalidateQueries({ queryKey: ['committed-bags'] });
  };
  const invSale = () => { inv(); qc.invalidateQueries({ queryKey: ['inventory'] }); };

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createSession = useMutation({ mutationFn: (d: unknown) => refinerySessionsApi.create(d), onSuccess: inv });
  const updateSession = useMutation({ mutationFn: ({ id, d }: { id: number; d: unknown }) => refinerySessionsApi.update(id, d), onSuccess: invSale });
  const deleteSession = useMutation({ mutationFn: (id: number) => refinerySessionsApi.remove(id), onSuccess: inv });
  const updateLine    = useMutation({ mutationFn: ({ sid, lid, d }: { sid: number; lid: number; d: unknown }) => refinerySessionsApi.updateLine(sid, lid, d), onSuccess: invSale });
  const addSale       = useMutation({ mutationFn: (d: unknown) => salesApi.create(d), onSuccess: invSale });

  // ── Timer & notifications ────────────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef<Set<number>>(new Set());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Job builder state ────────────────────────────────────────────────────────
  const [builderOpen, setBuilderOpen] = useState(false);
  const [jobForm, setJobForm] = useState<JobBuilderState>(EMPTY_JOB);

  const addLineToBuilder = (station: string, material: string, quality: number | null, scu: number, oreLineIds: number[]) => {
    setBuilderOpen(true);
    setJobForm(f => ({
      ...f,
      station: f.station || station,
      lines: [...f.lines, {
        key: newKey(),
        material,
        quality: quality != null ? String(quality) : '—',
        inputScu: scu.toFixed(2),
        outputMaterial: material,
        expectedScu: '',
        oreLineIds,
      }],
    }));
  };

  const setLine = (key: string, patch: Partial<LineForm>) =>
    setJobForm(f => ({ ...f, lines: f.lines.map(l => l.key === key ? { ...l, ...patch } : l) }));

  const removeLine = (key: string) =>
    setJobForm(f => ({ ...f, lines: f.lines.filter(l => l.key !== key) }));

  const submitJob = () => {
    if (!jobForm.lines.length) return;
    const durationMins = jobForm.durationHrs ? Math.round(Number(jobForm.durationHrs) * 60) : undefined;
    // Derive game_id from the station's bags, falling back to first committed bag
    const stationEntry = jobForm.station ? stationData[jobForm.station] : undefined;
    const gameId: number | undefined =
      (stationEntry?.bags[0] as any)?.game_id ??
      (committedBags as any[])[0]?.game_id ??
      undefined;
    createSession.mutate({
      gameId,
      station: jobForm.station || undefined,
      method:  jobForm.method  || undefined,
      totalCost:       Number(jobForm.totalCost) || 0,
      durationMinutes: durationMins,
      lines: jobForm.lines.map(l => ({
        bagId:             stationEntry?.anchorBagId,   // anchor bag so game_id is traceable
        inputQuantity:     Number(l.inputScu),
        outputMaterial:    l.outputMaterial || l.material,
        expectedOutputQty: l.expectedScu ? Number(l.expectedScu) : undefined,
        oreLineIds:        l.oreLineIds.length > 0 ? l.oreLineIds : undefined,
      })),
    });
    setJobForm(EMPTY_JOB);
    setBuilderOpen(false);
  };

  // ── Session interaction state ────────────────────────────────────────────────
  const [activeOpen,   setActiveOpen]   = useState(true);
  const [doneOpen,     setDoneOpen]     = useState(false);
  const [linesOpen,    setLinesOpen]    = useState<Record<number, boolean>>({});
  const [completing,   setCompleting]   = useState<Record<number, boolean>>({});
  const [actualOut,    setActualOut]    = useState<Record<number, Record<number, string>>>({}); // [sid][lid]
  const [editingSess,  setEditingSess]  = useState<Record<number, any>>({});
  const [quickSaleLn,  setQuickSaleLn]  = useState<Record<number, { commodity: string; qty: string; price: string; location: string } | null>>({});

  // ── Derived: committed bags → station → material → quality bands ─────────────
  const stationData: Record<string, StationEntry> = {};
  for (const bag of committedBags as any[]) {
    const loc = bag.committed_location || 'Unknown Station';
    if (!stationData[loc]) stationData[loc] = { bags: [], materials: {}, anchorBagId: bag.id };
    stationData[loc].bags.push(bag);
    for (const line of (bag.lines || []).filter((l: any) => !l.is_inert)) {
      const mat: string = line.material;
      const qual: number | null = line.quality ?? null;
      if (!stationData[loc].materials[mat]) stationData[loc].materials[mat] = { totalScu: 0, bands: [] };
      const entry = stationData[loc].materials[mat];
      entry.totalScu += Number(line.scu) || 0;
      let band = entry.bands.find(b => b.quality === qual);
      if (!band) { band = { quality: qual, totalScu: 0, bags: [], oreLineIds: [] }; entry.bands.push(band); }
      band.totalScu += Number(line.scu) || 0;
      band.bags.push({ scu: Number(line.scu), bagLabel: bag.label });
      band.oreLineIds.push(line.id);
    }
  }
  for (const sd of Object.values(stationData)) {
    for (const mat of Object.values(sd.materials)) {
      mat.bands.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
    }
  }

  const [stationOpen, setStationOpen] = useState<Record<string, boolean>>({});
  const [matOpen,     setMatOpen]     = useState<Record<string, boolean>>({});

  const sessions      = rawSessions as any[];
  const activeSess    = sessions.filter(s => s.status !== 'done');
  const doneSess      = sessions.filter(s => s.status === 'done');
  const currency      = 'UEC';
  const totalCost     = activeSess.reduce((s, j) => s + (j.total_cost || 0), 0);
  const totalEarned   = doneSess.reduce((s, j) => s + (j.sale_revenue || 0), 0);
  const readyCount    = activeSess.filter(s => {
    if (!s.duration_minutes || !s.started_at) return false;
    return (new Date(s.started_at).getTime() + s.duration_minutes * 60_000) <= now;
  }).length;

  // ── Timer chip ───────────────────────────────────────────────────────────────
  const renderTimer = (s: any) => {
    if (!s.duration_minutes || !s.started_at || s.status === 'done') return null;
    const completesAt = new Date(s.started_at).getTime() + s.duration_minutes * 60_000;
    const remainMs    = completesAt - now;
    if (remainMs <= 0) {
      if (!notifiedRef.current.has(s.id)) {
        notifiedRef.current.add(s.id);
        notify('Refining Complete!',
          `${(s.lines || []).map((l: any) => l.output_material).join(', ')}${s.station ? ` · ${s.station}` : ''} is ready`);
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-400/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          <Bell size={10} className="animate-pulse" /> READY
        </span>
      );
    }
    const urgency = remainMs < 600_000 ? 'text-red-400' : remainMs < 3_600_000 ? 'text-amber-400' : 'text-slate-400';
    return <span className={`text-xs font-mono ${urgency}`}>⏱ {fmtCountdown(remainMs)}</span>;
  };

  // ── Session card ─────────────────────────────────────────────────────────────
  const renderSession = (s: any) => {
    const lines       = s.lines || [];
    const isOpen      = linesOpen[s.id] ?? true;
    const isCompleting = completing[s.id] ?? false;
    const isEditing   = editingSess[s.id];
    const isSold      = (s.sale_revenue || 0) > 0;
    const isDone      = s.status === 'done';

    return (
      <div key={s.id} className={`py-4 border-b border-slate-700/30 last:border-0 ${isDone ? 'opacity-75' : ''}`}>

        {/* Session header */}
        {isEditing ? (
          <div className="space-y-2 mb-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Station</p>
                <input value={isEditing.station || ''} placeholder="Station"
                  onChange={e => setEditingSess(f => ({ ...f, [s.id]: { ...f[s.id], station: e.target.value } }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Method</p>
                <input value={isEditing.method || ''} placeholder="Method"
                  onChange={e => setEditingSess(f => ({ ...f, [s.id]: { ...f[s.id], method: e.target.value } }))} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Duration (hrs)</p>
                <MathInput
                  value={isEditing.duration_minutes != null ? String(isEditing.duration_minutes / 60) : ''}
                  placeholder="hrs"
                  onChange={e => setEditingSess(f => ({ ...f, [s.id]: { ...f[s.id], duration_minutes: e.target.value ? Math.round(Number(e.target.value) * 60) : null } }))}
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total cost</p>
                <MathInput
                  value={isEditing.total_cost != null ? String(isEditing.total_cost) : ''}
                  placeholder="0"
                  onChange={e => setEditingSess(f => ({ ...f, [s.id]: { ...f[s.id], total_cost: Number(e.target.value) || 0 } }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                const ed = isEditing;
                updateSession.mutate({ id: s.id, d: {
                  station:         ed.station  || undefined,
                  method:          ed.method   || undefined,
                  totalCost:       ed.total_cost ?? 0,
                  durationMinutes: ed.duration_minutes ?? undefined,
                  startedAt:       ed.duration_minutes ? (s.started_at ?? new Date().toISOString()) : undefined,
                }});
                setEditingSess(f => { const n = { ...f }; delete n[s.id]; return n; });
              }}><CheckCircle size={12} /> Save</Button>
              <Button size="sm" variant="secondary"
                onClick={() => setEditingSess(f => { const n = { ...f }; delete n[s.id]; return n; })}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <button
                onClick={() => setLinesOpen(f => ({ ...f, [s.id]: !isOpen }))}
                className="flex items-center gap-1.5"
              >
                <ChevronRight size={13} className={`text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                <span className="font-semibold text-slate-200 text-sm">{s.station || 'Refinery Job'}</span>
              </button>
              {s.method && <span className="text-xs text-slate-500">· {s.method}</span>}
              <Badge label={s.status} />
              {renderTimer(s)}
              {isDone && isSold && <span className="text-xs text-emerald-400 font-medium">Sold: {fmtCurrency(s.sale_revenue, currency)}</span>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(s.total_cost || 0) > 0 && (
                <span className="text-xs text-red-400 mr-1">{fmtCurrency(s.total_cost, currency)}</span>
              )}
              {!isDone && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditingSess(f => ({ ...f, [s.id]: { ...s } }))}>
                    <Pencil size={11} />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    if (!isCompleting) {
                      // Pre-fill actual outputs with expected quantities so the user only has to adjust deltas
                      setActualOut(f => ({
                        ...f,
                        [s.id]: Object.fromEntries(
                          (lines as any[])
                            .filter((l: any) => l.output_quantity != null)
                            .map((l: any) => [l.id, String(l.output_quantity)])
                        ),
                      }));
                    }
                    setCompleting(f => ({ ...f, [s.id]: !isCompleting }));
                  }}>
                    <CheckCircle size={11} /> {isCompleting ? 'Cancel' : 'Complete'}
                  </Button>
                </>
              )}
              <Button variant="danger" size="sm" onClick={() => deleteSession.mutate(s.id)}><Trash2 size={12} /></Button>
            </div>
          </div>
        )}

        {/* Lines */}
        {isOpen && lines.length > 0 && (
          <div className="ml-5 mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-600 uppercase tracking-wider">
                  <th className="text-left py-1 font-medium">Material</th>
                  <th className="text-right py-1 font-medium">Quality</th>
                  <th className="text-right py-1 font-medium">In SCU</th>
                  <th className="text-right py-1 font-medium">{isDone ? 'Actual Out' : 'Exp Out'}</th>
                  {isDone && <th className="text-right py-1 font-medium">Sale</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => {
                  const qs = quickSaleLn[line.id];
                  return (
                    <>
                      <tr key={line.id} className="border-t border-slate-800">
                        <td className="py-1.5 text-slate-200 font-medium">{line.output_material}</td>
                        <td className={`py-1.5 text-right font-mono ${qualityColor(line.quality)}`}>
                          {line.quality != null ? line.quality : '—'}
                        </td>
                        <td className="py-1.5 text-right text-slate-400">{(line.input_quantity || 0).toFixed(2)}</td>
                        <td className="py-1.5 text-right">
                          {isCompleting ? (
                            <MathInput
                              className="w-20 ml-auto"
                              placeholder="actual"
                              value={actualOut[s.id]?.[line.id] || ''}
                              onChange={e => setActualOut(f => ({
                                ...f,
                                [s.id]: { ...(f[s.id] || {}), [line.id]: e.target.value },
                              }))}
                            />
                          ) : (
                            <span className={line.output_quantity != null ? 'text-emerald-400' : 'text-slate-600'}>
                              {line.output_quantity != null ? `${line.output_quantity} SCU` : '—'}
                            </span>
                          )}
                        </td>
                        {isDone && (
                          <td className="py-1.5 text-right">
                            {(line.sale_revenue || 0) > 0 ? (
                              <span className="text-emerald-400">{fmtCurrency(line.sale_revenue, currency)}</span>
                            ) : line.output_quantity != null ? (
                              <Button size="sm" variant="secondary" onClick={() =>
                                setQuickSaleLn(f => ({ ...f, [line.id]: {
                                  commodity: line.output_material || '',
                                  qty: String(line.output_quantity ?? ''),
                                  price: '', location: '',
                                }}))}>
                                <DollarSign size={10} /> Sell
                              </Button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                      {/* Quick sale for this line */}
                      {qs && (
                        <tr key={`qs-${line.id}`}>
                          <td colSpan={isDone ? 5 : 4} className="pb-2 pt-1">
                            <div className="flex gap-2 flex-wrap items-end p-2 bg-slate-800/50 rounded-lg border border-slate-700/40">
                              <div className="flex-1 min-w-[120px]">
                                <p className="text-xs text-slate-500 mb-0.5">Commodity</p>
                                <input value={qs.commodity}
                                  onChange={e => setQuickSaleLn(f => ({ ...f, [line.id]: { ...f[line.id]!, commodity: e.target.value } }))} />
                              </div>
                              <div className="w-20">
                                <p className="text-xs text-slate-500 mb-0.5">SCU</p>
                                <MathInput value={qs.qty}
                                  onChange={e => setQuickSaleLn(f => ({ ...f, [line.id]: { ...f[line.id]!, qty: e.target.value } }))} />
                              </div>
                              <div className="w-28">
                                <p className="text-xs text-slate-500 mb-0.5">Price / SCU</p>
                                <MathInput value={qs.price} placeholder={currency}
                                  onChange={e => setQuickSaleLn(f => ({ ...f, [line.id]: { ...f[line.id]!, price: e.target.value } }))} />
                              </div>
                              {qs.qty && qs.price && (
                                <span className="text-sm text-emerald-400 font-semibold pb-0.5">
                                  = {fmtCurrency(Number(qs.qty) * Number(qs.price), currency)}
                                </span>
                              )}
                              <div className="flex gap-1.5 pb-0.5">
                                <Button size="sm" onClick={() => {
                                  if (!qs.commodity || !qs.qty || !qs.price) return;
                                  addSale.mutate({ refiningJobId: line.id, commodity: qs.commodity, quantitySold: Number(qs.qty), pricePerUnit: Number(qs.price), location: qs.location || undefined });
                                  setQuickSaleLn(f => ({ ...f, [line.id]: null }));
                                }}><CheckCircle size={12} /> Save</Button>
                                <Button size="sm" variant="secondary" onClick={() => setQuickSaleLn(f => ({ ...f, [line.id]: null }))}>✕</Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>

            {/* Mark all done */}
            {isCompleting && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={() => {
                  const outputs = actualOut[s.id] || {};
                  Promise.all(lines.map((line: any) => {
                    const val = outputs[line.id];
                    return updateLine.mutateAsync({ sid: s.id, lid: line.id, d: {
                      outputQuantity: val ? Number(val) : undefined,
                    }});
                  })).then(() => {
                    updateSession.mutate({ id: s.id, d: { status: 'done' } });
                    setCompleting(f => { const n = { ...f }; delete n[s.id]; return n; });
                    setActualOut(f => { const n = { ...f }; delete n[s.id]; return n; });
                  });
                }}>
                  <CheckCircle size={12} /> Save & Mark Done
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Duration / completion time line */}
        {!isEditing && s.duration_minutes && s.started_at && s.status !== 'done' && (
          <div className="ml-5 mt-1 text-xs text-slate-600">
            Ready at {new Date(new Date(s.started_at).getTime() + s.duration_minutes * 60_000)
              .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' '}· {(s.duration_minutes / 60).toFixed(s.duration_minutes % 60 === 0 ? 0 : 1)}h job
          </div>
        )}
      </div>
    );
  };

  // ── Page ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Refining</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit ore to a refinery, track timers, record yields</p>
        </div>
        <Button onClick={() => setBuilderOpen(v => !v)}>
          <FlaskConical size={14} /> {builderOpen ? 'Cancel Job' : 'New Refinery Job'}
        </Button>
      </div>

      {/* Stats strip */}
      {sessions.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-xl border border-[#1e2d4f] bg-[#141c35] px-4 py-3">
            <p className="text-xs text-slate-500">Active jobs</p>
            <p className="text-xl font-bold text-blue-400">{activeSess.length}</p>
          </div>
          {readyCount > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-400/10 px-4 py-3">
              <p className="text-xs text-emerald-400 flex items-center gap-1"><Bell size={11} className="animate-pulse" /> Ready</p>
              <p className="text-xl font-bold text-emerald-300">{readyCount}</p>
            </div>
          )}
          {totalCost > 0 && (
            <div className="rounded-xl border border-[#1e2d4f] bg-[#141c35] px-4 py-3">
              <p className="text-xs text-slate-500">Refining cost</p>
              <p className="text-xl font-bold text-red-400">{fmtCurrency(totalCost, currency)}</p>
            </div>
          )}
          {totalEarned > 0 && (
            <div className="rounded-xl border border-[#1e2d4f] bg-[#141c35] px-4 py-3">
              <p className="text-xs text-slate-500">Earned (sold)</p>
              <p className="text-xl font-bold text-emerald-400">{fmtCurrency(totalEarned, currency)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Job builder ── */}
      {builderOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create Refinery Job</CardTitle>
            <span className="text-xs text-slate-500">Combine multiple ores into one submission</span>
          </CardHeader>

          {/* Header fields */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
            <div>
              <p className="text-xs text-slate-600 mb-0.5">Station *</p>
              <input value={jobForm.station} placeholder="e.g. ARC-L1 Covalex"
                onChange={e => setJobForm(f => ({ ...f, station: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-0.5">Method</p>
              <input value={jobForm.method} placeholder="e.g. Dinyx Solventation"
                onChange={e => setJobForm(f => ({ ...f, method: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-0.5">Duration (hrs)</p>
              <MathInput value={jobForm.durationHrs} placeholder="e.g. 4"
                onChange={e => setJobForm(f => ({ ...f, durationHrs: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-0.5">Total refining cost</p>
              <MathInput value={jobForm.totalCost} placeholder="0"
                onChange={e => setJobForm(f => ({ ...f, totalCost: e.target.value }))} />
            </div>
          </div>

          {/* Material lines */}
          <datalist id="sc-ores-refine">
            {mergeOreNames(
              (committedBags as any[]).flatMap((b: any) =>
                (b.lines || []).map((l: any) => l.material as string).filter(Boolean)
              )
            ).map(o => <option key={o} value={o} />)}
          </datalist>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Materials</p>
              <Button size="sm" variant="secondary"
                onClick={() => setJobForm(f => ({ ...f, lines: [...f.lines, { key: newKey(), material: '', quality: '', inputScu: '', outputMaterial: '', expectedScu: '', oreLineIds: [] }] }))}>
                <Plus size={11} /> Add line
              </Button>
            </div>

            {jobForm.lines.length === 0 && (
              <p className="text-xs text-slate-600 italic py-2">
                No materials yet — add a line manually or click "+ Add to Job" on ore below
              </p>
            )}

            <div className="space-y-1.5">
              {jobForm.lines.map(line => (
                <div key={line.key} className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[110px]">
                    <input list="sc-ores-refine" value={line.material} placeholder="Material"
                      onChange={e => setLine(line.key, { material: e.target.value, outputMaterial: e.target.value })} />
                  </div>
                  {line.quality && (
                    <span className={`text-xs font-mono w-10 text-right ${qualityColor(line.quality ? Number(line.quality) : null)}`}>
                      {line.quality}
                    </span>
                  )}
                  <div className="w-24">
                    <MathInput value={line.inputScu} placeholder="In SCU"
                      onChange={e => setLine(line.key, { inputScu: e.target.value })} />
                  </div>
                  <span className="text-slate-600 text-xs">→</span>
                  <div className="flex-1 min-w-[110px]">
                    <input value={line.outputMaterial} placeholder="Output material"
                      onChange={e => setLine(line.key, { outputMaterial: e.target.value })} />
                  </div>
                  <div className="w-24">
                    <MathInput value={line.expectedScu} placeholder="Exp SCU"
                      onChange={e => setLine(line.key, { expectedScu: e.target.value })} />
                  </div>
                  <button onClick={() => removeLine(line.key)} className="text-slate-600 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={submitJob} disabled={jobForm.lines.length === 0}>
            <FlaskConical size={13} /> Submit Refinery Job ({jobForm.lines.length} material{jobForm.lines.length !== 1 ? 's' : ''})
          </Button>
        </Card>
      )}

      {/* ── Ore at stations (committed bags) ── */}
      {Object.keys(stationData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ore at Stations</CardTitle>
            <span className="text-xs text-slate-500">Click "+ Add to Job" to include in a refinery submission</span>
          </CardHeader>

          <div className="divide-y divide-slate-700/40">
            {Object.entries(stationData).map(([station, sd]) => {
              const isStOpen = stationOpen[station] ?? true;
              const totalScu = Object.values(sd.materials).reduce((s, m) => s + m.totalScu, 0);

              return (
                <div key={station} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStationOpen(f => ({ ...f, [station]: !isStOpen }))}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <ChevronRight size={13} className={`shrink-0 text-slate-500 transition-transform ${isStOpen ? 'rotate-90' : ''}`} />
                      <span className="font-bold text-slate-100 text-sm truncate">{station}</span>
                      <span className="text-xs text-orange-400">{totalScu.toFixed(2)} SCU</span>
                      <span className="text-xs text-slate-600">{sd.bags.length} bag{sd.bags.length !== 1 ? 's' : ''}</span>
                    </button>
                    <Button size="sm" variant="secondary"
                      onClick={() => {
                        setBuilderOpen(true);
                        setJobForm(f => ({ ...f, station: f.station || station }));
                      }}>
                      <FlaskConical size={11} /> New Job Here
                    </Button>
                  </div>

                  {isStOpen && (
                    <div className="mt-2 ml-5 space-y-2">
                      {Object.entries(sd.materials).map(([material, matData]) => {
                        const mk = `${station}||${material}`;
                        const isMOpen = matOpen[mk] ?? true;
                        return (
                          <div key={material} className="border border-slate-700/50 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setMatOpen(f => ({ ...f, [mk]: !isMOpen }))}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 bg-slate-800/40 hover:bg-slate-800/60"
                            >
                              <ChevronRight size={12} className={`shrink-0 text-slate-600 transition-transform ${isMOpen ? 'rotate-90' : ''}`} />
                              <span className="font-semibold text-slate-200 text-sm flex-1 text-left">{material}</span>
                              <span className="text-xs text-orange-400">{matData.totalScu.toFixed(2)} SCU</span>
                              <span className="text-xs text-slate-600 ml-2">{matData.bands.length} band{matData.bands.length !== 1 ? 's' : ''}</span>
                            </button>

                            {isMOpen && (
                              <div className="divide-y divide-slate-800/60">
                                {matData.bands.map(band => {
                                  const ql = band.quality != null ? String(band.quality) : 'null';
                                  return (
                                    <div key={ql} className="px-3 py-2 flex items-center gap-3">
                                      <span className={`font-mono text-sm font-bold w-12 text-right ${qualityColor(band.quality)}`}>
                                        {band.quality != null ? band.quality : '—'}
                                      </span>
                                      <span className="text-xs text-slate-500 w-12">quality</span>
                                      <span className="text-xs text-orange-300 font-semibold flex-1">{band.totalScu.toFixed(2)} SCU</span>
                                      <span className="text-xs text-slate-600 truncate max-w-[160px]">
                                        {band.bags.map(b => b.bagLabel).join(' · ')}
                                      </span>
                                      <Button size="sm" variant="secondary"
                                        onClick={() => addLineToBuilder(station, material, band.quality, band.totalScu, band.oreLineIds)}>
                                        <Plus size={11} /> Add to Job
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Active sessions ── */}
      {activeSess.length > 0 && (
        <Card>
          <button className="flex items-center gap-2 w-full text-left"
            onClick={() => setActiveOpen(v => !v)}>
            <ChevronRight size={13} className={`text-slate-500 transition-transform ${activeOpen ? 'rotate-90' : ''}`} />
            <CardTitle>Active Jobs ({activeSess.length})</CardTitle>
            {readyCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-400/15 border border-emerald-500/30 px-2 py-0.5 rounded-full ml-1">
                <Bell size={10} className="animate-pulse" /> {readyCount} ready
              </span>
            )}
            {totalCost > 0 && (
              <span className="text-xs text-red-400 ml-auto">{fmtCurrency(totalCost, currency)} total cost</span>
            )}
          </button>
          {activeOpen && <div className="mt-2">{activeSess.map(renderSession)}</div>}
        </Card>
      )}

      {/* ── Completed sessions ── */}
      {doneSess.length > 0 && (
        <Card>
          <button className="flex items-center gap-2 w-full text-left"
            onClick={() => setDoneOpen(v => !v)}>
            <ChevronRight size={13} className={`text-slate-500 transition-transform ${doneOpen ? 'rotate-90' : ''}`} />
            <CardTitle>Completed ({doneSess.length})</CardTitle>
            {totalEarned > 0 && (
              <span className="text-xs text-emerald-400 ml-1">{fmtCurrency(totalEarned, currency)} earned</span>
            )}
          </button>
          {doneOpen && <div className="mt-2">{doneSess.map(renderSession)}</div>}
        </Card>
      )}

      {sessions.length === 0 && Object.keys(stationData).length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 font-medium">No refining activity yet</p>
          <p className="text-sm text-slate-600 mt-1">
            Check in mining bags from a run's Mining tab, then create a refinery job above.
          </p>
        </div>
      )}
    </div>
  );
}
