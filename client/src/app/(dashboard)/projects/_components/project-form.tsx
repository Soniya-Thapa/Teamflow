'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Project } from '@/types';
import api from '@/lib/axios';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  teamId: z.string().uuid().optional().or(z.literal('')),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ProjectForm({
  orgId,
  project,
  onSuccess,
  onCancel,
}: {
  orgId: string;
  project?: Project;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [teams, setTeams] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      teamId: project?.teamId || '',
      visibility: project?.visibility || 'PUBLIC',
      startDate: project?.startDate?.split('T')[0] || '',
      endDate: project?.endDate?.split('T')[0] || '',
    },
  });

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/teams`)
      .then((res) => setTeams(res.data.data.teams || []))
      .catch(() => {});
  }, [orgId]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        teamId: data.teamId || null,
        visibility: data.visibility,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };

      if (project) {
        await api.patch(`/organizations/${orgId}/projects/${project.id}`, payload);
      } else {
        await api.post(`/organizations/${orgId}/projects`, payload);
      }
      onSuccess();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to save project');
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
        <Label>Project name</Label>
        <Input
          placeholder="My Awesome Project"
          {...register('name')}
          className={`border-[#dfdfe2] ${errors.name ? 'border-red-500' : ''}`}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Description <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
        <textarea
          {...register('description')}
          placeholder="What is this project about?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-[#bec0bf] resize-none focus:outline-none focus:ring-2 focus:ring-[#476e66]/30 focus:border-[#476e66]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Team <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
          <select
            {...register('teamId')}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Visibility</Label>
          <select
            {...register('visibility')}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start date <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
          <Input type="date" {...register('startDate')} className="border-[#dfdfe2]" />
        </div>
        <div className="space-y-2">
          <Label>End date <span className="text-[#bec0bf] font-normal text-xs">(optional)</span></Label>
          <Input type="date" {...register('endDate')} className="border-[#dfdfe2]" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[#dfdfe2]">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}