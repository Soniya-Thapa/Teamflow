'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/redux.hooks';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Zap,
  Clock,
  FolderOpen,
  UserCheck,
} from 'lucide-react';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────

function ScoreRing({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;

  const color =
    score >= 80
      ? '#22c55e'   // green
      : score >= 60
        ? '#476e66'   // teal
        : score >= 40
          ? '#f59e0b'   // amber
          : '#ef4444';  // red

  const labelColor =
    score >= 80
      ? 'text-green-400'
      : score >= 60
        ? 'text-[#476e66]'
        : score >= 40
          ? 'text-amber-400'
          : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg
          width="144"
          height="144"
          viewBox="0 0 144 144"
          className="-rotate-90"
        >
          {/* Background ring */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
          />
          {/* Score ring */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${labelColor}`}>
            {score}
          </span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────
// SIGNAL BAR
// ─────────────────────────────────────────

function SignalBar({
  label,
  score,
  weight,
  icon: Icon,
}: {
  label: string;
  score: number;
  weight: string;
  icon: any;
}) {
  const color =
    score >= 80
      ? 'bg-green-500'
      : score >= 60
        ? 'bg-[#476e66]'
        : score >= 40
          ? 'bg-amber-500'
          : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-300">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{weight} weight</span>
            <span className="text-xs font-semibold text-white">
              {score.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BURNOUT BADGE
// ─────────────────────────────────────────

function BurnoutBadge({ risk }: { risk: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const styles = {
    HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
    MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[risk]}`}
    >
      {risk} risk
    </span>
  );
}

// ─────────────────────────────────────────
// HEALTH PAGE
// ─────────────────────────────────────────

export default function HealthDashboardPage() {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = () => {
    if (!activeOrg) return;
    setIsLoading(true);
    api
      .get(`/organizations/${activeOrg.id}/health-score`)
      .then((res) => {
        setData(res.data.data);
        setLastUpdated(new Date());
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, [activeOrg?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#476e66] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">
            Calculating health score...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Failed to load health data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── HEADER ──────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Project Health Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            AI-powered analysis of your organization&apos;s work health
            {lastUpdated && (
              <span className="ml-2 text-slate-600">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="text-xs text-[#476e66] border border-[#476e66]/30 px-3 py-1.5 rounded-lg hover:bg-[#476e66]/10 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* ── MAIN SCORE + SIGNALS ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Score ring */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
          <ScoreRing
            score={data.overallScore}
            label={data.healthLabel}
          />
          <p className="text-xs text-slate-500 text-center">
            Composite score from 5 health signals
          </p>
        </div>

        {/* Signal breakdown */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white mb-4">
            Signal Breakdown
          </h3>
          <SignalBar
            label="Overdue Rate"
            score={data.signals.overdueRate}
            weight="25%"
            icon={AlertTriangle}
          />
          <SignalBar
            label="Completion Velocity"
            score={data.signals.velocity}
            weight="25%"
            icon={TrendingUp}
          />
          <SignalBar
            label="Workload Balance"
            score={data.signals.workloadBalance}
            weight="20%"
            icon={Users}
          />
          <SignalBar
            label="Project Activity"
            score={data.signals.projectActivity}
            weight="20%"
            icon={FolderOpen}
          />
          <SignalBar
            label="Completion Rate"
            score={data.signals.completionRate}
            weight="10%"
            icon={CheckCircle2}
          />
        </div>
      </div>

      {/* ── TASK DISTRIBUTION ───────────── */}
      {data.memberRisks?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Task Distribution</h3>
          <div className="space-y-3">
            {[...data.memberRisks]
              .sort((a: any, b: any) => b.activeTaskCount - a.activeTaskCount)
              .map((member: any) => {
                const maxCount = Math.max(...data.memberRisks.map((m: any) => m.activeTaskCount));
                const widthPct = maxCount > 0 ? (member.activeTaskCount / maxCount) * 100 : 0;
                return (
                  <div key={member.userId} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 truncate shrink-0">{member.name}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#476e66] transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-6 text-right shrink-0">
                      {member.activeTaskCount}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── KEY METRICS ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Tasks',
            value: data.metrics.totalActiveTasks,
            icon: Activity,
            color: 'text-blue-400',
            bg: 'bg-blue-500/20',
          },
          {
            label: 'Overdue',
            value: `${data.metrics.overdueTasks} (${data.metrics.overduePercent}%)`,
            icon: Clock,
            color: 'text-red-400',
            bg: 'bg-red-500/20',
          },
          {
            label: 'Done This Week',
            value: data.metrics.completedLast7Days,
            icon: CheckCircle2,
            color: 'text-green-400',
            bg: 'bg-green-500/20',
          },
          {
            label: 'Inactive Projects',
            value: data.metrics.inactiveProjects,
            icon: FolderOpen,
            color: 'text-amber-400',
            bg: 'bg-amber-500/20',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div
              className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center mb-2`}
            >
              <item.icon size={14} className={item.color} />
            </div>
            <p className="text-lg font-bold text-white">{item.value}</p>
            <p className="text-xs text-slate-400">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── RECOMMENDED ASSIGNEE ────────── */}
      {data.recommendedAssignee && (
        <div className="bg-[#476e66]/10 border border-[#476e66]/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-[#476e66]/20 rounded-xl flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-[#476e66]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Recommended next assignee
              </p>
              <p className="text-sm text-[#476e66] font-medium mt-0.5">
                {data.recommendedAssignee.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.recommendedAssignee.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── BURNOUT RISK TABLE ───────────── */}
      {data.memberRisks?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">
              Team Burnout Risk
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Based on active task count per member
            </p>
          </div>
          <div className="divide-y divide-slate-800">
            {data.memberRisks.map((member: any) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-xs text-slate-400 font-medium">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">
                    {member.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.activeTaskCount} active task
                    {member.activeTaskCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${member.burnoutRisk === 'HIGH'
                          ? 'bg-red-500'
                          : member.burnoutRisk === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                      style={{ width: `${member.burnoutScore}%` }}
                    />
                  </div>
                  <BurnoutBadge risk={member.burnoutRisk} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALGORITHM NOTE ───────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-[#476e66] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-white mb-1">
              How the health score is calculated
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The score combines 5 weighted signals: overdue rate (25%),
              completion velocity (25%), workload balance using coefficient
              of variation (20%), project activity (20%), and overall
              completion rate (10%). Workload balance uses statistical
              analysis — teams with even task distribution score higher.
              All calculations run on your live data in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}