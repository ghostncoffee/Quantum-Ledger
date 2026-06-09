import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salvageApi } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, CheckCircle, RotateCcw, Trash2, ExternalLink } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function totalScu(lines: any[]): number {
  return lines.reduce((s: number, l: any) => s + (l.quantity_scu || 0), 0);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Salvaging() {
  const qc = useQueryClient();
  const { data: rawHauls = [] } = useQuery({
    queryKey: ['salvage-hauls'],
    queryFn: () => salvageApi.getHauls(),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['salvage-hauls'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  };

  const commitHaul  = useMutation({ mutationFn: ({ id, loc }: { id: number; loc: string }) => salvageApi.commitHaul(id, loc), onSuccess: inv });
  const uncommit    = useMutation({ mutationFn: (id: number) => salvageApi.uncommitHaul(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['salvage-hauls'] }) });
  const removeHaul  = useMutation({ mutationFn: (id: number) => salvageApi.removeHaul(id), onSuccess: inv });

  const [commitLoc,  setCommitLoc]  = useState<Record<number, string>>({});
  const [committing, setCommitting] = useState<Record<number, boolean>>({});
  const [checkedIn,  setCheckedIn]  = useState(false); // collapsed state for done section

  const hauls       = rawHauls as any[];
  const inTransit   = hauls.filter(h => !h.committed);
  const checkedInHs = hauls.filter(h => h.committed);

  const totalInTransitScu = inTransit.reduce((s, h) => s + totalScu(h.lines || []), 0);

  const renderHaul = (h: any, showCommit: boolean) => {
    const lines = h.lines || [];
    const scu   = totalScu(lines);
    const isCommitting = committing[h.id];

    return (
      <div key={h.id} className="py-3 border-b border-slate-700/30 last:border-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-200 text-sm">{h.label}</span>
              <span className="text-xs text-orange-400">{scu.toFixed(2)} SCU</span>
              {h.committed && (
                <Badge label="checked in" />
              )}
              {h.committed_location && (
                <span className="text-xs text-slate-500">@ {h.committed_location}</span>
              )}
            </div>
            {h.run_title && (
              <Link to={`/runs/${h.run_id}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 mt-0.5">
                {h.run_title} <ExternalLink size={10} />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {h.committed ? (
              <Button size="sm" variant="secondary" onClick={() => uncommit.mutate(h.id)}>
                <RotateCcw size={11} /> Undo
              </Button>
            ) : showCommit && (
              <Button size="sm" variant="secondary" onClick={() => setCommitting(f => ({ ...f, [h.id]: !isCommitting }))}>
                <CheckCircle size={11} /> {isCommitting ? 'Cancel' : 'Check In'}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => removeHaul.mutate(h.id)}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {/* Check-in form */}
        {isCommitting && (
          <div className="mt-2 flex gap-2 items-center ml-2">
            <input
              className="flex-1"
              placeholder="Station / location"
              value={commitLoc[h.id] || ''}
              onChange={e => setCommitLoc(f => ({ ...f, [h.id]: e.target.value }))}
            />
            <Button size="sm" onClick={() => {
              commitHaul.mutate({ id: h.id, loc: commitLoc[h.id] || '' });
              setCommitting(f => { const n = { ...f }; delete n[h.id]; return n; });
              setCommitLoc(f => { const n = { ...f }; delete n[h.id]; return n; });
            }}>
              <CheckCircle size={12} /> Confirm
            </Button>
          </div>
        )}

        {/* Lines */}
        {lines.length > 0 && (
          <div className="mt-2 ml-2 space-y-0.5">
            {lines.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 text-xs">
                <span className="text-slate-300 font-medium w-36 truncate">{l.material}</span>
                <span className="text-orange-300">{l.quantity_scu.toFixed(2)} SCU</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Salvaging</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track salvage hauls — check in at a station to stock inventory</p>
        </div>
      </div>

      {/* Stats */}
      {hauls.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {inTransit.length > 0 && (
            <div className="rounded-xl border border-[#1e2d4f] bg-[#141c35] px-4 py-3">
              <p className="text-xs text-slate-500">In transit</p>
              <p className="text-xl font-bold text-amber-400">{inTransit.length} haul{inTransit.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-orange-400">{totalInTransitScu.toFixed(2)} SCU</p>
            </div>
          )}
          {checkedInHs.length > 0 && (
            <div className="rounded-xl border border-[#1e2d4f] bg-[#141c35] px-4 py-3">
              <p className="text-xs text-slate-500">Checked in</p>
              <p className="text-xl font-bold text-emerald-400">{checkedInHs.length} haul{checkedInHs.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      )}

      {/* In-transit hauls */}
      {inTransit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>In Transit ({inTransit.length})</CardTitle>
            <span className="text-xs text-slate-500">Salvage you're carrying — check in when you dock</span>
          </CardHeader>
          <div>{inTransit.map(h => renderHaul(h, true))}</div>
        </Card>
      )}

      {/* Checked-in hauls */}
      {checkedInHs.length > 0 && (
        <Card>
          <button className="flex items-center gap-2 w-full text-left"
            onClick={() => setCheckedIn(v => !v)}>
            <ChevronRight size={13} className={`text-slate-500 transition-transform ${checkedIn ? 'rotate-90' : ''}`} />
            <CardTitle>Checked In ({checkedInHs.length})</CardTitle>
            <span className="text-xs text-slate-500 ml-1">— materials are in inventory</span>
          </button>
          {checkedIn && <div className="mt-2">{checkedInHs.map(h => renderHaul(h, false))}</div>}
        </Card>
      )}

      {hauls.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 font-medium">No salvage hauls yet</p>
          <p className="text-sm text-slate-600 mt-1">
            Create a run with type <strong className="text-slate-400">salvage</strong> and log your hauls from the run's Salvage tab.
          </p>
        </div>
      )}
    </div>
  );
}
