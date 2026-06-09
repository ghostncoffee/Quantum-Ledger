import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi, gamesApi, runsApi } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { fmtCurrency, fmtDuration, profitColor, RUN_TYPES, findStarCitizenGame } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const [typeFilter, setTypeFilter] = useState('');
  const { data: games = [] } = useQuery({ queryKey: ['games'], queryFn: () => gamesApi.list() });
  const scGame = findStarCitizenGame(games as any[]);
  const scGameId = scGame?.id;

  const { data: summary = [] } = useQuery({ queryKey: ['accounting-summary', scGameId], queryFn: () => accountingApi.summary(scGameId ? { gameId: scGameId } : undefined) });
  const { data: activeRuns = [] } = useQuery({
    queryKey: ['runs-active', scGameId, typeFilter],
    queryFn: () => runsApi.list({ status: 'active', ...(typeFilter ? { type: typeFilter } : {}), gameId: scGameId }),
  });
  const { data: allRuns = [] } = useQuery({
    queryKey: ['runs-report', scGameId, typeFilter],
    queryFn: () => accountingApi.runsReport({ gameId: scGameId, ...(typeFilter ? { type: typeFilter } : {}) }),
  });

  // Stats from the (filtered) runs report
  const filteredRevenue = (allRuns as any[]).reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);
  const filteredExpenses = (allRuns as any[]).reduce((s: number, r: any) => s + (r.expenses ?? 0), 0);
  const filteredProfit = (allRuns as any[]).reduce((s: number, r: any) => s + (r.profit ?? 0), 0);
  const filteredCrewPayouts = (allRuns as any[]).reduce((s: number, r: any) => s + (r.crew_payouts ?? 0), 0);

  // Unfiltered totals for the per-game summary (always shows full picture)
  const totalIncome = (summary as any[]).reduce((s: number, g: any) => s + g.total_income, 0);
  const totalExpenses = (summary as any[]).reduce((s: number, g: any) => s + g.total_expenses + g.total_investment, 0);
  const totalNet = (summary as any[]).reduce((s: number, g: any) => s + g.net, 0);
  const totalCrewPayouts = (summary as any[]).reduce((s: number, g: any) => s + g.total_crew_payouts, 0);

  const showingFiltered = !!typeFilter;
  const recentRuns = (allRuns as any[]).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your game economy at a glance</p>
        </div>
        {/* Activity filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter activity:</span>
          <select className="w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Summary stats — filtered when a type is selected */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showingFiltered ? (
          <>
            <StatCard label={`Revenue (${typeFilter})`} value={fmtCurrency(filteredRevenue)} trend="up" />
            <StatCard label={`Expenses (${typeFilter})`} value={fmtCurrency(filteredExpenses)} trend="down" />
            <StatCard label={`Net Profit (${typeFilter})`} value={fmtCurrency(filteredProfit)} trend={filteredProfit >= 0 ? 'up' : 'down'} />
            <StatCard label={`Crew Payouts (${typeFilter})`} value={fmtCurrency(filteredCrewPayouts)} />
          </>
        ) : (
          <>
            <StatCard label="Total Revenue" value={fmtCurrency(totalIncome)} trend="up" />
            <StatCard label="Total Expenses" value={fmtCurrency(totalExpenses)} trend="down" />
            <StatCard label="Net Profit" value={fmtCurrency(totalNet)} trend={totalNet >= 0 ? 'up' : 'down'} />
            <StatCard label="Crew Payouts" value={fmtCurrency(totalCrewPayouts)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Star Citizen summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Star Citizen Summary</CardTitle>
            {showingFiltered && <span className="text-xs text-slate-500">Totals across all activity types</span>}
          </CardHeader>
          {(summary as any[]).length === 0 ? (
            <p className="text-sm text-slate-500">No data yet. Start a run to see stats here.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Revenue</Th>
                  <Th>Expenses</Th>
                  <Th>Net</Th>
                </tr>
              </thead>
              <tbody>
                {(summary as any[]).map((g: any) => (
                  <Tr key={g.game_id}>
                    <Td><span className="text-emerald-400">{fmtCurrency(g.total_income, g.currency)}</span></Td>
                    <Td><span className="text-red-400">{fmtCurrency(g.total_expenses + g.total_investment, g.currency)}</span></Td>
                    <Td><span className={profitColor(g.net)}>{fmtCurrency(g.net, g.currency)}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Active runs */}
        <Card>
          <CardHeader>
            <CardTitle>Active Runs{showingFiltered ? ` (${typeFilter})` : ''}</CardTitle>
          </CardHeader>
          {(activeRuns as any[]).length === 0 ? (
            <p className="text-sm text-slate-500">No active runs{showingFiltered ? ` of type "${typeFilter}"` : ''}.</p>
          ) : (
            <div className="space-y-2">
              {(activeRuns as any[]).map((r: any) => (
                <Link
                  key={r.id}
                  to={`/runs/${r.id}`}
                  className="flex items-center justify-between rounded-lg p-2.5 hover:bg-[#1a2444] transition-colors border border-[#1e2d4f]"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.title || `Run #${r.id}`}</p>
                    <p className="text-xs text-slate-500">{r.vehicle_name || 'No vehicle'}</p>
                  </div>
                  <Badge label={r.type} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent runs table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs{showingFiltered ? ` — ${typeFilter} only` : ''}</CardTitle>
          <Link to="/runs" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>Run</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Revenue</Th>
              <Th>Expenses</Th>
              <Th>Profit</Th>
              <Th>Duration</Th>
              <Th>UEC/hr</Th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.length === 0 ? (
              <Tr>
                <Td className="text-slate-500" colSpan={8}>
                  {showingFiltered ? `No ${typeFilter} runs yet.` : 'No runs yet. Create your first run!'}
                </Td>
              </Tr>
            ) : (
              recentRuns.map((r: any) => (
                <Tr key={r.id} onClick={() => window.location.href = `/runs/${r.id}`}>
                  <Td>
                    <div>
                      <span className="font-medium text-slate-200">{r.title || `Run #${r.id}`}</span>
                      {r.vehicle_name && <p className="text-xs text-slate-500">{r.vehicle_name}</p>}
                    </div>
                  </Td>
                  <Td><Badge label={r.type} /></Td>
                  <Td><Badge label={r.status} /></Td>
                  <Td className="text-emerald-400">{fmtCurrency(r.revenue)}</Td>
                  <Td className="text-red-400">{fmtCurrency(r.expenses)}</Td>
                  <Td className={profitColor(r.profit)}>{fmtCurrency(r.profit)}</Td>
                  <Td className="text-slate-400">{fmtDuration(r.duration_hours)}</Td>
                  <Td className={r.profitPerHour != null ? profitColor(r.profitPerHour) : 'text-slate-500'}>
                    {r.profitPerHour != null ? fmtCurrency(r.profitPerHour) : '—'}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
