'use client';

import { Task, TaskStatus } from '@/types';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { TaskStatusBadge } from '@/components/shared/status-badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Calendar, MessageSquare, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  dragging?: boolean;
  onClick?: (task: Task) => void;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const isOverdue = date < now;
  return isOverdue ? `Overdue: ${date.toLocaleDateString()}` : date.toLocaleDateString();
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'DONE') return false;
  return new Date(dateStr) < new Date();
}

export function TaskCard({ task, compact, dragging, onClick }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(task)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 hover:border-[#708a83] hover:shadow-sm transition-all',
          onClick && 'cursor-pointer',
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {task.title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
          {task.assignee && <UserAvatar user={task.assignee} size="sm" />}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        'bg-[#fefefe] dark:bg-slate-900 rounded-xl border border-[#dfdfe2] dark:border-slate-700 p-3.5 space-y-2.5 hover:shadow-md hover:border-[#708a83] transition-all duration-150',
        onClick && 'cursor-pointer',
        dragging && 'shadow-lg rotate-1 border-[#476e66]',
      )}
    >
      {/* Priority */}
      <div className="flex items-start justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        {task._count?.comments !== undefined && task._count.comments > 0 && (
          <div className="flex items-center gap-1 text-[#bec0bf]">
            <MessageSquare size={11} />
            <span className="text-xs">{task._count.comments}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug line-clamp-2">
        {task.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-red-500' : 'text-[#bec0bf]',
              )}
            >
              <Calendar size={10} />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          {task._count?.subtasks !== undefined && task._count.subtasks > 0 && (
            <div className="flex items-center gap-1 text-xs text-[#bec0bf]">
              <GitBranch size={10} />
              <span>{task._count.subtasks}</span>
            </div>
          )}
        </div>

        {task.assignee && <UserAvatar user={task.assignee} size="sm" />}
      </div>
    </div>
  );
}