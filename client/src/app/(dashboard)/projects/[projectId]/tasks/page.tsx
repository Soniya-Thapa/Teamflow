'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/shared/modal';
import { KanbanBoard } from '../../../tasks/_components/kanban-board';
import { TaskDetail } from '../../../tasks/_components/task-detail';
import { TaskForm } from '../../../tasks/_components/task-form';
import { SkeletonTable } from '@/components/shared/skeleton';
import { useOrgApi } from '@/hooks/use-org-api';
import { Task } from '@/types';
import api from '@/lib/axios';

export default function ProjectTasksPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId, buildUrl } = useOrgApi();
  const projectId = params.projectId as string;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const [tasksRes, projectRes] = await Promise.all([
        api.get(buildUrl(`/tasks?projectId=${projectId}&limit=100`)),
        api.get(buildUrl(`/projects/${projectId}`)),
      ]);
      setTasks(tasksRes.data.data.tasks || []);
      setProjectName(projectRes.data.data.project?.name || 'Project');
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="inline-flex items-center gap-1.5 text-sm text-[#708a83] hover:text-slate-900 dark:hover:text-white transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            Back to {projectName}
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Kanban Board
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {projectName}
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

      {/* Board */}
      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : (
        <KanbanBoard
          tasks={tasks}
          orgId={orgId!}
          projectId={projectId}
          onTaskClick={setSelectedTask}
          onRefresh={fetchTasks}
        />
      )}

      {/* Task Detail */}
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

      {/* Create Task */}
      {showCreate && (
        <Modal title="Create task" onClose={() => setShowCreate(false)}>
          <TaskForm
            orgId={orgId!}
            defaultProjectId={projectId}
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