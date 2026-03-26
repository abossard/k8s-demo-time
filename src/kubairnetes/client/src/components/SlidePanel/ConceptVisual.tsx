import { useState, useEffect, useMemo } from 'react';
import type { AISlide } from '../../lib/types';

// Detect which concept visualizations to show based on slide content
export function detectConcepts(slide: AISlide): ConceptType[] {
  const text = `${slide.title} ${slide.explanation ?? ''} ${slide.headline ?? ''}`.toLowerCase();
  const concepts: ConceptType[] = [];

  if (/\bhpa\b|horizontal\s*pod\s*auto|autoscal|scale.*replica|replica.*scale/.test(text)) {
    concepts.push('hpa');
  }
  if (/\bprobe|liveness|readiness|startup\s*probe|health\s*check/.test(text)) {
    concepts.push('probes');
  }
  if (/\bresource|request.*limit|cpu.*memory|limit.*request|resource\s*quota/.test(text)) {
    concepts.push('resources');
  }
  if (/\bqos|quality.of.service|guaranteed|burstable|besteffort|evict/.test(text)) {
    concepts.push('qos');
  }
  if (/\bvpa\b|vertical\s*pod\s*auto|right.?siz/.test(text)) {
    concepts.push('vpa');
  }
  if (/\brolling.?update|rollout|deployment\s*strateg|recreate\s*strateg/.test(text)) {
    concepts.push('rollout');
  }

  return concepts;
}

export type ConceptType = 'hpa' | 'probes' | 'resources' | 'qos' | 'vpa' | 'rollout';

export function ConceptVisual({ type }: { type: ConceptType }) {
  switch (type) {
    case 'hpa': return <HPAVisual />;
    case 'probes': return <ProbeVisual />;
    case 'resources': return <ResourceVisual />;
    case 'qos': return <QoSVisual />;
    case 'vpa': return <VPAVisual />;
    case 'rollout': return <RolloutVisual />;
  }
}

// ═══════════════════════════════════════════
// HPA: Interactive pod scaler
// ═══════════════════════════════════════════

