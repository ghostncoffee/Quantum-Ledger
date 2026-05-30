import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Pickaxe, TrendingUp, Wrench, FileText,
  Package, MapPin, Users, Car, BookOpen, ChevronRight, Gamepad2, FlaskConical, Recycle,
} from 'lucide-react';

function GithubIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}
import { cn } from '@/lib/utils';
import logoSvg from '@/assets/logo.svg';

const GITHUB_URL = 'https://github.com/Axiomancer/star-citizen-ledger';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/runs', icon: ChevronRight, label: 'All Runs' },
  { label: '─', divider: true },
  { to: '/mining', icon: Pickaxe, label: 'Mining' },
  { to: '/refining', icon: FlaskConical, label: 'Refining' },
  { to: '/salvaging', icon: Recycle, label: 'Salvaging' },
  { to: '/trading', icon: TrendingUp, label: 'Trading' },
  { to: '/crafting', icon: Wrench, label: 'Crafting' },
  { to: '/contracts', icon: FileText, label: 'Contracts' },
  { label: '─', divider: true },
  { to: '/accounting', icon: BookOpen, label: 'Accounting' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/locations', icon: MapPin, label: 'Locations' },
  { label: '─', divider: true },
  { to: '/crew', icon: Users, label: 'Crew' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/settings', icon: Gamepad2, label: 'Games' },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[#1e2d4f] bg-[#0a0e1a]">
      {/* Logo / app name */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#1e2d4f]">
        <img src={logoSvg} alt="Star Citizen Ledger" className="h-8 w-8 rounded-lg shrink-0" />
        <div className="min-w-0">
          <span className="font-bold text-slate-100 text-sm leading-tight block">SC Ledger</span>
          <span className="text-[10px] text-slate-600 leading-tight block">Star Citizen</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} className="my-2 border-t border-[#1e2d4f]/50" />;
          }
          const Icon = item.icon!;
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-700/40'
                    : 'text-slate-400 hover:bg-[#141c35] hover:text-slate-200'
                )
              }
            >
              <Icon size={15} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer: version + GitHub link */}
      <div className="px-4 py-3 border-t border-[#1e2d4f] flex items-center justify-between">
        <p className="text-xs text-slate-600">v1.0.0 · local only</p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          title="View on GitHub"
          className="text-slate-600 hover:text-slate-300 transition-colors"
        >
          <GithubIcon size={14} />
        </a>
      </div>
    </aside>
  );
}
