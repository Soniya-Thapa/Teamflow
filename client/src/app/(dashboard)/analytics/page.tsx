'use client';

/**
 * @file analytics/page.tsx
 * @description Organization analytics dashboard.
 *
 * CHARTS USED (Recharts):
 *   PieChart   → task status breakdown (donut style)
 *   LineChart  → task completion velocity (trend over time)
 *   BarChart   → member activity
 *
 * DATE RANGE:
 * Toggle buttons at top: Last 7 / 30 / 90 days.
 * All API calls refetch when days changes.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CheckSquare, Clock, FolderOpen, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppSelector } from '@/hooks/redux.hooks';
import { SkeletonCard } from '@/components/shared/skeleton';
import { UserAvatar } from '@/components/shared/user-avatar';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  TODO: '#bec0bf',
  IN_PROGRESS: '#476e66',
  REVIEW: '#9b5de5',
  DONE: '#2dc653',
};

const DAY_OPTIONS = [7, 30, 90] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

// ─────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accent,
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <Card className="border-[#dfdfe2] dark:border-slate-700">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#708a83]">{title}</span>
          <Icon size={14} className={accent || 'text-[#708a83]'} />
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-[#708a83] mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function AnalyticsPage() {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [days, setDays] = useState<DayOption>(30);
  const [isLoading, setIsLoading] = useState(true);

  const [overview, setOverview] = useState<any>(null);
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [memberActivity, setMemberActivity] = useState<any[]>([]);
  const [projectProgress, setProjectProgress] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    if (!activeOrg) return;
    setIsLoading(true);

    try {
      const orgId = activeOrg.id;
      const [overviewRes, statusRes, velocityRes, membersRes, projectsRes] =
        await Promise.all([
          api.get(`/organizations/${orgId}/analytics/overview?days=${days}`),
          api.get(`/organizations/${orgId}/analytics/tasks-by-status`),
          api.get(`/organizations/${orgId}/analytics/velocity?days=${days}`),
          api.get(
            `/organizations/${orgId}/analytics/member-activity?days=${days}`,
          ),
          api.get(`/organizations/${orgId}/analytics/project-progress`),
        ]);

      setOverview(overviewRes.data.data);
      setTasksByStatus(statusRes.data.data.breakdown || []);
      setVelocity(velocityRes.data.data.velocity || []);
      setMemberActivity(membersRes.data.data.activity || []);
      setProjectProgress(projectsRes.data.data.projects || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg?.id, days]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header + Day Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            Organization performance overview
          </p>
        </div>

        {/* Date range toggle */}
        <div className="flex items-center gap-1 bg-[#f4f4f4] dark:bg-slate-800 rounded-lg p-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-white dark:bg-slate-700 text-[#476e66] shadow-sm'
                  : 'text-[#708a83] hover:text-slate-900'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Tasks"
            value={overview.totalTasks}
            icon={CheckSquare}
            subtitle={`+${overview.newTasksThisPeriod} this period`}
          />
          <StatCard
            title="Completion Rate"
            value={`${overview.completionRate}%`}
            icon={TrendingUp}
            subtitle={`${overview.completedTasks} completed`}
            accent="text-[#476e66]"
          />
          <StatCard
            title="Overdue"
            value={overview.overdueTasks}
            icon={Clock}
            accent="text-red-500"
          />
          <StatCard
            title="Active Members"
            value={overview.totalMembers}
            icon={Users}
          />
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Task Status Pie Chart */}
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Tasks by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={tasksByStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {tasksByStatus.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || '#bec0bf'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, String(name).replace('_', ' ')]}
                    contentStyle={{
                      background: '#fefefe',
                      border: '1px solid #dfdfe2',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    formatter={(value) => String(value).replace('_', ' ')}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center">
                <p className="text-sm text-[#708a83]">No task data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Velocity Line Chart */}
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Task Completion Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={velocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#bec0bf' }}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString('en', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    interval={Math.floor(velocity.length / 6)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#bec0bf' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#fefefe',
                      border: '1px solid #dfdfe2',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#476e66"
                    strokeWidth={2}
                    dot={false}
                    name="Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center">
                <p className="text-sm text-[#708a83]">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Activity + Project Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Member Activity Table */}
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Most Active Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberActivity.length === 0 ? (
              <p className="text-sm text-[#708a83] text-center py-6">
                No activity data
              </p>
            ) : (
              <div className="space-y-3">
                {memberActivity.map((item, index) => (
                  <div
                    key={item.user.id}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-[#bec0bf] w-4">
                      {index + 1}
                    </span>
                    <UserAvatar user={item.user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.user.firstName} {item.user.lastName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div
                          className="h-1 bg-[#476e66] rounded-full"
                          style={{
                            width: `${Math.round(
                              (item.tasksCompleted /
                                (memberActivity[0]?.tasksCompleted || 1)) *
                                100,
                            )}%`,
                            maxWidth: '100%',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#476e66] shrink-0">
                      {item.tasksCompleted}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Progress */}
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectProgress.length === 0 ? (
              <p className="text-sm text-[#708a83] text-center py-6">
                No active projects
              </p>
            ) : (
              <div className="space-y-3.5">
                {projectProgress.slice(0, 6).map((project) => (
                  <div key={project.projectId}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-900 dark:text-white truncate max-w-[60%]">
                        {project.projectName}
                      </span>
                      <span className="text-[#708a83]">
                        {project.done}/{project.total} · {project.completionPct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#f4f4f4] dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#476e66] rounded-full transition-all duration-500"
                        style={{ width: `${project.completionPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}