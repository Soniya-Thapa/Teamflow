'use client';

/**
 * @file dashboard/page.tsx
 * @description Main dashboard with real stats from API.
 *
 * Stats fetched from: GET /organizations/:id/dashboard-stats
 * Shows: projects count, my tasks count, member count, overdue count
 * Also shows: plan usage bars with real numbers
 */

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/redux.hooks';
import {
  FolderOpen,
  CheckSquare,
  Users,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OnboardingChecklist } from '@/components/shared/onboarding-checklist';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface DashboardStats {
  totalProjects: number;
  myTasks: number;
  totalMembers: number;
  overdueTasks: number;
  maxUsers: number;
  maxProjects: number;
  plan: string;
}

// ─────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  suffix,
  href,
  isLoading,
}: {
  title: string;
  value: number | null;
  icon: any;
  iconBg: string;
  iconColor: string;
  suffix?: string;
  href?: string;
  isLoading: boolean;
}) {
  const inner = (
    <div
      className={`bg-slate-900 rounded-xl p-5 border border-slate-800 h-full transition-colors ${href ? 'hover:border-slate-700 cursor-pointer' : ''
        }`}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-slate-400">{title}</p>
        <div
          className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}
        >
          <Icon size={16} className={iconColor} />
        </div>
      </div>

      {isLoading || value === null ? (
        // Skeleton pulse while loading
        <div className="h-9 w-16 bg-slate-800 rounded-lg animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-white">
          {value}
          {suffix && (
            <span className="text-sm font-normal text-slate-500 ml-1">
              {suffix}
            </span>
          )}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}

// ─────────────────────────────────────────
// USAGE BAR
// ─────────────────────────────────────────

function UsageBar({
  label,
  current,
  max,
  isLoading,
}: {
  label: string;
  current: number | null;
  max: number | null;
  isLoading: boolean;
}) {
  const pct =
    current !== null && max && max > 0
      ? Math.min(Math.round((current / max) * 100), 100)
      : 0;

  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#476e66]';

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>{label}</span>
        {isLoading ? (
          <div className="w-10 h-3 bg-slate-700 rounded animate-pulse" />
        ) : (
          <span>
            {current ?? 0} / {max ?? '—'}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: isLoading ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const { activeOrg } = useAppSelector((state) => state.organization);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orgSettings, setOrgSettings] = useState<{ isOnboarded: boolean }>({ isOnboarded: false });

  useEffect(() => {
    if (!activeOrg) return;
    api.get(`/organizations/${activeOrg.id}/settings`)
      .then((res) => setOrgSettings(res.data.data))
      .catch(() => { });
  }, [activeOrg?.id]);

  // Fetch real stats from backend
  useEffect(() => {
    if (!activeOrg) return;

    setIsLoading(true);

    api
      .get(`/organizations/${activeOrg.id}/dashboard-stats`)
      .then((res) => {
        setStats(res.data.data);
      })
      .catch(() => {
        // Leave stats as null — UI shows skeleton
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeOrg?.id]);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const firstName = user?.firstName || 'there';

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── HEADER ──────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Working in{' '}
            <span className="text-white font-medium">{activeOrg?.name}</span>
            {' · '}
            <span className="text-[#476e66] font-medium">
              {activeOrg?.plan} plan
            </span>
          </p>
        </div>

        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-2 px-4 py-2 bg-[#476e66] hover:bg-[#3d6059] text-white text-sm font-medium rounded-xl transition-colors shrink-0"
        >
          <Plus size={15} />
          New project
        </button>
      </div>

      {/* ── STAT CARDS ──────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Projects"
          value={stats?.totalProjects ?? null}
          icon={FolderOpen}
          iconBg="bg-blue-500/20"
          iconColor="text-blue-400"
          href="/projects"
          isLoading={isLoading}
        />
        <StatCard
          title="My Tasks"
          value={stats?.myTasks ?? null}
          icon={CheckSquare}
          iconBg="bg-green-500/20"
          iconColor="text-green-400"
          href="/tasks"
          isLoading={isLoading}
        />
        <StatCard
          title="Team Members"
          value={stats?.totalMembers ?? null}
          icon={Users}
          iconBg="bg-purple-500/20"
          iconColor="text-purple-400"
          suffix={stats ? `/ ${stats.maxUsers}` : undefined}
          href="/settings/members"
          isLoading={isLoading}
        />
        <StatCard
          title="Overdue Tasks"
          value={stats?.overdueTasks ?? null}
          icon={Clock}
          iconBg="bg-red-500/20"
          iconColor="text-red-400"
          isLoading={isLoading}
        />
      </div>

      {/* ── ONBOARDING ──────────────────── */}
      <OnboardingChecklist
        isOnboarded={orgSettings.isOnboarded}
        onDismiss={() => { }}
      />

      {/* ── QUICK LINKS ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/projects"
          className="flex items-center gap-4 p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-[#476e66]/50 transition-colors group"
        >
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <FolderOpen size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">Projects</p>
            <p className="text-xs text-slate-400">Manage your work</p>
          </div>
          <ArrowRight
            size={16}
            className="text-slate-600 group-hover:text-[#476e66] transition-colors shrink-0"
          />
        </Link>

        <Link
          href="/tasks"
          className="flex items-center gap-4 p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-[#476e66]/50 transition-colors group"
        >
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
            <CheckSquare size={18} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">My Tasks</p>
            <p className="text-xs text-slate-400">View assigned work</p>
          </div>
          <ArrowRight
            size={16}
            className="text-slate-600 group-hover:text-[#476e66] transition-colors shrink-0"
          />
        </Link>
      </div>

      {/* ── PLAN USAGE ──────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Plan Usage</h3>
          </div>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
            {activeOrg?.plan ?? 'FREE'}
          </span>
        </div>

        <div className="space-y-4">
          <UsageBar
            label="Members"
            current={stats?.totalMembers ?? null}
            max={stats?.maxUsers ?? null}
            isLoading={isLoading}
          />
          <UsageBar
            label="Projects"
            current={stats?.totalProjects ?? null}
            max={stats?.maxProjects ?? null}
            isLoading={isLoading}
          />
        </div>

        {/* Upgrade nudge for FREE plan */}
        {!isLoading && stats?.plan === 'FREE' && (
          <Link
            href="/settings/billing"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 text-xs text-[#476e66] border border-[#476e66]/30 rounded-lg hover:bg-[#476e66]/10 transition-colors"
          >
            Upgrade to Pro for more capacity →
          </Link>
        )}
      </div>
    </div>
  );
}