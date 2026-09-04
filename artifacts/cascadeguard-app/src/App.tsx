import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAnalyzeCascade, useGetNepalScenario, useHealthCheck } from '@workspace/api-client-react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  FileSearch,
  Info,
  Layers3,
  LoaderCircle,
  MapPin,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Waves,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type StatusTone = 'lime' | 'orange' | 'blue' | 'muted' | 'red';

function StatusPill({ children, tone = 'muted', dot = true }: { children: ReactNode; tone?: StatusTone; dot?: boolean }) {
  const tones: Record<StatusTone, string> = {
    lime: 'border-[#bddb37]/50 bg-[#eff8cb] text-[#465d12]',
    orange: 'border-[#e1a18c] bg-[#fff0eb] text-[#9d3c26]',
    blue: 'border-[#9cc3cf] bg-[#e9f5f7] text-[#286271]',
    muted: 'border-[#d4d1c4] bg-[#f2f0e9] text-[#62665f]',
    red: 'border-[#df9c96] bg-[#fff0ef] text-[#a5342b]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tones[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${tone === 'lime' ? 'bg-[#8dab20]' : tone === 'orange' ? 'bg-[#d76e4a]' : tone === 'blue' ? 'bg-[#4e94a4]' : tone === 'red' ? 'bg-[#c14c42]' : 'bg-[#888b80]'}`} />}
      {children}
    </span>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="mono-label mb-1 text-[#73786f]">{eyebrow}</div>
        <h2 className="font-[var(--app-font-serif)] text-[20px] font-bold tracking-[-.03em] text-[#202733]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#deddd3] ${className}`} />;
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-[236px]'} hidden shrink-0 flex-col bg-[#202733] text-[#f0f0e6] transition-[width] duration-300 md:flex`}>
      <div className="flex h-[74px] items-center border-b border-[#39404b] px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#d7f94e] text-[#202733]">
            <Waves size={19} strokeWidth={2.8} />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-[#202733] bg-[#e47d59]" />
          </div>
          {!collapsed && <div className="whitespace-nowrap"><div className="font-[var(--app-font-serif)] text-[18px] font-bold tracking-[-.04em]">Cascade<span className="text-[#d7f94e]">Guard</span></div><div className="mono-label mt-0.5 text-[#8b949e]">decision support</div></div>}
        </div>
      </div>
      <div className="flex-1 px-3 py-6">
        {!collapsed && <div className="mono-label mb-3 px-3 text-[#79838c]">control room</div>}
        <nav className="space-y-1">
          <button data-testid="button-nav-investigation" className="flex w-full items-center gap-3 rounded-md border border-[#4e5960] bg-[#303946] px-3 py-2.5 text-left text-sm font-semibold text-[#f5f5eb] shadow-[inset_3px_0_0_#d7f94e]">
            <Activity size={16} className="shrink-0 text-[#d7f94e]" />
            {!collapsed && <span>Investigation</span>}
          </button>
          <button data-testid="button-nav-scenarios" onClick={() => document.getElementById('scenario-section')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[#aab1b2] transition hover:bg-[#303946] hover:text-white">
            <Layers3 size={16} className="shrink-0" />
            {!collapsed && <span>Scenario library</span>}
          </button>
          <button data-testid="button-nav-evidence" onClick={() => document.getElementById('evidence-section')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[#aab1b2] transition hover:bg-[#303946] hover:text-white">
            <Database size={16} className="shrink-0" />
            {!collapsed && <span>Evidence ledger</span>}
          </button>
        </nav>
        {!collapsed && (
          <div className="mt-9">
            <div className="mono-label mb-3 px-3 text-[#79838c]">system</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2 text-xs text-[#aab1b2]"><span>Replay engine</span><span className="h-1.5 w-1.5 rounded-full bg-[#d7f94e]" /></div>
              <div className="flex items-center justify-between px-3 py-2 text-xs text-[#aab1b2]"><span>Evidence index</span><span className="h-1.5 w-1.5 rounded-full bg-[#d7f94e]" /></div>
              <div className="flex items-center justify-between px-3 py-2 text-xs text-[#aab1b2]"><span>Provider gateway</span><span className="h-1.5 w-1.5 rounded-full bg-[#e1a060]" /></div>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-[#39404b] p-3">
        <button data-testid="button-toggle-sidebar" onClick={onToggle} className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[#aab1b2] transition hover:bg-[#303946] hover:text-white">
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /><span className="text-xs">Collapse rail</span></>}
        </button>
      </div>
    </aside>
  );
}

function TopBar({ healthOk, onMobileMenu }: { healthOk: boolean; onMobileMenu: () => void }) {
  return (
    <header className="flex h-[74px] items-center justify-between border-b border-[#d4d1c4] bg-[#f2f0e8]/90 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button data-testid="button-open-mobile-menu" onClick={onMobileMenu} className="rounded-md p-2 text-[#586068] hover:bg-[#e3e1d8] md:hidden"><Menu size={19} /></button>
        <div className="hidden items-center gap-2 text-xs text-[#73786f] md:flex"><span>Operations</span><ChevronRight size={13} /><span className="font-semibold text-[#202733]">Investigation control room</span></div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#202733] md:hidden">CascadeGuard <span className="text-[#8fae21]">/</span> Nepal replay</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-[11px] text-[#73786f] sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${healthOk ? 'bg-[#85a91d]' : 'bg-[#d76e4a]'}`} /> API {healthOk ? 'operational' : 'unavailable'}</div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d9d5ca] text-xs font-bold text-[#3b444d]" title="Operations planner">OP</div>
      </div>
    </header>
  );
}

function ScenarioStrip({ scenario, isLoading, isError, onRetry }: { scenario: any; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  if (isLoading) return <div className="border-b border-[#d4d1c4] bg-[#f2f0e8] px-4 py-3 md:px-8"><div className="flex gap-3"><SkeletonBlock className="h-4 w-20" /><SkeletonBlock className="h-4 w-44" /><SkeletonBlock className="h-4 w-28" /></div></div>;
  if (isError || !scenario) return <div className="flex items-center justify-between border-b border-[#df9c96] bg-[#fff0ef] px-4 py-3 text-xs text-[#9b392f] md:px-8"><span className="flex items-center gap-2"><AlertCircle size={14} /> Scenario source could not be loaded.</span><button data-testid="button-retry-scenario" onClick={onRetry} className="font-bold underline">Retry</button></div>;
  return (
    <div id="scenario-section" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#d4d1c4] bg-[#f2f0e8] px-4 py-3 md:px-8">
      <StatusPill tone="orange">Replay</StatusPill>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#333d46]"><MapPin size={13} className="text-[#d76e4a]" />{scenario.region}</span>
      <span className="text-xs text-[#73786f]">{scenario.event}</span>
      <span className="hidden text-xs text-[#a2a096] sm:inline">/</span>
      <span className="hidden text-xs text-[#73786f] sm:inline">{scenario.title}</span>
      <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8178]"><ShieldCheck size={13} className="text-[#91b01f]" /> Source-linked replay</span>
    </div>
  );
}

function TracePanel({ trace, isPending }: { trace: any[]; isPending: boolean }) {
  const items = trace.length ? trace : [
    { id: 'observe', label: 'Observe event', detail: 'Waiting for investigation run', status: 'active' },
    { id: 'map', label: 'Map dependencies', detail: 'Infrastructure links will be tested', status: 'warning' },
    { id: 'rank', label: 'Rank interventions', detail: 'Evidence-backed recommendation', status: 'warning' },
  ];
  return (
    <div className="rounded-lg border border-[#d4d1c4] bg-[#f5f3eb] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div><div className="mono-label text-[#7a8077]">safe investigation trace</div><div className="mt-1 text-sm font-bold text-[#202733]">{isPending ? 'Investigation in progress' : 'Bounded reasoning path'}</div></div>
        <span className={`grid h-8 w-8 place-items-center rounded-full ${isPending ? 'bg-[#fff0eb] text-[#d76e4a]' : 'bg-[#eaf5c0] text-[#6c8b12]'}`}>{isPending ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}</span>
      </div>
      <div className="relative space-y-3 pl-7">
        <div className="absolute bottom-5 left-[9px] top-4 w-px bg-[#d3d0c4]" />
        {items.map((item, index) => {
          const state = item.status === 'complete' ? 'complete' : item.status === 'active' ? 'active' : 'warning';
          return <div key={item.id ?? index} className="relative flex gap-3 animate-rise-in" style={{ animationDelay: `${index * 70}ms` }}>
            <div className={`absolute -left-7 top-0.5 grid h-[19px] w-[19px] place-items-center rounded-full border-2 border-[#f5f3eb] ${state === 'complete' ? 'bg-[#b8d936] text-[#3f5412]' : state === 'active' ? 'bg-[#e47d59] text-white' : 'bg-[#d8d5ca] text-[#777b73]'}`}>
              {state === 'complete' ? <Check size={11} strokeWidth={3} /> : state === 'active' ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#8b8f88]" />}
            </div>
            <div className="min-w-0"><div className="flex items-center gap-2 text-xs font-bold text-[#303a43]">{item.label}{state === 'active' && <span className="mono-label animate-pulse-line text-[#c46345]">working</span>}</div><div className="mt-0.5 text-[11px] leading-relaxed text-[#777d77]">{item.detail}</div></div>
          </div>;
        })}
      </div>
    </div>
  );
}

function RunPanel({ mode, setMode, goal, setGoal, onRun, isPending }: { mode: 'replay' | 'live'; setMode: (value: 'replay' | 'live') => void; goal: string; setGoal: (value: string) => void; onRun: () => void; isPending: boolean }) {
  return (
    <div className="rounded-lg border border-[#2f3945] bg-[#29333e] p-5 text-[#f2f2e9] shadow-[0_12px_30px_rgba(32,39,51,.10)]">
      <div className="flex items-start justify-between gap-4">
        <div><div className="mono-label text-[#aab5ad]">new investigation</div><h2 className="mt-1 font-[var(--app-font-serif)] text-[21px] font-bold tracking-[-.03em]">What should responders watch next?</h2></div>
        <Sparkles size={19} className="mt-1 text-[#d7f94e]" />
      </div>
      <textarea data-testid="input-investigation-goal" value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} className="mt-5 w-full resize-none rounded-md border border-[#4c5863] bg-[#202933] px-3.5 py-3 text-sm leading-relaxed text-[#f2f2e9] outline-none placeholder:text-[#7d878e] focus:border-[#d7f94e]" placeholder="Describe the decision you need to make..." />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-md border border-[#4c5863] bg-[#202933] p-1">
          {(['replay', 'live'] as const).map((item) => <button key={item} data-testid={`button-mode-${item}`} onClick={() => setMode(item)} className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] transition ${mode === item ? 'bg-[#d7f94e] text-[#202733]' : 'text-[#aab5ad] hover:text-white'}`}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />{item}</button>)}
        </div>
        <button data-testid="button-run-analysis" disabled={isPending || !goal.trim()} onClick={onRun} className="inline-flex items-center gap-2 rounded-md bg-[#d7f94e] px-4 py-2.5 text-xs font-extrabold uppercase tracking-[.1em] text-[#202733] transition hover:bg-[#e2ff72] disabled:cursor-not-allowed disabled:opacity-50">{isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={14} fill="currentColor" />}{isPending ? 'Investigating' : 'Run analysis'}</button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[10px] text-[#96a19a]"><Info size={12} /> Bounded to 6 reasoning steps · all claims stay source-linked</div>
    </div>
  );
}

function CascadeMap({ nodes, onSelect }: { nodes: any[]; onSelect: (id: string) => void }) {
  const kindStyle: Record<string, string> = { event: 'bg-[#fff0eb] border-[#e1a18c] text-[#9d3c26]', failure: 'bg-[#fff6df] border-[#e5c788] text-[#916c1d]', dependency: 'bg-[#e9f5f7] border-[#9cc3cf] text-[#286271]', impact: 'bg-[#f0eafb] border-[#c4b1dd] text-[#685181]', intervention: 'bg-[#eff8cb] border-[#bddb37] text-[#465d12]' };
  return (
    <div className="cg-grid overflow-x-auto rounded-lg border border-[#d4d1c4] bg-[#f5f3eb] p-5 pb-6">
      {nodes.length === 0 ? <div className="grid min-h-[170px] place-items-center text-center"><div><Network size={26} className="mx-auto mb-2 text-[#9da197]" /><div className="text-sm font-bold text-[#59615e]">Cascade map is waiting</div><div className="mt-1 text-xs text-[#858b83]">Run an investigation to trace the chain from event to intervention.</div></div></div> :
        <div className="flex min-w-[720px] items-center justify-center gap-2 py-5">
          {nodes.map((node, index) => <div key={node.id} className="flex items-center gap-2 animate-rise-in" style={{ animationDelay: `${index * 80}ms` }}>
            <button data-testid={`button-cascade-node-${node.id}`} onClick={() => onSelect(node.id)} className={`group w-[128px] rounded-md border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${kindStyle[node.kind] ?? kindStyle.dependency}`}>
              <div className="mb-3 flex items-center justify-between"><span className="mono-label opacity-70">{node.kind}</span><CircleDot size={12} /></div>
              <div className="min-h-[32px] text-xs font-bold leading-snug">{node.label}</div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-bold opacity-70"><span>{Math.round(node.confidence * 100)}% signal</span><ChevronRight size={12} /></div>
            </button>
            {index < nodes.length - 1 && <ArrowRight size={17} className="shrink-0 text-[#9ea39a]" />}
          </div>)}
        </div>}
    </div>
  );
}

function PriorityCard({ risk, selected, onSelect }: { risk: any; selected: boolean; onSelect: () => void }) {
  const priorityTone = risk.priority === 'critical' ? 'red' : risk.priority === 'high' ? 'orange' : 'muted';
  return <button data-testid={`button-candidate-risk-${risk.id}`} onClick={onSelect} className={`w-full rounded-lg border p-4 text-left transition ${selected ? 'border-[#91ad27] bg-[#f5f9df] shadow-[inset_3px_0_0_#9bbd25]' : 'border-[#d4d1c4] bg-[#f5f3eb] hover:border-[#b4b6a9] hover:bg-[#f8f7f0]'}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#e6e3d8] font-[var(--app-font-mono)] text-[10px] font-bold text-[#59615e]">{risk.id?.slice(-2).toUpperCase() ?? 'R1'}</span><span className="text-sm font-bold leading-snug text-[#303a43]">{risk.title}</span></div><StatusPill tone={priorityTone} dot={false}>{risk.priority}</StatusPill></div>
    <p className="mt-3 line-clamp-2 pl-8 text-xs leading-relaxed text-[#737970]">{risk.rationale}</p>
    {selected && <div className="mt-3 border-t border-[#d8e5a5] pt-3 pl-8"><div className="mono-label text-[#748b29]">suggested intervention</div><div className="mt-1 text-xs font-semibold leading-relaxed text-[#465d12]">{risk.intervention}</div></div>}
  </button>;
}

function EvidenceCard({ evidence }: { evidence: any }) {
  return <article data-testid={`card-evidence-${evidence.evidenceId}`} className="rounded-lg border border-[#d4d1c4] bg-[#f5f3eb] p-4 transition hover:border-[#afb3a6]">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded bg-[#e4e1d7] text-[#5c6668]"><FileSearch size={14} /></span><div><div className="text-xs font-bold text-[#37414a]">{evidence.source}</div><div className="mono-label mt-1 text-[#969a91]">{evidence.dataType} · tier {evidence.sourceTier}</div></div></div><span className="font-[var(--app-font-mono)] text-[10px] font-bold text-[#698315]">{Math.round(evidence.confidence * 100)}%</span></div>
    <div className="mt-3 text-xs leading-relaxed text-[#4e575b]">{evidence.claim}</div>
    <div className="mt-3 flex items-center justify-between border-t border-[#e0ddd3] pt-2 text-[10px] text-[#8b8f87]"><span className="flex items-center gap-1"><Clock3 size={11} />{evidence.timestamp}</span><a data-testid={`link-evidence-${evidence.evidenceId}`} href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-[#557382] hover:underline">Open source <ExternalLink size={10} /></a></div>
  </article>;
}

function UncertaintyPanel({ uncertainty, sourceNotice, providerStatus }: { uncertainty: string[]; sourceNotice?: string; providerStatus?: string }) {
  return <div className="rounded-lg border border-[#e4c788] bg-[#fff7e4] p-5">
    <div className="flex items-start gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f3dfaa] text-[#98711f]"><TriangleAlert size={16} /></div><div><div className="mono-label text-[#98711f]">uncertainty & provenance</div><div className="mt-1 text-sm font-bold text-[#5e4c27]">Use the signal, not the certainty</div></div></div>
    {sourceNotice && <p className="mt-4 text-xs leading-relaxed text-[#705e39]">{sourceNotice}</p>}
    {providerStatus === 'fallback' && <div className="mt-3 rounded border border-[#e4c788] bg-[#fff1ce] px-3 py-2 text-xs font-semibold text-[#785d28]">External model unavailable. Replay engine supplied this bounded result.</div>}
    <ul className="mt-3 space-y-2">{(uncertainty.length ? uncertainty : ['No analysis has been run; confidence is not yet available.']).map((item, index) => <li key={index} className="flex gap-2 text-xs leading-relaxed text-[#705e39]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#c59635]" />{item}</li>)}</ul>
  </div>;
}

function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<'replay' | 'live'>('replay');
  const [goal, setGoal] = useState('Which cascading failure should Kathmandu responders intervene on first?');
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'event' | 'infrastructure'>('all');
  const health = useHealthCheck();
  const scenarioQuery = useGetNepalScenario();
  const analyze = useAnalyzeCascade();
  const scenario = scenarioQuery.data;
  const result = analyze.data;

  const evidence = useMemo(() => result?.evidence ?? [...(scenario?.eventEvidence ?? []), ...(scenario?.infrastructureEvidence ?? [])], [result, scenario]);
  const candidates = result?.candidates ?? scenario?.candidateRisks ?? [];
  const trace = result?.trace ?? [];
  const cascade = result?.cascade ?? [];
  const filteredEvidence = evidence.filter((item: any) => evidenceFilter === 'all' || (evidenceFilter === 'event' ? scenario?.eventEvidence?.some((e: any) => e.evidenceId === item.evidenceId) : scenario?.infrastructureEvidence?.some((e: any) => e.evidenceId === item.evidenceId)));
  const selectedRiskObject = candidates.find((risk: any) => risk.id === selectedRisk) ?? candidates[0];
  const selectedNodeObject = cascade.find((node: any) => node.id === selectedNode);

  const runAnalysis = () => {
    analyze.mutate({ data: { goal: goal.trim(), mode, maxSteps: 6 } });
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#ebe9e0]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      {mobileOpen && <div className="fixed inset-0 z-40 bg-[#202733]/50 md:hidden" onClick={() => setMobileOpen(false)}><div className="h-full w-[248px]" onClick={(event) => event.stopPropagation()}><Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} /></div></div>}
      <div className="min-w-0 flex-1">
        <TopBar healthOk={health.isSuccess} onMobileMenu={() => setMobileOpen(true)} />
        <ScenarioStrip scenario={scenario} isLoading={scenarioQuery.isLoading} isError={scenarioQuery.isError} onRetry={() => scenarioQuery.refetch()} />
        <main className="cg-scrollbar h-[calc(100dvh-110px)] overflow-y-auto">
          <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-8 md:py-8">
            <section className="mb-7 grid gap-6 xl:grid-cols-[1fr_390px]">
              <div className="animate-rise-in">
                <div className="mb-4 flex flex-wrap items-center gap-2"><StatusPill tone="lime">Investigation room</StatusPill><span className="mono-label text-[#858b82]">{result ? `run ${result.runId}` : 'ready for a bounded run'}</span></div>
                <h1 className="max-w-[790px] font-[var(--app-font-serif)] text-[clamp(32px,4vw,52px)] font-bold leading-[.98] tracking-[-.065em] text-[#202733]">{result?.title ?? scenario?.title ?? 'Nepal flood replay'}</h1>
                <p className="mt-4 max-w-[680px] text-sm leading-relaxed text-[#626a68]">{result?.why ?? 'Turn a live or replayed crisis into one ranked, evidence-backed intervention. Start with the decision, then follow the chain.'}</p>
                <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-[#6f7773]"><span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#d76e4a]" />{result?.location ?? scenario?.region ?? 'Kathmandu Valley'}</span><span className="flex items-center gap-1.5"><Radio size={13} className="text-[#789b19]" />{result?.mode ?? mode} mode</span><span className="flex items-center gap-1.5"><Database size={13} className="text-[#557382]" />{evidence.length} source-linked records</span></div>
              </div>
              <RunPanel mode={mode} setMode={setMode} goal={goal} setGoal={setGoal} onRun={runAnalysis} isPending={analyze.isPending} />
            </section>

            {analyze.isError && <div data-testid="status-analysis-error" className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-[#df9c96] bg-[#fff0ef] px-4 py-3 text-xs text-[#9b392f]"><span className="flex items-center gap-2"><AlertCircle size={15} /> Analysis failed. The scenario is still available for review.</span><button data-testid="button-dismiss-analysis-error" onClick={() => analyze.reset()}><X size={15} /></button></div>}

            <section className="mb-7 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
              <div>
                <SectionHeading eyebrow="01 / trace" title="Follow the investigation" action={result && <StatusPill tone={result.providerStatus === 'fallback' ? 'orange' : 'blue'}>{result.providerStatus === 'fallback' ? 'fallback engine' : result.provider}</StatusPill>} />
                <TracePanel trace={trace} isPending={analyze.isPending} />
              </div>
              <div>
                <SectionHeading eyebrow="02 / ranked signal" title="Lead candidate" action={result && <StatusPill tone={result.priority === 'critical' ? 'red' : 'orange'}>{result.priority} priority</StatusPill>} />
                <div className="min-h-[205px] rounded-lg border border-[#d4d1c4] bg-[#f5f3eb] p-5">
                  {selectedRiskObject ? <><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-[#d7f94e] text-[#4a6113]"><Target size={18} /></div><div><div className="mono-label text-[#788078]">recommended focus</div><h3 className="mt-1 text-[17px] font-bold leading-tight text-[#28333d]">{selectedRiskObject.title}</h3></div></div><p className="mt-4 text-sm leading-relaxed text-[#5f6766]">{result?.intervention ?? selectedRiskObject.intervention}</p><button data-testid="button-focus-lead-candidate" onClick={() => { setSelectedRisk(selectedRiskObject.id); document.getElementById('candidates-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-[.1em] text-[#657d16] hover:underline">Inspect rationale <ArrowRight size={13} /></button></> :
                    <div className="grid min-h-[160px] place-items-center text-center"><Target size={25} className="mb-2 text-[#a3a79d]" /><div className="text-sm font-bold text-[#646b66]">No ranked intervention yet</div><div className="mt-1 text-xs text-[#888d84]">Run analysis to create a focus.</div></div>}
                </div>
              </div>
            </section>

            <section className="mb-7">
              <SectionHeading eyebrow="03 / dependency chain" title="How the crisis could cascade" action={selectedNodeObject && <div className="text-xs text-[#6f7773]">Selected: <strong className="text-[#303a43]">{selectedNodeObject.label}</strong></div>} />
              <CascadeMap nodes={cascade} onSelect={setSelectedNode} />
            </section>

            <section id="candidates-section" className="mb-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div>
                <SectionHeading eyebrow="04 / decision surface" title="Candidate risks" action={<span className="font-[var(--app-font-mono)] text-[11px] text-[#858b82]">{candidates.length} candidates</span>} />
                {candidates.length ? <div className="grid gap-3 sm:grid-cols-2">{candidates.map((risk: any) => <PriorityCard key={risk.id} risk={risk} selected={selectedRisk === risk.id || (!selectedRisk && risk.id === selectedRiskObject?.id)} onSelect={() => setSelectedRisk(risk.id)} />)}</div> : <div className="rounded-lg border border-dashed border-[#c7c6bb] bg-[#f1f0e8] p-8 text-center"><Target size={24} className="mx-auto mb-2 text-[#a2a69a]" /><div className="text-sm font-bold text-[#616961]">No candidate risks loaded</div><div className="mt-1 text-xs text-[#858b83]">The investigation will rank possible cascades here.</div></div>}
              </div>
              <UncertaintyPanel uncertainty={result?.uncertainty ?? []} sourceNotice={result?.sourceNotice ?? scenario?.sourceNotice} providerStatus={result?.providerStatus} />
            </section>

            <section id="evidence-section" className="pb-10">
              <SectionHeading eyebrow="05 / evidence ledger" title="Claims behind the signal" action={<div className="flex items-center gap-1 rounded-md border border-[#d4d1c4] bg-[#f5f3eb] p-1">{(['all', 'event', 'infrastructure'] as const).map((item) => <button key={item} data-testid={`button-evidence-filter-${item}`} onClick={() => setEvidenceFilter(item)} className={`rounded px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] ${evidenceFilter === item ? 'bg-[#29333e] text-[#f3f3e9]' : 'text-[#747a72] hover:text-[#303a43]'}`}>{item}</button>)}</div>} />
              {scenarioQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /></div> : filteredEvidence.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredEvidence.map((item: any) => <EvidenceCard key={item.evidenceId} evidence={item} />)}</div> : <div className="rounded-lg border border-dashed border-[#c7c6bb] bg-[#f1f0e8] p-8 text-center"><Database size={24} className="mx-auto mb-2 text-[#a2a69a]" /><div className="text-sm font-bold text-[#616961]">No evidence in this view</div><div className="mt-1 text-xs text-[#858b83]">Try another ledger filter or wait for the scenario source.</div></div>}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return <ErrorBoundary resetKey={useLocation()[0]}><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;