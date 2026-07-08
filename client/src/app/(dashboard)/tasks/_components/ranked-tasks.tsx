'use client';

/**
 * @file ranked-tasks.tsx
 * @description Shows tasks sorted by our custom urgency algorithm.
 *
 * Each task shows its urgency score and a breakdown of
 * what contributed to that score (due date, priority, workload, age).
 */

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/redux.hooks';
import { Clock, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// URGENCY BADGE
// ─────────────────────────────────────────

function UrgencyBadge({
  label,
  score,
}: {
  label: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
}) {
  const styles = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[label]}`}
    >
      {label} · {score.toFixed(1)}
    </span>
  );
}

// ─────────────────────────────────────────
// SCORE BAR
// ─────────────────────────────────────────

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500 w-8 text-right">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────
// RANKED TASK CARD
// ─────────────────────────────────────────

function RankedTaskCard({ task, rank }: { task: any; rank: number }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-3">

        {/* Rank number */}
        <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-slate-400">#{rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + urgency badge */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-white truncate">
              {task.title}
            </p>
            <UrgencyBadge
              label={task.urgencyLabel}
              score={task.urgencyScore}
            />
          </div>

          {/* Due date */}
          {task.dueDate && (
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={11} className="text-slate-500" />
              <span className="text-xs text-slate-400">
                Due{' '}
                {new Date(task.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {new Date(task.dueDate) < new Date() && (
                <span className="text-xs text-red-400 font-medium">
                  (Overdue)
                </span>
              )}
            </div>
          )}

          {/* Score breakdown toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-xs text-[#476e66] hover:underline"
          >
            {showBreakdown ? 'Hide' : 'Show'} score breakdown
          </button>

          {/* Score breakdown bars */}
          {showBreakdown && task.scoreBreakdown && (
            <div className="mt-3 space-y-1.5 bg-slate-800/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                Urgency Score Breakdown
              </p>
              <ScoreBar
                label="Due Date"
                score={task.scoreBreakdown.dueDateScore}
                color="bg-blue-500"
              />
              <ScoreBar
                label="Priority"
                score={task.scoreBreakdown.priorityScore}
                color="bg-purple-500"
              />
              <ScoreBar
                label="Workload"
                score={task.scoreBreakdown.workloadScore}
                color="bg-amber-500"
              />
              <ScoreBar
                label="Age"
                score={task.scoreBreakdown.ageScore}
                color="bg-green-500"
              />
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Final Score (weighted)
                  </span>
                  <span className="text-[10px] text-white font-bold">
                    {task.urgencyScore.toFixed(2)} / 100
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

export function RankedTaskList({ projectId }: { projectId?: string }) {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;

    const url = projectId
      ? `/organizations/${activeOrg.id}/tasks/ranked?projectId=${projectId}`
      : `/organizations/${activeOrg.id}/tasks/ranked`;

    api
      .get(url)
      .then((res) => setTasks(res.data.data.tasks || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeOrg?.id, projectId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-slate-900 border border-slate-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No active tasks to rank</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Algorithm explanation banner */}
      <div className="bg-[#476e66]/10 border border-[#476e66]/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <TrendingUp size={16} className="text-[#476e66] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#476e66]">
            Smart Priority Ranking
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Tasks ranked by urgency score (0-100) calculated from due date
            (40%), priority label (30%), assignee workload (20%), and task
            age (10%).
          </p>
        </div>
      </div>

      {/* Ranked task list */}
      {tasks.map((task, index) => (
        <RankedTaskCard key={task.id} task={task} rank={index + 1} />
      ))}
    </div>
  );
}