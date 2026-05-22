import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  runsApi, miningApi, tradingApi, salesApi, craftingApi,
  contractsApi, haulingApi, expensesApi, crewApi,
} from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { fmtCurrency, fmtDuration, fmtDatetime, profitColor, EXPENSE_CATEGORIES, CONTRACT_TYPES } from '@/lib/utils';
import { Plus, CheckCircle, Trash2, ChevronLeft, DollarSign, Clock, AlertTriangle } from 'lucide-react';

// ─── Sub-panel: Mining Pipeline ───────────────────────────────────────────────
function MiningPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['mining', runId], queryFn: () => miningApi.getPipeline(runId) });
  const { entries = [], refiningJobs = [], sales = [] } = (data as any) || {};

  const addEntry = useMutation({
    mutationFn: (d: unknown) => miningApi.addEntry(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mining', runId] }),
  });
  const addRefining = useMutation({
    mutationFn: (d: unknown) => miningApi.addRefining(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mining', runId] }),
  });
  const addSale = useMutation({
    mutationFn: (d: unknown) => salesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mining', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const removeEntry = useMutation({
    mutationFn: (id: number) => miningApi.removeEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mining', runId] }),
  });
  const removeRefining = useMutation({
    mutationFn: (id: number) => miningApi.removeRefining(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mining', runId] }),
  });
  const removeSale = useMutation({
    mutationFn: (id: number) => salesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mining', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const finishRefining = useMutation({
    mutationFn: ({ id, qty, eff }: { id: number; qty: number; eff: number }) =>
      miningApi.updateRefining(id, { outputQuantity: qty, efficiency: eff, status: 'done', completedAt: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mining', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const [entryForm, setEntryForm] = useState({ rawMaterial: '', quantityRaw: '', location: '' });
  const [refineForm, setRefineForm] = useState({ miningEntryId: '', inputQuantity: '', outputMaterial: '', refineryName: '', refineryMethod: '', costToRefine: '' });
  const [saleForm, setSaleForm] = useState({ refiningJobId: '', commodity: '', quantitySold: '', pricePerUnit: '', location: '' });
  const [finishForm, setFinishForm] = useState<{ [id: number]: { qty: string; eff: string } }>({});

  return (
    <div className="space-y-4">
      {/* Add raw ore */}
      <Card>
        <CardHeader><CardTitle>Add Raw Ore</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Material (e.g. Quantainium)" value={entryForm.rawMaterial} onChange={e => setEntryForm(f => ({ ...f, rawMaterial: e.target.value }))} />
          <input type="number" placeholder="Quantity (SCU)" value={entryForm.quantityRaw} onChange={e => setEntryForm(f => ({ ...f, quantityRaw: e.target.value }))} />
          <input placeholder="Location" value={entryForm.location} onChange={e => setEntryForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!entryForm.rawMaterial || !entryForm.quantityRaw) return;
          addEntry.mutate({ runId, rawMaterial: entryForm.rawMaterial, quantityRaw: Number(entryForm.quantityRaw), location: entryForm.location || undefined });
          setEntryForm({ rawMaterial: '', quantityRaw: '', location: '' });
        }}><Plus size={13} /> Add</Button>
      </Card>

      {(entries as any[]).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Mined Ore</CardTitle></CardHeader>
          <Table>
            <thead><tr><Th>Material</Th><Th>Qty (SCU)</Th><Th>Location</Th><Th>Revenue</Th><Th /></tr></thead>
            <tbody>
              {(entries as any[]).map((e: any) => (
                <Tr key={e.id}>
                  <Td className="font-medium text-slate-200">{e.raw_material}</Td>
                  <Td>{e.quantity_raw}</Td>
                  <Td className="text-slate-500">{e.location || '—'}</Td>
                  <Td className="text-emerald-400">{fmtCurrency(e.revenue, currency)}</Td>
                  <Td><Button variant="danger" size="sm" onClick={() => removeEntry.mutate(e.id)}><Trash2 size={12} /></Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Add refining job */}
      <Card>
        <CardHeader><CardTitle>Send to Refinery</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <select value={refineForm.miningEntryId} onChange={e => setRefineForm(f => ({ ...f, miningEntryId: e.target.value }))}>
            <option value="">Select ore batch</option>
            {(entries as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.raw_material} — {e.quantity_raw} SCU</option>)}
          </select>
          <input placeholder="Output material" value={refineForm.outputMaterial} onChange={e => setRefineForm(f => ({ ...f, outputMaterial: e.target.value }))} />
          <input type="number" placeholder="Input qty" value={refineForm.inputQuantity} onChange={e => setRefineForm(f => ({ ...f, inputQuantity: e.target.value }))} />
          <input placeholder="Refinery name" value={refineForm.refineryName} onChange={e => setRefineForm(f => ({ ...f, refineryName: e.target.value }))} />
          <input placeholder="Method (e.g. Dinyx)" value={refineForm.refineryMethod} onChange={e => setRefineForm(f => ({ ...f, refineryMethod: e.target.value }))} />
          <input type="number" placeholder="Cost to refine" value={refineForm.costToRefine} onChange={e => setRefineForm(f => ({ ...f, costToRefine: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!refineForm.miningEntryId || !refineForm.inputQuantity || !refineForm.outputMaterial) return;
          addRefining.mutate({
            miningEntryId: Number(refineForm.miningEntryId),
            inputQuantity: Number(refineForm.inputQuantity),
            outputMaterial: refineForm.outputMaterial,
            refineryName: refineForm.refineryName || undefined,
            refineryMethod: refineForm.refineryMethod || undefined,
            costToRefine: Number(refineForm.costToRefine) || 0,
          });
          setRefineForm({ miningEntryId: '', inputQuantity: '', outputMaterial: '', refineryName: '', refineryMethod: '', costToRefine: '' });
        }}><Plus size={13} /> Queue Refining</Button>
      </Card>

      {(refiningJobs as any[]).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Refining Jobs</CardTitle></CardHeader>
          <Table>
            <thead><tr><Th>Material</Th><Th>Input</Th><Th>Output</Th><Th>Yield</Th><Th>Cost</Th><Th>Status</Th><Th>Complete</Th><Th /></tr></thead>
            <tbody>
              {(refiningJobs as any[]).map((rj: any) => (
                <Tr key={rj.id}>
                  <Td>{rj.output_material}<br /><span className="text-xs text-slate-500">{rj.refinery_name} · {rj.refinery_method}</span></Td>
                  <Td>{rj.input_quantity} SCU</Td>
                  <Td>{rj.output_quantity != null ? `${rj.output_quantity} SCU` : '—'}</Td>
                  <Td>{rj.efficiency != null ? `${rj.efficiency}%` : '—'}</Td>
                  <Td className="text-red-400">{fmtCurrency(rj.cost_to_refine, currency)}</Td>
                  <Td><Badge label={rj.status} /></Td>
                  <Td>
                    {rj.status !== 'done' && (
                      <div className="flex gap-1">
                        <input type="number" placeholder="Out qty" className="w-20" value={finishForm[rj.id]?.qty || ''} onChange={e => setFinishForm(f => ({ ...f, [rj.id]: { ...f[rj.id], qty: e.target.value } }))} />
                        <input type="number" placeholder="%" className="w-14" value={finishForm[rj.id]?.eff || ''} onChange={e => setFinishForm(f => ({ ...f, [rj.id]: { ...f[rj.id], eff: e.target.value } }))} />
                        <Button size="sm" variant="secondary" onClick={() => {
                          const f = finishForm[rj.id];
                          if (!f?.qty) return;
                          finishRefining.mutate({ id: rj.id, qty: Number(f.qty), eff: Number(f.eff) || 0 });
                        }}><CheckCircle size={12} /></Button>
                      </div>
                    )}
                  </Td>
                  <Td><Button variant="danger" size="sm" onClick={() => removeRefining.mutate(rj.id)}><Trash2 size={12} /></Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Record sale */}
      <Card>
        <CardHeader><CardTitle>Record Sale</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <select value={saleForm.refiningJobId} onChange={e => setSaleForm(f => ({ ...f, refiningJobId: e.target.value }))}>
            <option value="">Link refining job (optional)</option>
            {(refiningJobs as any[]).filter((rj: any) => rj.status === 'done').map((rj: any) => (
              <option key={rj.id} value={rj.id}>{rj.output_material} — {rj.output_quantity} SCU</option>
            ))}
          </select>
          <input placeholder="Commodity" value={saleForm.commodity} onChange={e => setSaleForm(f => ({ ...f, commodity: e.target.value }))} />
          <input type="number" placeholder="Qty sold" value={saleForm.quantitySold} onChange={e => setSaleForm(f => ({ ...f, quantitySold: e.target.value }))} />
          <input type="number" placeholder="Price per unit" value={saleForm.pricePerUnit} onChange={e => setSaleForm(f => ({ ...f, pricePerUnit: e.target.value }))} />
          <input placeholder="Location" value={saleForm.location} onChange={e => setSaleForm(f => ({ ...f, location: e.target.value }))} />
          {saleForm.quantitySold && saleForm.pricePerUnit && (
            <div className="flex items-center text-emerald-400 text-sm font-semibold">
              = {fmtCurrency(Number(saleForm.quantitySold) * Number(saleForm.pricePerUnit), currency)}
            </div>
          )}
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!saleForm.commodity || !saleForm.quantitySold || !saleForm.pricePerUnit) return;
          addSale.mutate({
            runId,
            refiningJobId: saleForm.refiningJobId ? Number(saleForm.refiningJobId) : undefined,
            commodity: saleForm.commodity,
            quantitySold: Number(saleForm.quantitySold),
            pricePerUnit: Number(saleForm.pricePerUnit),
            location: saleForm.location || undefined,
          });
          setSaleForm({ refiningJobId: '', commodity: '', quantitySold: '', pricePerUnit: '', location: '' });
        }}><DollarSign size={13} /> Record Sale</Button>
      </Card>

      {(sales as any[]).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sales</CardTitle></CardHeader>
          <Table>
            <thead><tr><Th>Commodity</Th><Th>Qty</Th><Th>Price/unit</Th><Th>Revenue</Th><Th>Location</Th><Th /></tr></thead>
            <tbody>
              {(sales as any[]).map((s: any) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.commodity}</Td>
                  <Td>{s.quantity_sold}</Td>
                  <Td>{fmtCurrency(s.price_per_unit, currency)}</Td>
                  <Td className="text-emerald-400 font-semibold">{fmtCurrency(s.total_revenue, currency)}</Td>
                  <Td className="text-slate-500">{s.location || '—'}</Td>
                  <Td><Button variant="danger" size="sm" onClick={() => removeSale.mutate(s.id)}><Trash2 size={12} /></Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-panel: Trading ───────────────────────────────────────────────────────
function TradingPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data: entries = [] } = useQuery({ queryKey: ['trading', runId], queryFn: () => tradingApi.getForRun(runId) });

  const [buyForm, setBuyForm] = useState({ commodity: '', quantityBought: '', buyPricePerUnit: '', buyLocation: '', sellLocation: '' });
  const [sellForm, setSellForm] = useState<{ [entryId: number]: { qty: string; price: string; location: string } }>({});

  const addEntry = useMutation({
    mutationFn: (d: unknown) => tradingApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const removeEntry = useMutation({
    mutationFn: (id: number) => tradingApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const recordSale = useMutation({
    mutationFn: (d: unknown) => salesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Buy Commodity</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Commodity" value={buyForm.commodity} onChange={e => setBuyForm(f => ({ ...f, commodity: e.target.value }))} />
          <input type="number" placeholder="Qty bought" value={buyForm.quantityBought} onChange={e => setBuyForm(f => ({ ...f, quantityBought: e.target.value }))} />
          <input type="number" placeholder="Buy price/unit" value={buyForm.buyPricePerUnit} onChange={e => setBuyForm(f => ({ ...f, buyPricePerUnit: e.target.value }))} />
          <input placeholder="Buy location" value={buyForm.buyLocation} onChange={e => setBuyForm(f => ({ ...f, buyLocation: e.target.value }))} />
          <input placeholder="Planned sell location" value={buyForm.sellLocation} onChange={e => setBuyForm(f => ({ ...f, sellLocation: e.target.value }))} />
          {buyForm.quantityBought && buyForm.buyPricePerUnit && (
            <div className="flex items-center text-red-400 text-sm font-semibold">
              Cost: {fmtCurrency(Number(buyForm.quantityBought) * Number(buyForm.buyPricePerUnit), currency)}
            </div>
          )}
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!buyForm.commodity || !buyForm.quantityBought || !buyForm.buyPricePerUnit) return;
          addEntry.mutate({ runId, commodity: buyForm.commodity, quantityBought: Number(buyForm.quantityBought), buyPricePerUnit: Number(buyForm.buyPricePerUnit), buyLocation: buyForm.buyLocation || undefined, sellLocation: buyForm.sellLocation || undefined });
          setBuyForm({ commodity: '', quantityBought: '', buyPricePerUnit: '', buyLocation: '', sellLocation: '' });
        }}><Plus size={13} /> Record Purchase</Button>
      </Card>

      {(entries as any[]).length > 0 && (
        <div className="space-y-3">
          {(entries as any[]).map((e: any) => {
            const remaining = e.quantity_bought - (e.sold_quantity ?? 0);
            const margin = e.revenue > 0 ? e.revenue - e.total_cost : null;
            const sf = sellForm[e.id] || { qty: '', price: '', location: '' };
            return (
              <Card key={e.id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-slate-200">{e.commodity}</span>
                    <span className="ml-2 text-xs text-slate-500">{e.buy_location || '?'} → {e.sell_location || '?'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={e.status} />
                    <Button variant="danger" size="sm" onClick={() => removeEntry.mutate(e.id)}><Trash2 size={12} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                  <div><p className="text-xs text-slate-500">Bought</p><p className="text-slate-200">{e.quantity_bought} @ {fmtCurrency(e.buy_price_per_unit, currency)}</p></div>
                  <div><p className="text-xs text-slate-500">Cost</p><p className="text-red-400">{fmtCurrency(e.total_cost, currency)}</p></div>
                  <div><p className="text-xs text-slate-500">Revenue</p><p className="text-emerald-400">{fmtCurrency(e.revenue, currency)}</p></div>
                  <div><p className="text-xs text-slate-500">Margin</p><p className={margin != null ? profitColor(margin) : 'text-slate-500'}>{margin != null ? fmtCurrency(margin, currency) : '—'}</p></div>
                </div>
                {remaining > 0 && (
                  <div className="border-t border-[#1e2d4f] pt-2">
                    <p className="text-xs text-slate-500 mb-1.5">Record sale ({remaining} remaining)</p>
                    <div className="flex gap-2">
                      <input type="number" placeholder={`Qty (max ${remaining})`} className="w-28" value={sf.qty} onChange={ev => setSellForm(f => ({ ...f, [e.id]: { ...f[e.id], qty: ev.target.value } }))} />
                      <input type="number" placeholder="Price/unit" className="w-28" value={sf.price} onChange={ev => setSellForm(f => ({ ...f, [e.id]: { ...f[e.id], price: ev.target.value } }))} />
                      <input placeholder="Location" className="w-32" value={sf.location} onChange={ev => setSellForm(f => ({ ...f, [e.id]: { ...f[e.id], location: ev.target.value } }))} />
                      <Button size="sm" onClick={() => {
                        if (!sf.qty || !sf.price) return;
                        recordSale.mutate({ runId, tradingEntryId: e.id, commodity: e.commodity, quantitySold: Number(sf.qty), pricePerUnit: Number(sf.price), location: sf.location || undefined });
                        setSellForm(f => ({ ...f, [e.id]: { qty: '', price: '', location: '' } }));
                      }}><DollarSign size={12} /> Sell</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-panel: Hauling ───────────────────────────────────────────────────────
function HaulingPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({
    queryKey: ['hauling', runId],
    queryFn: () => haulingApi.getForRun(runId),
  });

  const [form, setForm] = useState({
    cargoType: '', scuAmount: '', pickupLocation: '',
    deliveryLocation: '', agreedPayout: '', bonusPayout: '', notes: '',
  });

  const add = useMutation({
    mutationFn: (d: unknown) => haulingApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hauling', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => haulingApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hauling', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
    },
  });
  const advance = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      haulingApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hauling', runId] });
      qc.invalidateQueries({ queryKey: ['run', runId] });
    },
  });

  const deliveredTotal = (jobs as any[])
    .filter((j: any) => j.status === 'delivered')
    .reduce((s: number, j: any) => s + j.agreed_payout + (j.bonus_payout || 0), 0);
  const pendingTotal = (jobs as any[])
    .filter((j: any) => j.status !== 'delivered')
    .reduce((s: number, j: any) => s + j.agreed_payout, 0);

  const NEXT_STATUS: Record<string, string> = { pending: 'in_transit', in_transit: 'delivered' };
  const NEXT_LABEL: Record<string, string> = { pending: 'Mark Picked Up', in_transit: 'Mark Delivered' };

  return (
    <div className="space-y-4">
      {(jobs as any[]).length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Contracts" value={String((jobs as any[]).length)} />
          <StatCard label="Earned" value={fmtCurrency(deliveredTotal, currency)} trend="up" />
          <StatCard label="Pending" value={fmtCurrency(pendingTotal, currency)} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Add Hauling Contract</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Cargo type (e.g. Medical Supplies)" value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} />
          <input type="number" placeholder="SCU amount" value={form.scuAmount} onChange={e => setForm(f => ({ ...f, scuAmount: e.target.value }))} />
          <input type="number" placeholder="Agreed payout" value={form.agreedPayout} onChange={e => setForm(f => ({ ...f, agreedPayout: e.target.value }))} />
          <input placeholder="Pickup location" value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))} />
          <input placeholder="Delivery location" value={form.deliveryLocation} onChange={e => setForm(f => ({ ...f, deliveryLocation: e.target.value }))} />
          <input type="number" placeholder="Bonus (optional)" value={form.bonusPayout} onChange={e => setForm(f => ({ ...f, bonusPayout: e.target.value }))} />
          <input placeholder="Notes (optional)" className="col-span-3" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!form.agreedPayout) return;
          add.mutate({
            runId,
            cargoType: form.cargoType || undefined,
            scuAmount: form.scuAmount ? Number(form.scuAmount) : undefined,
            pickupLocation: form.pickupLocation || undefined,
            deliveryLocation: form.deliveryLocation || undefined,
            agreedPayout: Number(form.agreedPayout),
            bonusPayout: Number(form.bonusPayout) || 0,
            notes: form.notes || undefined,
          });
          setForm({ cargoType: '', scuAmount: '', pickupLocation: '', deliveryLocation: '', agreedPayout: '', bonusPayout: '', notes: '' });
        }}><Plus size={13} /> Add Contract</Button>
      </Card>

      {(jobs as any[]).length > 0 && (
        <div className="space-y-3">
          {(jobs as any[]).map((j: any) => (
            <Card key={j.id}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-semibold text-slate-200">{j.cargo_type || 'Unnamed cargo'}</span>
                  {j.scu_amount != null && (
                    <span className="ml-2 text-sm text-slate-400">{j.scu_amount} SCU</span>
                  )}
                  {(j.pickup_location || j.delivery_location) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {j.pickup_location || '?'} → {j.delivery_location || '?'}
                    </p>
                  )}
                  {j.notes && <p className="text-xs text-slate-500 italic mt-0.5">{j.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={j.status} />
                  <Button variant="danger" size="sm" onClick={() => remove.mutate(j.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Payout</p>
                  <p className="text-emerald-400 font-semibold">{fmtCurrency(j.agreed_payout, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bonus</p>
                  <p className="text-amber-400">{j.bonus_payout ? fmtCurrency(j.bonus_payout, currency) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-emerald-400">{fmtCurrency(j.agreed_payout + (j.bonus_payout || 0), currency)}</p>
                </div>
              </div>

              {j.status !== 'delivered' && NEXT_STATUS[j.status] && (
                <div className="mt-2 pt-2 border-t border-[#1e2d4f]">
                  <Button
                    size="sm"
                    variant={j.status === 'in_transit' ? 'primary' : 'secondary'}
                    onClick={() => advance.mutate({ id: j.id, status: NEXT_STATUS[j.status] })}
                  >
                    <CheckCircle size={12} /> {NEXT_LABEL[j.status]}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-panel: Crafting ──────────────────────────────────────────────────────
function CraftingPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({ queryKey: ['crafting', runId], queryFn: () => craftingApi.getForRun(runId) });

  const [jobForm, setJobForm] = useState({ outputItem: '', outputQuantity: '', estimatedValue: '' });
  const [inputForms, setInputForms] = useState<{ [jobId: number]: { material: string; quantityRequired: string; costPerUnit: string } }>({});

  const addJob = useMutation({
    mutationFn: (d: unknown) => craftingApi.createJob(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crafting', runId] }),
  });
  const removeJob = useMutation({
    mutationFn: (id: number) => craftingApi.removeJob(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crafting', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });
  const completeJob = useMutation({
    mutationFn: (id: number) => craftingApi.updateJob(id, { status: 'complete', completedAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crafting', runId] }),
  });
  const addInput = useMutation({
    mutationFn: ({ jobId, d }: { jobId: number; d: unknown }) => craftingApi.addInput(jobId, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crafting', runId] }),
  });
  const removeInput = useMutation({
    mutationFn: (id: number) => craftingApi.removeInput(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crafting', runId] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>New Crafting Job</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Output item" value={jobForm.outputItem} onChange={e => setJobForm(f => ({ ...f, outputItem: e.target.value }))} />
          <input type="number" placeholder="Output quantity" value={jobForm.outputQuantity} onChange={e => setJobForm(f => ({ ...f, outputQuantity: e.target.value }))} />
          <input type="number" placeholder="Est. sell value" value={jobForm.estimatedValue} onChange={e => setJobForm(f => ({ ...f, estimatedValue: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!jobForm.outputItem || !jobForm.outputQuantity) return;
          addJob.mutate({ runId, outputItem: jobForm.outputItem, outputQuantity: Number(jobForm.outputQuantity), estimatedValue: jobForm.estimatedValue ? Number(jobForm.estimatedValue) : undefined });
          setJobForm({ outputItem: '', outputQuantity: '', estimatedValue: '' });
        }}><Plus size={13} /> Create Job</Button>
      </Card>

      {(jobs as any[]).map((job: any) => {
        const inf = inputForms[job.id] || { material: '', quantityRequired: '', costPerUnit: '' };
        const totalInputCost = (job.inputs || []).reduce((s: number, i: any) => s + (i.total_cost ?? 0), 0);
        const margin = job.estimated_value != null ? job.estimated_value - totalInputCost : null;
        return (
          <Card key={job.id}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-semibold text-slate-200">{job.output_item}</span>
                <span className="ml-2 text-sm text-slate-400">× {job.output_quantity}</span>
              </div>
              <div className="flex gap-2 items-center">
                <Badge label={job.status} />
                {job.status !== 'complete' && (
                  <Button size="sm" variant="secondary" onClick={() => completeJob.mutate(job.id)}>
                    <CheckCircle size={12} /> Complete
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => removeJob.mutate(job.id)}><Trash2 size={12} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <div><p className="text-xs text-slate-500">Input cost</p><p className="text-red-400">{fmtCurrency(totalInputCost, currency)}</p></div>
              <div><p className="text-xs text-slate-500">Est. value</p><p className="text-slate-200">{job.estimated_value != null ? fmtCurrency(job.estimated_value, currency) : '—'}</p></div>
              <div><p className="text-xs text-slate-500">Est. margin</p><p className={margin != null ? profitColor(margin) : 'text-slate-500'}>{margin != null ? fmtCurrency(margin, currency) : '—'}</p></div>
            </div>

            {/* Inputs table */}
            {(job.inputs || []).length > 0 && (
              <Table>
                <thead><tr><Th>Material</Th><Th>Qty Req.</Th><Th>Cost/unit</Th><Th>Total</Th><Th /></tr></thead>
                <tbody>
                  {(job.inputs as any[]).map((inp: any) => (
                    <Tr key={inp.id}>
                      <Td>{inp.material}</Td>
                      <Td>{inp.quantity_required}</Td>
                      <Td className="text-slate-400">{inp.cost_per_unit != null ? fmtCurrency(inp.cost_per_unit, currency) : '—'}</Td>
                      <Td className="text-red-400">{inp.total_cost != null ? fmtCurrency(inp.total_cost, currency) : '—'}</Td>
                      <Td><Button variant="danger" size="sm" onClick={() => removeInput.mutate(inp.id)}><Trash2 size={12} /></Button></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}

            {/* Add input */}
            <div className="flex gap-2 mt-2">
              <input placeholder="Material" value={inf.material} onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], material: ev.target.value } }))} />
              <input type="number" placeholder="Qty" className="w-20" value={inf.quantityRequired} onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], quantityRequired: ev.target.value } }))} />
              <input type="number" placeholder="Cost/unit" className="w-24" value={inf.costPerUnit} onChange={ev => setInputForms(f => ({ ...f, [job.id]: { ...f[job.id], costPerUnit: ev.target.value } }))} />
              <Button size="sm" variant="secondary" onClick={() => {
                if (!inf.material || !inf.quantityRequired) return;
                addInput.mutate({ jobId: job.id, d: { material: inf.material, quantityRequired: Number(inf.quantityRequired), costPerUnit: inf.costPerUnit ? Number(inf.costPerUnit) : undefined } });
                setInputForms(f => ({ ...f, [job.id]: { material: '', quantityRequired: '', costPerUnit: '' } }));
              }}><Plus size={12} /> Input</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Sub-panel: Expenses ──────────────────────────────────────────────────────
function ExpensesPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', runId], queryFn: () => expensesApi.list({ runId }) });
  const [form, setForm] = useState({ category: 'fuel', itemName: '', amount: '', notes: '' });

  const add = useMutation({
    mutationFn: (d: unknown) => expensesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => expensesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });

  const total = (expenses as any[]).reduce((s: number, e: any) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Expense / Investment</CardTitle>
          <span className="text-sm text-red-400 font-semibold">Total: {fmtCurrency(total, currency)}</span>
        </CardHeader>
        <div className="grid grid-cols-4 gap-2">
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Item name (e.g. Rieger C3)" value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} />
          <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!form.amount) return;
          add.mutate({ runId, category: form.category, itemName: form.itemName || undefined, amount: Number(form.amount), notes: form.notes || undefined });
          setForm({ category: 'fuel', itemName: '', amount: '', notes: '' });
        }}><Plus size={13} /> Add</Button>
      </Card>

      {(expenses as any[]).length > 0 && (
        <Table>
          <thead><tr><Th>Category</Th><Th>Item</Th><Th>Amount</Th><Th>Date</Th><Th /></tr></thead>
          <tbody>
            {(expenses as any[]).map((e: any) => (
              <Tr key={e.id}>
                <Td><Badge label={e.category} /></Td>
                <Td className="text-slate-300">{e.item_name || '—'}</Td>
                <Td className="text-red-400 font-semibold">{fmtCurrency(e.amount, currency)}</Td>
                <Td className="text-slate-500 text-xs">{e.date}</Td>
                <Td><Button variant="danger" size="sm" onClick={() => remove.mutate(e.id)}><Trash2 size={12} /></Button></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ─── Sub-panel: Crew Payouts ──────────────────────────────────────────────────
function CrewPanel({ runId, currency, profit }: { runId: number; currency: string; profit: number }) {
  const qc = useQueryClient();
  const { data: crewList = [] } = useQuery({ queryKey: ['run-crew', runId], queryFn: () => runsApi.getCrew(runId) });
  const { data: allCrew = [] } = useQuery({ queryKey: ['crew'], queryFn: () => crewApi.list() });

  const [form, setForm] = useState({ crewMemberId: '', role: '', payoutType: 'percentage', payoutValue: '' });

  const add = useMutation({
    mutationFn: (d: unknown) => runsApi.addCrew(runId, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run-crew', runId] }),
  });
  const settle = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      runsApi.updateCrew(runId, id, { payoutSettled: true, actualPayout: amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run-crew', runId] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => runsApi.removeCrew(runId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run-crew', runId] }),
  });

  const calcPayout = (c: any) => {
    if (c.payout_type === 'percentage') return (profit * c.payout_value) / 100;
    return c.payout_value;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add Crew Member</CardTitle></CardHeader>
        <div className="grid grid-cols-4 gap-2">
          <select value={form.crewMemberId} onChange={e => setForm(f => ({ ...f, crewMemberId: e.target.value }))}>
            <option value="">Select member</option>
            {(allCrew as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input placeholder="Role (e.g. Pilot)" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          <select value={form.payoutType} onChange={e => setForm(f => ({ ...f, payoutType: e.target.value }))}>
            <option value="percentage">% of profit</option>
            <option value="fixed">Fixed amount</option>
          </select>
          <input type="number" placeholder={form.payoutType === 'percentage' ? '25 (%)' : '50000'} value={form.payoutValue} onChange={e => setForm(f => ({ ...f, payoutValue: e.target.value }))} />
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!form.crewMemberId) return;
          add.mutate({ crewMemberId: Number(form.crewMemberId), role: form.role || undefined, payoutType: form.payoutType, payoutValue: Number(form.payoutValue) || 0 });
          setForm({ crewMemberId: '', role: '', payoutType: 'percentage', payoutValue: '' });
        }}><Plus size={13} /> Add</Button>
      </Card>

      <p className="text-xs text-slate-500">Run profit: <span className={profitColor(profit)}>{fmtCurrency(profit, currency)}</span></p>

      {(crewList as any[]).length > 0 && (
        <Table>
          <thead><tr><Th>Member</Th><Th>Role</Th><Th>Payout</Th><Th>Calculated</Th><Th>Settled</Th><Th /></tr></thead>
          <tbody>
            {(crewList as any[]).map((c: any) => {
              const calc = calcPayout(c);
              return (
                <Tr key={c.id}>
                  <Td className="font-medium text-slate-200">{c.member_name}</Td>
                  <Td className="text-slate-500">{c.role || '—'}</Td>
                  <Td>{c.payout_type === 'percentage' ? `${c.payout_value}%` : fmtCurrency(c.payout_value, currency)}</Td>
                  <Td className="text-amber-400 font-semibold">{fmtCurrency(calc, currency)}</Td>
                  <Td>
                    {c.payout_settled
                      ? <span className="text-emerald-400 text-xs">✓ {fmtCurrency(c.actual_payout, currency)}</span>
                      : <Button size="sm" variant="secondary" onClick={() => settle.mutate({ id: c.id, amount: calc })}>
                          <CheckCircle size={12} /> Mark paid
                        </Button>
                    }
                  </Td>
                  <Td><Button variant="danger" size="sm" onClick={() => remove.mutate(c.id)}><Trash2 size={12} /></Button></Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ─── Sub-panel: Contracts ─────────────────────────────────────────────────────
function ContractsPanel({ runId, currency }: { runId: number; currency: string }) {
  const qc = useQueryClient();
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts', runId], queryFn: () => contractsApi.getForRun(runId) });
  const [form, setForm] = useState({
    type: 'combat', clientName: '', description: '', agreedPayout: '', bonusPayout: '',
    // Hauling-specific
    cargoType: '', scuAmount: '', pickupLocation: '', deliveryLocation: '',
  });

  const add = useMutation({
    mutationFn: (d: unknown) => contractsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });
  const complete = useMutation({
    mutationFn: (id: number) => contractsApi.complete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => contractsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts', runId] }); qc.invalidateQueries({ queryKey: ['run', runId] }); },
  });

  const isHauling = form.type === 'hauling';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add Contract</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-2">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Client name" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <input type="number" placeholder="Agreed payout" value={form.agreedPayout} onChange={e => setForm(f => ({ ...f, agreedPayout: e.target.value }))} />
          <input type="number" placeholder="Bonus (optional)" value={form.bonusPayout} onChange={e => setForm(f => ({ ...f, bonusPayout: e.target.value }))} />

          {/* Hauling-specific fields — only shown when type = hauling */}
          {isHauling && (
            <>
              <div className="col-span-3 border-t border-[#1e2d4f] pt-2">
                <p className="text-xs text-slate-500 mb-2">Hauling details</p>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Cargo type (e.g. Medical Supplies)" value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} />
                  <input type="number" placeholder="SCU amount" value={form.scuAmount} onChange={e => setForm(f => ({ ...f, scuAmount: e.target.value }))} />
                  <div />
                  <input placeholder="Pickup location" value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))} />
                  <input placeholder="Delivery location" value={form.deliveryLocation} onChange={e => setForm(f => ({ ...f, deliveryLocation: e.target.value }))} />
                </div>
              </div>
            </>
          )}
        </div>
        <Button className="mt-2" size="sm" onClick={() => {
          if (!form.agreedPayout) return;
          add.mutate({
            runId, type: form.type,
            clientName: form.clientName || undefined,
            description: form.description || undefined,
            agreedPayout: Number(form.agreedPayout),
            bonusPayout: Number(form.bonusPayout) || 0,
            ...(isHauling && {
              cargoType: form.cargoType || undefined,
              scuAmount: form.scuAmount ? Number(form.scuAmount) : undefined,
              pickupLocation: form.pickupLocation || undefined,
              deliveryLocation: form.deliveryLocation || undefined,
            }),
          });
          setForm({ type: 'combat', clientName: '', description: '', agreedPayout: '', bonusPayout: '', cargoType: '', scuAmount: '', pickupLocation: '', deliveryLocation: '' });
        }}><Plus size={13} /> Add</Button>
      </Card>

      {(contracts as any[]).length > 0 && (
        <Table>
          <thead><tr><Th>Type</Th><Th>Client</Th><Th>Payout</Th><Th>Bonus</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {(contracts as any[]).map((c: any) => (
              <Tr key={c.id}>
                <Td>
                  <Badge label={c.type} />
                  {c.type === 'hauling' && (c.cargo_type || c.scu_amount) && (
                    <p className="text-xs text-slate-500 mt-1">
                      {c.cargo_type}{c.scu_amount != null ? ` · ${c.scu_amount} SCU` : ''}
                      {c.pickup_location && ` · ${c.pickup_location} → ${c.delivery_location || '?'}`}
                    </p>
                  )}
                </Td>
                <Td className="text-slate-300">{c.client_name || '—'}</Td>
                <Td className="text-emerald-400">{fmtCurrency(c.agreed_payout, currency)}</Td>
                <Td className="text-amber-400">{c.bonus_payout ? fmtCurrency(c.bonus_payout, currency) : '—'}</Td>
                <Td><Badge label={c.status} /></Td>
                <Td>
                  <div className="flex gap-1">
                    {c.status === 'active' && (
                      <Button size="sm" variant="secondary" onClick={() => complete.mutate(c.id)}>
                        <CheckCircle size={12} /> Complete
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => remove.mutate(c.id)}><Trash2 size={12} /></Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ─── Delete Run confirmation modal ────────────────────────────────────────────
function DeleteRunModal({ runId, runTitle, open, onClose }: { runId: number; runTitle: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => runsApi.remove(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
      navigate('/runs');
    },
  });
  return (
    <Modal open={open} onClose={onClose} title="Delete Run">
      <div className="space-y-4">
        <div className="flex gap-3 items-start">
          <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300">
            Permanently delete <strong className="text-slate-100">"{runTitle}"</strong>?
            All mining entries, refining jobs, trading entries, crafting jobs, contracts, expenses, and crew assignments will be removed.
            This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 size={13} /> {del.isPending ? 'Deleting…' : 'Delete Run'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main RunDetail page ──────────────────────────────────────────────────────
const TABS = ['overview', 'mining', 'trading', 'hauling', 'crafting', 'contracts', 'expenses', 'crew'] as const;
type Tab = typeof TABS[number];

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const runId = Number(id);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: run, isLoading } = useQuery({ queryKey: ['run', runId], queryFn: () => runsApi.get(runId) });

  const completeMut = useMutation({
    mutationFn: () => runsApi.complete(runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
  });

  if (isLoading) return <div className="text-slate-500 p-8">Loading…</div>;
  if (!run) return <div className="text-red-400 p-8">Run not found</div>;

  const r = run as any;
  const currency = r.currency || 'UEC';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/runs" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-2">
            <ChevronLeft size={14} /> All Runs
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">{r.title || `Run #${r.id}`}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge label={r.type} />
            <Badge label={r.status} />
            <span className="text-sm text-slate-500">{r.game_name}</span>
            {r.vehicle_name && <span className="text-sm text-slate-500">· {r.vehicle_name}</span>}
            {r.location && <span className="text-sm text-slate-500">· {r.location}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {r.status === 'active' && (
            <Button onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
              <CheckCircle size={14} /> End Run
            </Button>
          )}
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Timing */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="flex items-center gap-1"><Clock size={13} /> Started: {fmtDatetime(r.started_at)}</span>
        {r.ended_at && <span>Ended: {fmtDatetime(r.ended_at)}</span>}
        {r.durationHours != null && <span>Duration: <strong className="text-slate-300">{fmtDuration(r.durationHours)}</strong></span>}
      </div>

      {/* P&L summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={fmtCurrency(r.revenue, currency)} trend="up" />
        <StatCard label="Expenses" value={fmtCurrency(r.costs, currency)} trend="down" />
        <StatCard label="Net Profit" value={fmtCurrency(r.profit, currency)} trend={r.profit >= 0 ? 'up' : 'down'} />
        <StatCard
          label={r.durationHours ? `${currency}/hr` : 'Crew'}
          value={r.durationHours
            ? fmtCurrency(Math.round(r.profit / r.durationHours), currency)
            : `${(r.crew || []).length} member(s)`}
          sub={r.durationHours ? fmtDuration(r.durationHours) : undefined}
        />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[#1e2d4f] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Run Details</CardTitle></CardHeader>
              <dl className="space-y-2 text-sm">
                {[
                  ['Game', r.game_name],
                  ['Vehicle', r.vehicle_name || '—'],
                  ['Location', r.location || '—'],
                  ['Notes', r.notes || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardHeader><CardTitle>Crew ({(r.crew || []).length})</CardTitle></CardHeader>
              {(r.crew || []).length === 0 ? (
                <p className="text-sm text-slate-500">No crew assigned.</p>
              ) : (
                <div className="space-y-1.5">
                  {(r.crew || []).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-[#0f1629] px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-slate-200">{c.member_name}</span>
                        {c.role && <span className="ml-2 text-xs text-slate-500">{c.role}</span>}
                      </div>
                      <span className="text-xs text-amber-400">
                        {c.payout_type === 'percentage' ? `${c.payout_value}%` : fmtCurrency(c.payout_value, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
        {tab === 'mining' && <MiningPanel runId={runId} currency={currency} />}
        {tab === 'trading' && <TradingPanel runId={runId} currency={currency} />}
        {tab === 'hauling' && <HaulingPanel runId={runId} currency={currency} />}
        {tab === 'crafting' && <CraftingPanel runId={runId} currency={currency} />}
        {tab === 'contracts' && <ContractsPanel runId={runId} currency={currency} />}
        {tab === 'expenses' && <ExpensesPanel runId={runId} currency={currency} />}
        {tab === 'crew' && <CrewPanel runId={runId} currency={currency} profit={r.profit} />}
      </div>

      <DeleteRunModal runId={runId} runTitle={r.title || `Run #${r.id}`} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
