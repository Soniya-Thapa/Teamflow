/**
 * @file status-badge.tsx
 * @description Task and project status badge components.
 */

import { TaskStatus, ProjectStatus } from '@/types';

const taskConfig: Record<TaskStatus, { label: string; className: string }> = {
  TODO: {
    label: 'To Do',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-[#476e66]/10 text-[#476e66] dark:bg-[#476e66]/20 dark:text-[#708a83]',
  },
  REVIEW: {
    label: 'Review',
    className:
      'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  },
  DONE: {
    label: 'Done',
    className:
      'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  },
};

const projectConfig: Record<ProjectStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className:
      'bg-[#476e66]/10 text-[#476e66] dark:bg-[#476e66]/20 dark:text-[#708a83]',
  },
  ARCHIVED: {
    label: 'Archived',
    className:
      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const c = taskConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const c = projectConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}