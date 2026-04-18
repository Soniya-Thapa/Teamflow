'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/shared/modal';
import { TaskCard } from './_components/task-card';
import { TaskDetail } from './_components/task-detail';
import { TaskForm } from './_components/task-form';
import { KanbanBoard } from './_components/kanban-board';
import { SkeletonTable } from '@/components/shared/skeleton';
import { useOrgApi } from '@/hooks/use-org-api';
import { useAppSelector } from '@/hooks/redux.hooks';
import { Task } from '@/types';

type ViewMode = 'list' | 'board';

export default function TasksPage() {
  const { orgId, buildUrl, api } = useOrgApi();
  const { user } = useAppSelector((state) => state.auth);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!orgId || !user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('assignedTo', user.id);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(buildUrl(`/tasks?${params}`));
      setTasks(res.data.data.tasks || []);
    } catch {
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, user, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const statuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Tasks
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#476e66] hover:bg-[#3d6059] text-white"
        >
          <Plus size={16} className="mr-2" />
          New task
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bec0bf]"
          />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-52 border-[#dfdfe2] bg-[#fefefe]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !statusFilter
                ? 'bg-[#476e66] text-white'
                : 'bg-[#f4f4f4] text-[#708a83] hover:bg-[#dfdfe2]'
            }`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#476e66] text-white'
                  : 'bg-[#f4f4f4] text-[#708a83] hover:bg-[#dfdfe2]'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-[#f4f4f4] dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-[#476e66] shadow-sm'
                : 'text-[#708a83]'
            }`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'board'
                ? 'bg-white dark:bg-slate-700 text-[#476e66] shadow-sm'
                : 'text-[#708a83]'
            }`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : viewMode === 'board' ? (
        <KanbanBoard
          tasks={filtered}
          orgId={orgId!}
          onTaskClick={setSelectedTask}
          onRefresh={fetchTasks}
        />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                No tasks found
              </p>
              <p className="text-sm text-[#708a83] mt-1">
                Tasks assigned to you will appear here
              </p>
            </div>
          ) : (
            filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={setSelectedTask}
              />
            ))
          )}
        </div>
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            fetchTasks();
            setSelectedTask(null);
          }}
        />
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <Modal title="Create task" onClose={() => setShowCreate(false)}>
          <TaskForm
            orgId={orgId!}
            onSuccess={() => {
              setShowCreate(false);
              fetchTasks();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}
    </div>
  );
}