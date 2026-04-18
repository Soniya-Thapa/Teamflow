'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task } from '@/types';
import api from '@/lib/axios';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(10000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().optional(),
  estimatedHours: z.number().int().min(0).optional(),
  projectId: z.string().uuid('Select a project'),
});

type FormData = z.infer<typeof schema>;

export function TaskForm({
  orgId,
  task,
  defaultProjectId,
  onSuccess,
  onCancel,
}: {
  orgId: string;
  task?: Task;
  defaultProjectId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || 'TODO',
      priority: task?.priority || 'MEDIUM',
      assignedTo: task?.assignedTo || '',
      dueDate: task?.dueDate?.split('T')[0] || '',
      estimatedHours: task?.estimatedHours || undefined,
      projectId: task?.projectId || defaultProjectId || '',
    },
  });

  useEffect(() => {
    Promise.all([
      api.get(`/organizations/${orgId}/members`),
      api.get(`/organizations/${orgId}/projects`),
    ])
      .then(([membersRes, projectsRes]) => {
        setMembers(membersRes.data.data.members || []);
        setProjects(
          (projectsRes.data.data.projects || []).filter(
            (p: any) => p.status === 'ACTIVE',
          ),
        );
      })
      .catch(() => {});
  }, [orgId]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');
    try {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assignedTo || null,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        estimatedHours: data.estimatedHours || null,
        projectId: data.projectId,
      };

      if (task) {
        await api.patch(
          `/organizations/${orgId}/tasks/${task.id}`,
          payload,
        );
      } else {
        await api.post(`/organizations/${orgId}/tasks`, payload);
      }
      onSuccess();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to save task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          placeholder="Task title"
          {...register('title')}
          className={`border-[#dfdfe2] ${errors.title ? 'border-red-500' : ''}`}
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Description <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
        <textarea
          {...register('description')}
          placeholder="What needs to be done?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-[#bec0bf] resize-none focus:outline-none focus:ring-2 focus:ring-[#476e66]/30 focus:border-[#476e66]"
        />
      </div>

      {!defaultProjectId && (
        <div className="space-y-2">
          <Label>Project</Label>
          <select
            {...register('projectId')}
            className={`w-full h-9 px-3 rounded-lg border bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white ${
              errors.projectId ? 'border-red-500' : 'border-[#dfdfe2] dark:border-slate-700'
            }`}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.projectId && (
            <p className="text-xs text-red-500">{errors.projectId.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <select
            {...register('status')}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            {['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <select
            {...register('priority')}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assignee <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
          <select
            {...register('assignedTo')}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user?.id} value={m.user?.id}>
                {m.user?.firstName} {m.user?.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Due date <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
          <Input type="date" {...register('dueDate')} className="border-[#dfdfe2]" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[#dfdfe2]">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : task ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </form>
  );
}