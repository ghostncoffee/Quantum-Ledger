import { MathInput } from '@/components/ui/MathInput';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { craftingApi, gamesApi, blueprintsApi, clanApi } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { fmtCurrency, profitColor, findStarCitizenGame } from '@/lib/utils';
import { Plus, Trash2, CheckCircle, ChevronRight } from 'lucide-react';

export function Crafting() {
  const qc = useQueryClient();
  const [jobForm, setJobForm] = useState({ outputItem: '', outputQuantity: '', estimatedValue: '' });
  const [inputForms, setInputForms] = useState<Record<number, { material: string; quantityRequired: string; costPerUnit: string }>>({});
  const [expandedJobs, setExpandedJobs] = useState<Record<number, boolean>>({});

  const { data: games = [] } = useQuery({ queryKey: ['games'], queryFn: gamesApi.list });
  const scGame = findStarCitizenGame(games as any[]);
  const scGameId = scGame?.id;
  const { data: jobs = [] } = useQuery({
    queryKey: ['crafting-jobs', scGameId],
    queryFn: () => craftingApi.list(scGameId ? { gameId: scGameId } : undefined),
  });

  // Blueprint sources for the dropdown
  const { data: localBlueprints = [] } = useQuery({ queryKey: ['blueprints'], queryFn: () => blueprintsApi.list() });
  const { data: defaultBlueprints = [] } = useQuery({ queryKey: ['blueprints-defaults'], queryFn: blueprintsApi.defaults, staleTime: 60 * 60 * 1000 });
  const { data: blueprintMatrix = [] } = useQuery({ queryKey: ['blueprints-matrix'], queryFn: blueprintsApi.matrix, staleTime: 60 * 60 * 1000 });
  const { data: clanBlueprints = [] } = useQuery({ queryKey: ['clan-blueprints'], queryFn: clanApi.blueprints, staleTime: 5 * 60 * 1000, retry: false });

  interface BpOption { value: string; label: string; type: string; typeLabel: string }

  const blueprintGroups = useMemo(() => {
    const matrixByName = new Map<string, any>(
      (blueprintMatrix as any[]).map(m => [String(m.output_name).toLowerCase(), m])
    );

    // Names the local user personally has (discovered + defaults)
    const ownNames = new Set<string>([
      ...(localBlueprints as any[]).map(bp => String(bp.product_name).toLowerCase()),
      ...(defaultBlueprints as any[]).map(bp => String(bp.output_name).toLowerCase()),
    ]);

    const options = new Map<string, BpOption>();

    const addOption = (nameRaw: string, labelSuffix?: string) => {
      const nameLC = nameRaw.toLowerCase();
      if (options.has(nameLC)) return;
      const mx = matrixByName.get(nameLC);
      options.set(nameLC, {
        value: nameRaw,
        label: labelSuffix ? `${nameRaw} – ${labelSuffix}` : nameRaw,
        type: mx?.item_type ?? 'Unknown',
        typeLabel: mx?.item_type_label ?? 'Unknown',
      });
    };

    // 1. Own: locally discovered
    (localBlueprints as any[]).forEach(bp => addOption(String(bp.product_name)));
    // 2. Own: defaults
    (defaultBlueprints as any[]).forEach(bp => addOption(String(bp.output_name)));
    // 3. Clan-only (not personally owned) — show owners as suffix
    (clanBlueprints as any[]).forEach(bp => {
      const nameLC = String(bp.product_name).toLowerCase();
      if (!ownNames.has(nameLC)) {
        addOption(String(bp.product_name), (bp.members as string[]).join(', '));
      }
    });

    // Group by item type, sorted alphabetically
    const groupMap = new Map<string, { typeLabel: string; options: BpOption[] }>();
    for (const opt of options.values()) {
      if (!groupMap.has(opt.type)) groupMap.set(opt.type, { typeLabel: opt.typeLabel, options: [] });
      groupMap.get(opt.type)!.options.push(opt);
    }

    return Array.from(groupMap.values())
      .sort((a, b) => a.typeLabel.localeCompare(b.typeLabel))
      .map(g => ({ ...g, options: g.options.sort((a, b) => a.value.localeCompare(b.value)) }));
  }, [localBlueprints, defaultBlueprints, blueprintMatrix, clanBlueprints]);

  const inv = () => qc.invalidateQueries({ queryKey: ['crafting-jobs'] });

  const addJob = useMutation({
    mutationFn: (d: unknown) => craftingApi.createJob(d),
    onSuccess: inv,
  });
  const removeJob = useMutation({
    mutationFn: (id: number) => craftingApi.removeJob(id),
    onSuccess: inv,
  });
  const completeJob = useMutation({
    mutationFn: (id: number) => craftingApi.updateJob(id, { status: 'complete', completedAt: new Date().toISOString() }),
    onSuccess: inv,
  });
  const addInput = useMutation({
    mutationFn: ({ jobId, d }: { jobId: number; d: unknown }) => craftingApi.addInput(jobId, d),
    onSuccess: inv,
  });
  const removeInput = useMutation({
    mutationFn: (id: number) => craftingApi.removeInput(id),
    onSuccess: inv,
  });

  const getCurrency = (job: any) =>
    (games as any[]).find((g: any) => g.id === job.resolved_game_id)?.currency
    || job.currency
    || 'UEC';

  const inProgress = (jobs as any[]).filter((j: any) => j.status === 'in_progress');
  const completed  = (jobs as any[]).filter((j: any) => j.status === 'complete');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Crafting Workshop</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track manufacturing jobs independently of any run
          </p>
        </div>
      </div>

      {/* ── New job form ── */}
      <Card>
        <CardHeader><CardTitle>New Crafting Job</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <select
            value={jobForm.outputItem}
            onChange={e => setJobForm(f => ({ ...f, outputItem: e.target.value }))}
            className="col-span-2 sm:col-span-2"
          >
            <option value="">— Select blueprint —</option>
            {blueprintGroups.map(group => (
              <optgroup key={group.typeLabel} label={group.typeLabel}>
                {group.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <MathInput
            placeholder="Output quantity *"
            value={jobForm.outputQuantity}
            onChange={e => setJobForm(f => ({ ...f, outputQuantity: e.target.value }))}
          />
          <MathInput
            placeholder="Est. sell value"
            value={jobForm.estimatedValue}
            onChange={e => setJobForm(f => ({ ...f, estimatedValue: e.target.value }))}
          />
        </div>
        <Button
          className="mt-2"
          size="sm"
          onClick={() => {
            if (!scGameId || !jobForm.outputItem || !jobForm.outputQuantity) return;
            addJob.mutate({
              gameId: scGameId,
              outputItem: jobForm.outputItem,
              outputQuantity: Number(jobForm.outputQuantity),
              estimatedValue: jobForm.estimatedValue ? Number(jobForm.estimatedValue) : undefined,
            });
            setJobForm(f => ({ ...f, outputItem: '', outputQuantity: '', estimatedValue: '' }));
          }}
        >
          <Plus size={13} /> Create Job
        </Button>
      </Card>

      {/* ── In-progress jobs ── */}
      {inProgress.length === 0 && completed.length === 0 && (
        <p className="text-sm text-slate-500">No crafting jobs yet — create one above.</p>
      )}

      {inProgress.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">In Progress</h2>
          {inProgress.map((job: any) => {
            const currency = getCurrency(job);
            const totalInputCost = job.total_input_cost ?? 0;
            const margin = job.estimated_value != null ? job.estimated_value - totalInputCost : null;
            const inf = inputForms[job.id] || { material: '', quantityRequired: '', costPerUnit: '' };
            const expanded = expandedJobs[job.id] ?? true;

            return (
              <Card key={job.id}>
                {/* Job header */}
                <div className="flex items-start justify-between mb-2">
                  <button
                    className="flex items-center gap-1.5 text-left min-w-0"
                    onClick={() => setExpandedJobs(f => ({ ...f, [job.id]: !expanded }))}
                  >
                    <ChevronRight
                      size={13}
                      className={`shrink-0 text-slate-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-200">{job.output_item}</span>
                      <span className="ml-2 text-sm text-slate-400">× {job.output_quantity}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge label={job.status} />
                    <Button size="sm" variant="secondary" onClick={() => completeJob.mutate(job.id)}>
                      <CheckCircle size={12} /> Complete
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeJob.mutate(job.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <>
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Input cost</p>
                        <p className="text-red-400">{fmtCurrency(totalInputCost, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Est. value</p>
                        <p className="text-slate-200">
                          {job.estimated_value != null ? fmtCurrency(job.estimated_value, currency) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Est. margin</p>
                        <p className={margin != null ? profitColor(margin) : 'text-slate-500'}>
                          {margin != null ? fmtCurrency(margin, currency) : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Inputs table */}
                    {(job.inputs || []).length > 0 && (
                      <Table>
                        <thead>
                          <tr>
                            <Th>Material</Th>
                            <Th>Qty req.</Th>
                            <Th>Cost/unit</Th>
                            <Th>Total</Th>
                            <Th />
                          </tr>
                        </thead>
                        <tbody>
                          {(job.inputs as any[]).map((inp: any) => (
                            <Tr key={inp.id}>
                              <Td>{inp.material}</Td>
                              <Td>{inp.quantity_required}</Td>
                              <Td className="text-slate-400">
                                {inp.cost_per_unit != null ? fmtCurrency(inp.cost_per_unit, currency) : '—'}
                              </Td>
                              <Td className="text-red-400">
                                {inp.total_cost != null ? fmtCurrency(inp.total_cost, currency) : '—'}
                              </Td>
                              <Td>
                                <Button variant="danger" size="sm" onClick={() => removeInput.mutate(inp.id)}>
                                  <Trash2 size={12} />
                                </Button>
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}

                    {/* Add input row */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <input
                        placeholder="Material"
                        className="flex-1 min-w-[120px]"
                        value={inf.material}
                        onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], material: ev.target.value } }))}
                      />
                      <MathInput
                        placeholder="Qty"
                        className="w-20"
                        value={inf.quantityRequired}
                        onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], quantityRequired: ev.target.value } }))}
                      />
                      <MathInput
                        placeholder="Cost/unit"
                        className="w-24"
                        value={inf.costPerUnit}
                        onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], costPerUnit: ev.target.value } }))}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (!inf.material || !inf.quantityRequired) return;
                          addInput.mutate({
                            jobId: job.id,
                            d: {
                              material: inf.material,
                              quantityRequired: Number(inf.quantityRequired),
                              costPerUnit: inf.costPerUnit ? Number(inf.costPerUnit) : undefined,
                            },
                          });
                          setInputForms(f => ({ ...f, [job.id]: { material: '', quantityRequired: '', costPerUnit: '' } }));
                        }}
                      >
                        <Plus size={12} /> Add Input
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Completed jobs ── */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Completed ({completed.length})
          </h2>
          <Card className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Qty</Th>
                  <Th>Input cost</Th>
                  <Th>Est. value</Th>
                  <Th>Margin</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {completed.map((job: any) => {
                  const currency = getCurrency(job);
                  const totalInputCost = job.total_input_cost ?? 0;
                  const margin = job.estimated_value != null ? job.estimated_value - totalInputCost : null;
                  return (
                    <Tr key={job.id} className="opacity-70">
                      <Td className="font-medium text-slate-300">{job.output_item}</Td>
                      <Td>{job.output_quantity}</Td>
                      <Td className="text-red-400">{fmtCurrency(totalInputCost, currency)}</Td>
                      <Td>{job.estimated_value != null ? fmtCurrency(job.estimated_value, currency) : '—'}</Td>
                      <Td className={margin != null ? profitColor(margin) : 'text-slate-500'}>
                        {margin != null ? fmtCurrency(margin, currency) : '—'}
                      </Td>
                      <Td>
                        <Button variant="danger" size="sm" onClick={() => removeJob.mutate(job.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
