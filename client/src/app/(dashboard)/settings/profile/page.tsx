'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useAppSelector, useAppDispatch } from '@/hooks/redux.hooks';
import { updateUser } from '@/store/slices/auth.slice';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// PROFILE FORM
// ─────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  avatar: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

function ProfileForm() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      avatar: user?.avatar || '',
    },
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setApiError('');
    try {
      const res = await api.patch('/auth/me', {
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar || null,
      });
      dispatch(updateUser(res.data.data.user));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-[#dfdfe2] dark:border-slate-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Personal information</CardTitle>
        <CardDescription className="text-xs">
          Update your name and avatar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-600">Profile updated</p>
            </div>
          )}

          {/* Avatar preview */}
          {user && (
            <div className="flex items-center gap-3 pb-2">
              <UserAvatar user={user} size="lg" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-[#708a83]">{user.email}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                {...register('firstName')}
                className={`border-[#dfdfe2] ${errors.firstName ? 'border-red-500' : ''}`}
              />
              {errors.firstName && (
                <p className="text-xs text-red-500">{errors.firstName.message as string}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                {...register('lastName')}
                className={`border-[#dfdfe2] ${errors.lastName ? 'border-red-500' : ''}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Avatar URL{' '}
              <span className="text-[#bec0bf] font-normal text-xs">(optional)</span>
            </Label>
            <Input
              type="url"
              placeholder="https://example.com/avatar.jpg"
              {...register('avatar')}
              className="border-[#dfdfe2]"
            />
            {errors.avatar && (
              <p className="text-xs text-red-500">{errors.avatar.message as string}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Save size={14} className="mr-2" />Save changes</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// CHANGE PASSWORD FORM
// ─────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'One uppercase')
      .regex(/[0-9]/, 'One number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'One special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setApiError('');
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      reset();
      setTimeout(() => setSuccess(false), 4000);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Password change failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-[#dfdfe2] dark:border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-[#708a83]" />
          <CardTitle className="text-base">Change password</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Use a strong password with uppercase, numbers, and symbols
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-600">Password changed successfully</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Current password</Label>
            <Input
              type="password"
              {...register('currentPassword')}
              className={`border-[#dfdfe2] ${errors.currentPassword ? 'border-red-500' : ''}`}
            />
            {errors.currentPassword && (
              <p className="text-xs text-red-500">{errors.currentPassword.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              {...register('newPassword')}
              className={`border-[#dfdfe2] ${errors.newPassword ? 'border-red-500' : ''}`}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-500">{errors.newPassword.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              {...register('confirmPassword')}
              className={`border-[#dfdfe2] ${errors.confirmPassword ? 'border-red-500' : ''}`}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword.message as string}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Change password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function ProfileSettingsPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Profile
        </h1>
        <p className="text-sm text-[#708a83] mt-0.5">
          Manage your personal information
        </p>
      </div>
      <ProfileForm />
      <ChangePasswordForm />
    </div>
  );
}