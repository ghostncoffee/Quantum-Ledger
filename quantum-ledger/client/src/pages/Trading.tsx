import { useQuery } from '@tanstack/react-query';
import { runsApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { fmtCurrency, fmtDuration, profitColor } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function Trading() {
  const { data: runs = [] } = useQuery({ queryKey: ['runs', { type: 'trading' }], queryFn: () => runsApi.list({ type: 'trading' }) });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Trading</h1>
        <p className="text-sm text-slate-500 mt-0.5">All trading runs — click a run to manage buy/sell records</p>
      </div>
      <Card className="p-0">
        <Table>
          <thead><tr><Th>Run</Th><Th>Status</Th><Th>Vehicle</Th><Th>Revenue</Th><Th>Cost</Th><Th>Margin</Th><Th>Duration</Th></tr></thead>
          <tbody>
            {(runs as any[]).length === 0 ? (
              <Tr><Td colSpan={7} className="text-center text-slate-500">No trading runs yet. Create a run with type "trading".</Td></Tr>
            ) : (
              (runs as any[]).map((r: any) => (
                <Tr key={r.id}>
                  <Td><Link to={`/runs/${r.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{r.title || `Run #${r.id}`}</Link></Td>
                  <Td><Badge label={r.status} /></Td>
                  <Td className="text-slate-400">{r.vehicle_name || '—'}</Td>
                  <Td className="text-emerald-400">{fmtCurrency(r.total_revenue)}</Td>
                  <Td className="text-red-400">{fmtCurrency(r.total_expenses)}</Td>
                  <Td className={profitColor(r.total_revenue - r.total_expenses)}>{fmtCurrency(r.total_revenue - r.total_expenses)}</Td>
                  <Td className="text-slate-400">{fmtDuration(r.duration_hours)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
