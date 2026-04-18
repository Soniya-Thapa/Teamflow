/**
 * @file priority-badge.tsx
 * @description Task priority badge component.
 */

import { TaskPriority } from '@/types';

const config: Record<TaskPriority, { label: string; className: string }> = {
  LOW: {
    label: 'Low',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  MEDIUM: {
    label: 'Medium',
    className:
      'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  },
  HIGH: {
    label: 'High',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  URGENT: {
    label: 'Urgent',
    className: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const c = config[priority];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}