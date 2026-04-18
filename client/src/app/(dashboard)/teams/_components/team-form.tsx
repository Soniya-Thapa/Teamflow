'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Team } from '@/types';
import api from '@/lib/axios';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  leaderId: z.string().uuid().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface TeamFormProps {
  orgId: string;
  team?: Team;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TeamForm({ orgId, team, onSuccess, onCancel }: TeamFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [members, setMembers] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: team?.name || '',
      description: team?.description || '',
      leaderId: team?.leaderId || '',
    },
  });

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/members`)
      .then((res) => setMembers(res.data.data.members || []))
      .catch(() => {});
  }, [orgId]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        leaderId: data.leaderId || undefined,
      };

      if (team) {
        await api.patch(`/organizations/${orgId}/teams/${team.id}`, payload);
      } else {
        await api.post(`/organizations/${orgId}/teams`, payload);
      }

      onSuccess();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to save team');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
      {apiError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Team name</Label>
        <Input
          placeholder="Engineering, Design, Marketing..."
          {...register('name')}
          className={`border-[#dfdfe2] ${errors.name ? 'border-red-500' : ''}`}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Description{' '}
          <span className="text-[#bec0bf] font-normal text-xs">(optional)</span>
        </Label>
        <textarea
          {...register('description')}
          placeholder="What does this team work on?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-[#bec0bf] resize-none focus:outline-none focus:ring-2 focus:ring-[#476e66]/30 focus:border-[#476e66]"
        />
      </div>

      <div className="space-y-2">
        <Label>
          Team leader{' '}
          <span className="text-[#bec0bf] font-normal text-xs">(optional)</span>
        </Label>
        <select
          {...register('leaderId')}
          className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
        >
          <option value="">No leader</option>
          {members.map((m) => (
            <option key={m.user?.id} value={m.user?.id}>
              {m.user?.firstName} {m.user?.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-[#dfdfe2]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : team ? (
            'Save changes'
          ) : (
            'Create team'
          )}
        </Button>
      </div>
    </form>
  );
}