function HPAVisual() {
  const [replicas, setReplicas] = useState(2);
  const [cpuLoad, setCpuLoad] = useState(30);
  const maxReplicas = 8;
  const targetCpu = 60;

  // Auto-scale simulation
  useEffect(() => {
    const perPodLoad = cpuLoad / replicas;
    if (perPodLoad > targetCpu && replicas < maxReplicas) {
      const timer = setTimeout(() => setReplicas(r => Math.min(r + 1, maxReplicas)), 1500);
      return () => clearTimeout(timer);
    } else if (perPodLoad < targetCpu * 0.5 && replicas > 1) {
      const timer = setTimeout(() => setReplicas(r => Math.max(r - 1, 1)), 2000);
      return () => clearTimeout(timer);
    }
  }, [cpuLoad, replicas]);

  const perPodLoad = Math.round(cpuLoad / replicas);

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">⚡ Interactive: HPA Scaling</div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-kube-muted">Cluster Load:</label>
        <input
          type="range"
          min={10}
          max={400}
          value={cpuLoad}
          onChange={(e) => setCpuLoad(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-kube-surface-light cursor-pointer accent-kube-blue"
        />
        <span className="text-xs font-mono text-white w-16 text-right">{cpuLoad}% CPU</span>
      </div>

      {/* Pod grid */}
      <div className="flex flex-wrap gap-2 mb-2">
        {Array.from({ length: maxReplicas }).map((_, i) => {
          const active = i < replicas;
          const load = active ? Math.min(100, perPodLoad) : 0;
          return (
            <div
              key={i}
              className={`relative w-14 h-16 rounded-lg border-2 transition-all duration-500 flex flex-col items-center justify-center ${
                active
                  ? 'border-emerald-500/60 bg-emerald-500/10 scale-100 opacity-100'
                  : 'border-kube-border/30 bg-kube-dark/30 scale-90 opacity-30'
              }`}
            >
              <span className="text-lg">{active ? '⬡' : '·'}</span>
              {active && (
                <div className="w-10 h-1.5 rounded-full bg-kube-dark mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      load > 80 ? 'bg-red-500' : load > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${load}%` }}
                  />
                </div>
              )}
              {active && <span className="text-[9px] text-kube-muted mt-0.5">{load}%</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-kube-muted">
        <span>Replicas: <span className="text-white font-medium">{replicas}</span>/{maxReplicas}</span>
        <span>Per-pod: <span className={perPodLoad > targetCpu ? 'text-red-400' : 'text-emerald-400'}>{perPodLoad}%</span></span>
        <span>Target: {targetCpu}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Probes: Traffic light animation
// ═══════════════════════════════════════════

function ProbeVisual() {
  const [probes, setProbes] = useState({
    startup: 'passing' as 'passing' | 'failing' | 'pending',
    readiness: 'passing' as 'passing' | 'failing' | 'pending',
    liveness: 'passing' as 'passing' | 'failing' | 'pending',
  });

  const [phase, setPhase] = useState<'starting' | 'ready' | 'degraded'>('ready');

  useEffect(() => {
    if (probes.startup === 'failing') setPhase('starting');
    else if (probes.readiness === 'failing') setPhase('degraded');
    else setPhase('ready');
  }, [probes]);

  const toggleProbe = (name: 'startup' | 'readiness' | 'liveness') => {
    setProbes(p => ({
      ...p,
      [name]: p[name] === 'passing' ? 'failing' : 'passing',
    }));
  };

  const probeColor = (status: string) =>
    status === 'passing' ? 'bg-emerald-500 shadow-emerald-500/50' :
    status === 'failing' ? 'bg-red-500 shadow-red-500/50 animate-pulse' :
    'bg-amber-500 shadow-amber-500/50';

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">🚦 Interactive: Probe Status</div>
      <div className="flex items-center gap-6">
        {/* Probe lights */}
        <div className="flex flex-col gap-3">
          {(['startup', 'readiness', 'liveness'] as const).map((name) => (
            <button
              key={name}
              onClick={() => toggleProbe(name)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-4 h-4 rounded-full shadow-lg transition-all ${probeColor(probes[name])}`} />
              <span className="text-xs text-slate-300 capitalize group-hover:text-white transition-colors">{name}</span>
              <span className="text-[10px] text-kube-muted">({probes[name]})</span>
            </button>
          ))}
        </div>

        {/* Pod status result */}
        <div className="flex-1 flex flex-col items-center gap-2 py-2">
          <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center text-2xl transition-all duration-500 ${
            phase === 'ready' ? 'border-emerald-500/60 bg-emerald-500/10' :
            phase === 'degraded' ? 'border-amber-500/60 bg-amber-500/10 animate-pulse' :
            'border-red-500/60 bg-red-500/10 animate-pulse'
          }`}>
            {phase === 'ready' ? '✅' : phase === 'degraded' ? '⚠️' : '🔄'}
          </div>
          <span className={`text-xs font-medium ${
            phase === 'ready' ? 'text-emerald-400' : phase === 'degraded' ? 'text-amber-400' : 'text-red-400'
          }`}>
            Pod: {phase === 'ready' ? 'Serving Traffic' : phase === 'degraded' ? 'Removed from Service' : 'Starting...'}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-kube-muted mt-2">Click a probe to toggle its state and see the effect</p>
    </div>
  );
}

// ═══════════════════════════════════════════
// Resources: Animated bars
// ═══════════════════════════════════════════

function ResourceVisual() {
  const [cpuReq, setCpuReq] = useState(200);
  const [cpuLim, setCpuLim] = useState(1000);
  const [cpuUsage, setCpuUsage] = useState(150);
  const [memReq, setMemReq] = useState(256);
  const [memLim, setMemLim] = useState(1024);
  const [memUsage, setMemUsage] = useState(200);

  const cpuThrottled = cpuUsage > cpuLim;
  const oomKill = memUsage > memLim;

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">📊 Interactive: Resource Management</div>
      <div className="space-y-3">
        {/* CPU */}
        <div>
          <div className="flex justify-between text-[10px] text-kube-muted mb-1">
            <span>CPU</span>
            <span>{cpuUsage}m / req: {cpuReq}m / lim: {cpuLim}m</span>
          </div>
          <div className="relative h-6 bg-kube-dark rounded-lg overflow-hidden border border-kube-border">
            {/* Request marker */}
            <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-sky-400/60 z-10" style={{ left: `${(cpuReq / 1200) * 100}%` }} />
            {/* Limit marker */}
            <div className="absolute top-0 bottom-0 border-r-2 border-red-400/60 z-10" style={{ left: `${(cpuLim / 1200) * 100}%` }} />
            {/* Usage bar */}
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-r ${
                cpuThrottled ? 'bg-red-500/60' : cpuUsage > cpuReq ? 'bg-amber-500/60' : 'bg-emerald-500/60'
              }`}
              style={{ width: `${Math.min(100, (cpuUsage / 1200) * 100)}%` }}
            />
            {cpuThrottled && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-red-300 font-medium">⚠ THROTTLED</span>}
          </div>
          <input type="range" min={0} max={1200} value={cpuUsage} onChange={(e) => setCpuUsage(Number(e.target.value))} className="w-full h-1 mt-1 accent-kube-blue cursor-pointer" />
        </div>

        {/* Memory */}
        <div>
          <div className="flex justify-between text-[10px] text-kube-muted mb-1">
            <span>Memory</span>
            <span>{memUsage}Mi / req: {memReq}Mi / lim: {memLim}Mi</span>
          </div>
          <div className="relative h-6 bg-kube-dark rounded-lg overflow-hidden border border-kube-border">
            <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-sky-400/60 z-10" style={{ left: `${(memReq / 1400) * 100}%` }} />
            <div className="absolute top-0 bottom-0 border-r-2 border-red-400/60 z-10" style={{ left: `${(memLim / 1400) * 100}%` }} />
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-r ${
                oomKill ? 'bg-red-500/80' : memUsage > memReq ? 'bg-amber-500/60' : 'bg-emerald-500/60'
              }`}
              style={{ width: `${Math.min(100, (memUsage / 1400) * 100)}%` }}
            />
            {oomKill && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-red-300 font-bold animate-pulse">💀 OOM KILLED</span>}
          </div>
          <input type="range" min={0} max={1400} value={memUsage} onChange={(e) => setMemUsage(Number(e.target.value))} className="w-full h-1 mt-1 accent-kube-blue cursor-pointer" />
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-[10px] text-kube-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400" />Request</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-red-400" />Limit</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/60 rounded" />Usage</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// QoS: Hierarchy with eviction animation
// ═══════════════════════════════════════════

function QoSVisual() {
  const [pressure, setPressure] = useState(0);
  const evictionOrder = ['BestEffort', 'Burstable', 'Guaranteed'];

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">🏔 Interactive: QoS & Eviction Priority</div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-kube-muted">Memory Pressure:</label>
        <input
          type="range"
          min={0}
          max={100}
          value={pressure}
          onChange={(e) => setPressure(Number(e.target.value))}
          className="flex-1 h-1.5 accent-red-500 cursor-pointer"
        />
        <span className={`text-xs font-mono w-10 text-right ${pressure > 60 ? 'text-red-400' : pressure > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {pressure}%
        </span>
      </div>

      <div className="flex gap-3">
        {[
          { name: 'Guaranteed', emoji: '🛡️', desc: 'req == lim', threshold: 90, color: 'emerald' },
          { name: 'Burstable', emoji: '📈', desc: 'req < lim', threshold: 60, color: 'amber' },
          { name: 'BestEffort', emoji: '🎲', desc: 'no req/lim', threshold: 30, color: 'red' },
        ].map(({ name, emoji, desc, threshold, color }) => {
          const evicted = pressure >= threshold;
          return (
            <div
              key={name}
              className={`flex-1 rounded-lg border-2 p-3 text-center transition-all duration-500 ${
                evicted
                  ? 'border-red-500/50 bg-red-500/10 opacity-40 scale-95'
                  : `border-${color}-500/30 bg-${color}-500/5`
              }`}
            >
              <div className="text-2xl mb-1">{evicted ? '💀' : emoji}</div>
              <div className={`text-xs font-medium ${evicted ? 'text-red-400 line-through' : 'text-slate-300'}`}>{name}</div>
              <div className="text-[10px] text-kube-muted mt-0.5">{desc}</div>
              {evicted && <div className="text-[10px] text-red-400 mt-1 animate-pulse">Evicted!</div>}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-kube-muted mt-2 text-center">
        Eviction order: BestEffort → Burstable → Guaranteed (drag slider to simulate)
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// VPA: Resizing resource bars
// ═══════════════════════════════════════════

function VPAVisual() {
  const [step, setStep] = useState(0);
  const stages = [
    { label: 'Initial', cpu: 100, mem: 128, recommended: null },
    { label: 'VPA Observing', cpu: 100, mem: 128, recommended: { cpu: 250, mem: 384 } },
    { label: 'VPA Applied', cpu: 250, mem: 384, recommended: { cpu: 250, mem: 384 } },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % stages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const current = stages[step]!;

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">📐 Animated: VPA Right-Sizing</div>

      <div className="flex items-center gap-2 mb-3">
        {stages.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              i === step ? 'bg-kube-blue text-white' : 'bg-kube-surface-light text-kube-muted hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="text-[10px] text-kube-muted mb-1">CPU Request</div>
          <div className="h-8 bg-kube-dark rounded border border-kube-border overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-sky-500/50 transition-all duration-1000 rounded-r"
              style={{ width: `${(current.cpu / 500) * 100}%` }}
            />
            {current.recommended && (
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-emerald-400 transition-all duration-1000"
                style={{ left: `${(current.recommended.cpu / 500) * 100}%` }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-mono">{current.cpu}m</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-kube-muted mb-1">Memory Request</div>
          <div className="h-8 bg-kube-dark rounded border border-kube-border overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-violet-500/50 transition-all duration-1000 rounded-r"
              style={{ width: `${(current.mem / 512) * 100}%` }}
            />
            {current.recommended && (
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-emerald-400 transition-all duration-1000"
                style={{ left: `${(current.recommended.mem / 512) * 100}%` }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-mono">{current.mem}Mi</span>
          </div>
        </div>
      </div>

      {current.recommended && (
        <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-400" />
          VPA recommendation: {current.recommended.cpu}m CPU, {current.recommended.mem}Mi memory
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Rollout: Rolling update animation
// ═══════════════════════════════════════════

function RolloutVisual() {
  const total = 6;
  const [updated, setUpdated] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (!isRolling || updated >= total) {
      if (updated >= total) setIsRolling(false);
      return;
    }
    const timer = setTimeout(() => setUpdated(u => u + 1), 800);
    return () => clearTimeout(timer);
  }, [isRolling, updated]);

  const startRollout = () => { setUpdated(0); setIsRolling(true); };
  const reset = () => { setUpdated(0); setIsRolling(false); };

  return (
    <div className="concept-visual">
      <div className="text-[10px] font-semibold text-kube-info uppercase tracking-wider mb-2">🔄 Animated: Rolling Update</div>

      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from({ length: total }).map((_, i) => {
          const isUpdated = i < updated;
          const isUpdating = i === updated && isRolling;
          return (
            <div
              key={i}
              className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-500 ${
                isUpdating
                  ? 'border-amber-500/60 bg-amber-500/10 animate-pulse scale-110'
                  : isUpdated
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-sky-500/30 bg-sky-500/5'
              }`}
            >
              <span className="text-sm">
                {isUpdating ? '🔄' : isUpdated ? '🟢' : '🔵'}
              </span>
              <span className="text-[9px] text-kube-muted">
                {isUpdating ? 'updating' : isUpdated ? 'v2' : 'v1'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={startRollout}
          disabled={isRolling}
          className="px-3 py-1 text-xs rounded bg-kube-blue text-white hover:bg-kube-blue/80 disabled:opacity-50 transition-colors"
        >
          {updated >= total ? '↻ Replay' : '▶ Start Rollout'}
        </button>
        <button onClick={reset} className="px-2 py-1 text-xs rounded bg-kube-surface-light text-kube-muted hover:text-white border border-kube-border transition-colors">
          Reset
        </button>
        <span className="text-[10px] text-kube-muted ml-auto">
          {updated}/{total} pods updated
          {isRolling && ' (maxUnavailable: 1)'}
        </span>
      </div>
    </div>
  );
}
