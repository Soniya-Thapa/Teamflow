'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  StarOff,
  Archive,
  Pencil,
  CheckSquare,
  Clock,
  Users,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/shared/modal';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { SkeletonTable } from '@/components/shared/skeleton';
import { ProjectForm } from '../_components/project-form';
import { useOrgApi } from '@/hooks/use-org-api';
import { Project, Task } from '@/types';
import api from '@/lib/axios';
import { TaskCard } from '../../tasks/_components/task-card';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId, buildUrl } = useOrgApi();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const [projectRes, tasksRes, statsRes, activityRes] = await Promise.all([
        api.get(buildUrl(`/projects/${projectId}`)),
        api.get(buildUrl(`/tasks?projectId=${projectId}&limit=10`)),
        api.get(buildUrl(`/projects/${projectId}/stats`)),
        api.get(buildUrl(`/projects/${projectId}/activity?limit=5`)),
      ]);

      setProject(projectRes.data.data.project);
      setTasks(tasksRes.data.data.tasks || []);
      setStats(statsRes.data.data.stats);
      setActivity(activityRes.data.data.activities || []);
    } catch {
      router.push('/projects');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleFavorite = async () => {
    if (!project) return;
    try {
      await api.post(buildUrl(`/projects/${projectId}/favorite`));
      fetchProject();
    } catch {}
  };

  const handleArchive = async () => {
    if (!project) return;
    try {
      await api.patch(
        buildUrl(
          `/projects/${projectId}/${
            project.status === 'ARCHIVED' ? 'unarchive' : 'archive'
          }`,
        ),
      );
      fetchProject();
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <SkeletonTable rows={4} />
      </div>
    );
  }

  if (!project) return null;

  const completionPct = stats
    ? Math.round((stats.done / (stats.total || 1)) * 100)
    : 0;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/projects')}
        className="inline-flex items-center gap-1.5 text-sm text-[#708a83] hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Back to projects
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-sm text-[#708a83]">{project.description}</p>
          )}
          {project.team && (
            <p className="text-xs text-[#bec0bf] mt-1">Team: {project.team.name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleFavorite}
            className={`p-2 rounded-lg border transition-colors ${
              project.isFavorite
                ? 'border-amber-200 bg-amber-50 text-amber-500'
                : 'border-[#dfdfe2] text-[#bec0bf] hover:text-amber-400 hover:border-amber-200'
            }`}
          >
            {project.isFavorite ? (
              <Star size={15} fill="currentColor" />
            ) : (
              <StarOff size={15} />
            )}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            className="border-[#dfdfe2] text-[#708a83]"
          >
            <Archive size={13} className="mr-1.5" />
            {project.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
            className="border-[#dfdfe2]"
          >
            <Pencil size={13} className="mr-1.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: CheckSquare, color: 'text-[#476e66]' },
            { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-blue-500' },
            { label: 'Done', value: stats.done, icon: CheckSquare, color: 'text-green-500' },
            { label: 'Overdue', value: stats.overdue, icon: Clock, color: 'text-red-500' },
          ].map((s) => (
            <Card key={s.label} className="border-[#dfdfe2] dark:border-slate-700">
              <CardContent className="pt-4 pb-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#708a83]">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {s.value}
                  </p>
                </div>
                <s.icon size={18} className={s.color} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completion Bar */}
      {stats && stats.total > 0 && (
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Completion
              </span>
              <span className="text-sm font-bold text-[#476e66]">
                {completionPct}%
              </span>
            </div>
            <div className="h-2 bg-[#f4f4f4] dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#476e66] rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Recent Tasks
            </h2>
            <button
              onClick={() => router.push(`/projects/${projectId}/tasks`)}
              className="text-xs text-[#476e66] hover:underline"
            >
              View all →
            </button>
          </div>

          {tasks.length === 0 ? (
            <Card className="border-[#dfdfe2] border-dashed dark:border-slate-700">
              <CardContent className="text-center py-8">
                <p className="text-sm text-[#708a83]">No tasks yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Recent Activity
          </h2>
          <Card className="border-[#dfdfe2] dark:border-slate-700">
            <CardContent className="pt-4">
              {activity.length === 0 ? (
                <p className="text-sm text-[#708a83] text-center py-4">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-4">
                  {activity.map((a) => (
                    <div key={a.id} className="flex gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#476e66] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-medium">
                            {a.user?.firstName}
                          </span>{' '}
                          {a.action.toLowerCase().replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-[#bec0bf] mt-0.5">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showEdit && (
        <Modal title="Edit project" onClose={() => setShowEdit(false)}>
          <ProjectForm
            orgId={orgId!}
            project={project}
            onSuccess={() => {
              setShowEdit(false);
              fetchProject();
            }}
            onCancel={() => setShowEdit(false)}
          />
        </Modal>
      )}
    </div>
  );
}