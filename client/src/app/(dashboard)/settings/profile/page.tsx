'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, KeyRound, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useAppSelector, useAppDispatch } from '@/hooks/redux.hooks';
import { updateUser } from '@/store/slices/auth.slice';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// AVATAR UPLOADER COMPONENT
// Click avatar → file picker → upload → show new avatar
// ─────────────────────────────────────────

function AvatarUploader() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately before upload finishes
    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);

    setIsUploading(true);
    setError('');

    try {
      // Build FormData — same as attaching a file to a form
      const formData = new FormData();
      formData.append('avatar', file); // 'avatar' matches multer field name

      const res = await api.post('/auth/upload-avatar', formData, {
        headers: {
          // Let browser set Content-Type with boundary automatically
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update Redux state with new avatar URL from Cloudinary
      dispatch(updateUser({ avatar: res.data.data.avatarUrl }));

      // Clean up local preview URL
      URL.revokeObjectURL(localPreviewUrl);
      setPreview(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed. Please try again.');
      setPreview(null);
    } finally {
      setIsUploading(false);
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // The image to display: local preview → Cloudinary URL → initials fallback
  const displayImage = preview || user?.avatar;
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <div className="flex items-center gap-4 pb-2">
      {/* Clickable avatar */}
      <div className="relative group">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="relative w-16 h-16 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#476e66] focus:ring-offset-2"
          title="Click to change avatar"
        >
          {/* Avatar image or initials */}
          {displayImage ? (
            <img
              src={displayImage}
              alt="Profile avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#476e66] flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {initials}
              </span>
            </div>
          )}

          {/* Hover overlay with camera icon */}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            {isUploading ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Camera size={18} className="text-white" />
            )}
          </div>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Text next to avatar */}
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="text-xs text-[#708a83]">{user?.email}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs text-[#476e66] hover:underline mt-0.5 disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Change photo'}
        </button>
        {error && (
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PROFILE FORM
// ─────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function ProfileForm() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setApiError('');
    try {
      const res = await api.patch('/auth/me', {
        firstName: data.firstName,
        lastName: data.lastName,
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
          Update your name and profile photo
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
              <p className="text-sm text-green-600">Profile updated successfully</p>
            </div>
          )}

          {/* Clickable avatar upload */}
          <AvatarUploader />

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                {...register('firstName')}
                className={`border-[#dfdfe2] ${errors.firstName ? 'border-red-500' : ''}`}
              />
              {errors.firstName && (
                <p className="text-xs text-red-500">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                {...register('lastName')}
                className={`border-[#dfdfe2] ${errors.lastName ? 'border-red-500' : ''}`}
              />
              {errors.lastName && (
                <p className="text-xs text-red-500">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save size={14} className="mr-2" />
                Save changes
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// CHANGE PASSWORD FORM
// (keep your existing ChangePasswordForm here — no changes needed)
// ─────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'One uppercase letter required')
      .regex(/[0-9]/, 'One number required')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'One special character required'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormData) => {
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
      setApiError(
        error?.response?.data?.message || 'Password change failed',
      );
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
              <p className="text-sm text-green-600">
                Password changed successfully
              </p>
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
              <p className="text-xs text-red-500">
                {errors.currentPassword.message}
              </p>
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
              <p className="text-xs text-red-500">
                {errors.newPassword.message}
              </p>
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
              <p className="text-xs text-red-500">
                {errors.confirmPassword.message}
              </p>
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