'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';
import { useEffect, useState, useCallback } from 'react';

interface Props {
  isOnboarded: boolean;
  onDismiss: () => void;
}

export function OnboardingChecklist({ isOnboarded, onDismiss }: Props) {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const { activeOrg } = useAppSelector((state) => state.organization);

  const [memberCount, setMemberCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [totalOrgTasks, setTotalOrgTasks] = useState(0);

  /**
   * FIX: Wrapped in useCallback so it can be called on demand.
   * Also added a visibility change listener — when user comes back
   * to the tab after inviting someone, stats refresh automatically.
   */
  const fetchStats = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const res = await api.get(
        `/organizations/${activeOrg.id}/dashboard-stats`,
      );
      const d = res.data.data;
      setMemberCount(d.totalMembers ?? 0);
      setProjectCount(d.totalProjects ?? 0);
      setTaskCount(d.myTasks ?? 0);
      setTotalOrgTasks(d.totalOrgTasks ?? 0);
    } catch { }
  }, [activeOrg?.id]);

  // Fetch on mount and when org changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /**
   * FIX: Refresh stats when user comes back to this tab.
   * When they go to /settings/members to invite someone and come back,
   * the checklist updates immediately without needing a page reload.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchStats]);

  /**
   * FIX: Also refresh when the URL changes (user navigated back
   * from members/projects page). Listen to focus events too.
   */
  useEffect(() => {
    const handleFocus = () => fetchStats();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStats]);

  const steps = [
    {
      id: 'create_org',
      label: 'Create your organization',
      // Always true — if they are on dashboard they have an org
      completed: !!activeOrg,
      href: '/organizations/new',
    },
    {
      id: 'complete_profile',
      label: 'Complete your profile',
      // True when user has avatar set (name is always set from registration)
      completed: !!(user?.firstName && user?.lastName && user?.avatar),
      href: '/settings/profile',
    },
    {
      id: 'invite_member',
      label: 'Invite your first team member',
      // > 1 because owner counts as 1, need at least one more person
      completed: memberCount > 1,
      href: '/settings/members',
    },
    {
      id: 'create_project',
      label: 'Create your first project',
      completed: projectCount > 0,
      href: '/projects',
    },
    {
      id: 'create_task',
      label: 'Create your first task',
      // Use totalMembers tasks — myTasks only counts tasks assigned TO YOU
      // A new org owner might assign tasks to others, not themselves
      completed: totalOrgTasks > 0,
      href: '/tasks',
    },
  ];

  if (isOnboarded) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const currentIndex = steps.findIndex((step) => !step.completed);

  return (
    <Card className="border-[#dfdfe2] dark:border-indigo-900 bg-[#f4f4f4]/50 dark:bg-indigo-950/20">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base text-indigo-900 dark:text-indigo-200">
            🚀 Get started with TeamFlow
          </CardTitle>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <X size={16} />
        </button>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((s) => {
            const isComplete = s.completed;
            const isCurrent = steps[currentIndex]?.id === s.id;

            return (
              <button
                key={s.id}
                onClick={() => router.push(s.href)}
                disabled={isComplete}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${isCurrent
                    ? 'bg-white dark:bg-slate-900 shadow-sm border border-[#dfdfe2] dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium'
                    : isComplete
                      ? 'text-slate-400 dark:text-gray-600 cursor-default'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                  }`}
              >
                {isComplete ? (
                  <CheckCircle2
                    size={16}
                    className="text-green-500 shrink-0"
                  />
                ) : (
                  <Circle
                    size={16}
                    className={`shrink-0 ${isCurrent
                        ? 'text-indigo-500'
                        : 'text-slate-300 dark:text-gray-600'
                      }`}
                  />
                )}
                {s.label}
                {isCurrent && (
                  <span className="ml-auto text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    Next
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}