'use client';

/**
 * @file organizations/new/page.tsx
 * @description Create a new organization.
 * Slug is auto-generated from the name as you type.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAppDispatch } from '@/hooks/redux.hooks';
import { setActiveOrg } from '@/store/slices/organization.slice';
import { fetchUserOrganizations } from '@/store/slices/organization.slice';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────

const schema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Only lowercase letters, numbers, and hyphens',
    ),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

// ─────────────────────────────────────────
// SLUG GENERATOR
// ─────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/-+/g, '-')           // multiple hyphens to one
    .trim()
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function NewOrganizationPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', logo: '' },
  });

  const watchedName = watch('name');

  // Auto-generate slug from name unless user has manually edited it
  useEffect(() => {
    if (!slugManuallyEdited && watchedName) {
      setValue('slug', generateSlug(watchedName), { shouldValidate: true });
    }
  }, [watchedName, slugManuallyEdited, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const response = await api.post('/organizations', {
        name: data.name,
        slug: data.slug,
        logo: data.logo || undefined,
      });

      const newOrg = response.data.data;

      // Set as active org and refresh org list
      dispatch(setActiveOrg(newOrg));
      dispatch(fetchUserOrganizations());

      router.push('/dashboard');
    } catch (error: any) {
      setApiError(
        error?.response?.data?.message || 'Failed to create organization',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Create organization
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mt-1 text-sm">
          Set up a workspace for your team
        </p>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950 rounded-xl flex items-center justify-center">
              <Building2 className="text-indigo-600 dark:text-indigo-400" size={18} />
            </div>
            <div>
              <CardTitle className="text-base">Organization details</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                You can change these later in settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {apiError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                {...register('name')}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug{' '}
                <span className="text-slate-400 font-normal text-xs">
                  (auto-generated, can edit)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  teamflow.com/
                </span>
                <Input
                  id="slug"
                  placeholder="acme-corporation"
                  className={`pl-28 ${errors.slug ? 'border-red-500' : ''}`}
                  {...register('slug')}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    register('slug').onChange(e);
                  }}
                />
              </div>
              {errors.slug && (
                <p className="text-xs text-red-500">{errors.slug.message}</p>
              )}
              <p className="text-xs text-slate-400">
                Lowercase letters, numbers, and hyphens only. Cannot be changed later.
              </p>
            </div>

            {/* Logo URL (optional) */}
            <div className="space-y-2">
              <Label htmlFor="logo">
                Logo URL{' '}
                <span className="text-slate-400 font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://example.com/logo.png"
                {...register('logo')}
                className={errors.logo ? 'border-red-500' : ''}
              />
              {errors.logo && (
                <p className="text-xs text-red-500">{errors.logo.message}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create organization'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}