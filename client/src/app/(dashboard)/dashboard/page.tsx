'use client';

import { OnboardingChecklist } from '@/components/shared/onboarding-checklist';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  CheckSquare,
  Users,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/hooks/redux.hooks';
import { SkeletonCard } from '@/components/shared/skeleton';

// ─────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-indigo-200 dark:border-indigo-200 hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-slate-400">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={14} className="text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const { activeOrg, isLoading: orgLoading } = useAppSelector(
    (state) => state.organization,
  );

  const [showOnboarding, setShowOnboarding] = useState(true);

  // If no org — prompt to create one
  if (!orgLoading && !activeOrg) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto">
            <FolderOpen className="text-indigo-600" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              No organization yet
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Create or join an organization to get started
            </p>
          </div>
          <Button
            onClick={() => router.push('/organizations/new')}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus size={16} className="mr-2" />
            Create organization
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Good day, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1 text-sm">
            {activeOrg
              ? `Working in ${activeOrg.name} · ${activeOrg.plan} plan`
              : 'Loading workspace...'}
          </p>
        </div>

        <Button
          onClick={() => router.push('/projects')}
          className="bg-indigo-600 hover:bg-indigo-700 hidden sm:flex"
        >
          <Plus size={16} className="mr-2" />
          New project
        </Button>
      </div>

      {/* Stats */}
      {orgLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Projects"
            value="—"
            icon={FolderOpen}
            color="bg-blue-500"
            subtitle="Loads on Day 32"
          />
          <StatCard
            title="My Tasks"
            value="—"
            icon={CheckSquare}
            color="bg-green-500"
            subtitle="Loads on Day 32"
          />
          <StatCard
            title="Team Members"
            value={activeOrg ? `?/${activeOrg.maxUsers}` : '—'}
            icon={Users}
            color="bg-purple-500"
            subtitle={`${activeOrg?.plan} plan limit`}
          />
          <StatCard
            title="Overdue Tasks"
            value="—"
            icon={Clock}
            color="bg-red-500"
            subtitle="Loads on Day 32"
          />
        </div>
      )}

      {showOnboarding && activeOrg && (
        <OnboardingChecklist
          currentStep={0}
          isOnboarded={false}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="border-indigo-200 dark:border-indigo-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => router.push('/projects')}
        >
          <CardContent className="pt-6 pb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-xl flex items-center justify-center">
                <FolderOpen size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Projects
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Manage your work
                </p>
              </div>
            </div>
            <ArrowRight
              size={16}
              className="text-slate-300 group-hover:text-gray-600 transition-colors"
            />
          </CardContent>
        </Card>

        <Card
          className="border-indigo-200 dark:border-indigo-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => router.push('/tasks')}
        >
          <CardContent className="pt-6 pb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-950 rounded-xl flex items-center justify-center">
                <CheckSquare size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  My Tasks
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  View assigned work
                </p>
              </div>
            </div>
            <ArrowRight
              size={16}
              className="text-slate-300 group-hover:text-gray-600 transition-colors"
            />
          </CardContent>
        </Card>
      </div>

      {/* Plan usage */}
      {activeOrg && (
        <Card className="border-indigo-200 dark:border-indigo-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Plan Usage
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {activeOrg.plan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                <span>Members</span>
                <span>?/{activeOrg.maxUsers}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-indigo-50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f4f4f4]0 rounded-full"
                  style={{ width: '20%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                <span>Projects</span>
                <span>?/{activeOrg.maxProjects}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-indigo-50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f4f4f4]0 rounded-full"
                  style={{ width: '10%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}