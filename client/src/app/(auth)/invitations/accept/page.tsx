'use client';

/**
 * @file invitations/accept/page.tsx
 * @description Handles invitation acceptance from email link.
 *
 * FLOW:
 * 1. User clicks email link → /invitations/accept?token=abc123
 * 2. This page reads the token from URL
 * 3. Calls GET /invitations/:token to preview the invitation
 * 4. If user has account → shows login form
 * 5. If new user → shows register form
 * 6. On submit → POST /invitations/accept
 * 7. User is logged in and redirected to dashboard
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
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
import { useAppDispatch } from '@/hooks/redux.hooks';
import { fetchCurrentUser } from '@/store/slices/auth.slice';
import { fetchUserOrganizations } from '@/store/slices/organization.slice';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────

const existingUserSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const newUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter required')
    .regex(/[0-9]/, 'One number required')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'One special character required'),
});

// ─────────────────────────────────────────
// INVITATION CONTENT
// ─────────────────────────────────────────

function AcceptInvitationContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Invitation preview data
  const [invitation, setInvitation] = useState<any>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const [invitationError, setInvitationError] = useState('');

  // Form state
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // ── STEP 1: Fetch invitation preview ──

  useEffect(() => {
    if (!token) {
      setInvitationError('Invalid invitation link. No token found.');
      setIsLoadingInvitation(false);
      return;
    }

    api
      .get(`/invitations/${token}`)
      .then((res) => {
        setInvitation(res.data.data);
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message ||
          'This invitation link is invalid or has expired.';
        setInvitationError(message);
      })
      .finally(() => {
        setIsLoadingInvitation(false);
      });
  }, [token]);

  // ── EXISTING USER FORM ────────────────

  const existingUserForm = useForm({
    resolver: zodResolver(existingUserSchema),
  });

  // ── NEW USER FORM ─────────────────────

  const newUserForm = useForm({
    resolver: zodResolver(newUserSchema),
  });

  // ── STEP 2: Accept invitation ─────────

  const handleExistingUserSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await api.post('/invitations/accept', {
        token,
        password: data.password,
      });

      setIsSuccess(true);

      // Restore session and redirect
      await dispatch(fetchCurrentUser());
      await dispatch(fetchUserOrganizations());

      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || 'Failed to accept invitation.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewUserSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await api.post('/invitations/accept', {
        token,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
      });

      setIsSuccess(true);

      // Restore session and redirect
      await dispatch(fetchCurrentUser());
      await dispatch(fetchUserOrganizations());

      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || 'Failed to create account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── LOADING STATE ─────────────────────

  if (isLoadingInvitation) {
    return (
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={28} className="animate-spin text-[#476e66]" />
          <p className="text-sm text-[#708a83]">Loading invitation...</p>
        </CardContent>
      </Card>
    );
  }

  // ── ERROR STATE ───────────────────────

  if (invitationError) {
    return (
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center justify-center">
            <XCircle size={28} className="text-red-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900 dark:text-white">
              Invalid invitation
            </p>
            <p className="text-sm text-[#708a83] mt-1">{invitationError}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="border-[#dfdfe2]"
          >
            Go to login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── SUCCESS STATE ─────────────────────

  if (isSuccess) {
    return (
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-14 h-14 bg-green-50 dark:bg-green-950 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900 dark:text-white">
              Welcome to {invitation?.organization?.name}!
            </p>
            <p className="text-sm text-[#708a83] mt-1">
              Redirecting to dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isExistingUser = invitation?.hasAccount === true;
  const orgName = invitation?.organization?.name || 'the organization';
  const inviterName = invitation?.inviter
    ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
    : 'Someone';
  const role = invitation?.invitation?.role || 'MEMBER';

  return (
    <Card className="shadow-lg border-slate-200 dark:border-slate-800">
      <CardHeader className="space-y-1 pb-4">
        {/* Org logo or initials */}
        <div className="flex justify-center mb-2">
          {invitation?.organization?.logo ? (
            <img
              src={invitation.organization.logo}
              alt={orgName}
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div className="w-14 h-14 bg-[#476e66] rounded-xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {orgName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <CardTitle className="text-xl font-bold tracking-tight text-center">
          You&apos;re invited!
        </CardTitle>
        <CardDescription className="text-center">
          <span className="font-medium text-slate-900 dark:text-white">
            {inviterName}
          </span>{' '}
          invited you to join{' '}
          <span className="font-medium text-[#476e66]">{orgName}</span> as{' '}
          <span className="font-medium">{role}</span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {submitError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          </div>
        )}

        {/* ── EXISTING USER — just needs password ── */}
        {isExistingUser ? (
          <form
            onSubmit={existingUserForm.handleSubmit(handleExistingUserSubmit)}
            className="space-y-4"
          >
            <p className="text-sm text-[#708a83]">
              We found an account with{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {invitation?.invitation?.email}
              </span>
              . Enter your password to accept the invitation.
            </p>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...existingUserForm.register('password')}
                  className="pr-10 border-[#dfdfe2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {existingUserForm.formState.errors.password && (
                <p className="text-xs text-red-500">
                  {existingUserForm.formState.errors.password.message as string}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#476e66] hover:bg-[#3d6059] text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Join ${orgName}`
              )}
            </Button>
          </form>
        ) : (
          /* ── NEW USER — needs full registration ── */
          <form
            onSubmit={newUserForm.handleSubmit(handleNewUserSubmit)}
            className="space-y-4"
          >
            <p className="text-sm text-[#708a83]">
              Create your account to join{' '}
              <span className="font-medium text-[#476e66]">{orgName}</span>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input
                  {...newUserForm.register('firstName')}
                  placeholder="Jane"
                  className="border-[#dfdfe2]"
                />
                {newUserForm.formState.errors.firstName && (
                  <p className="text-xs text-red-500">
                    {newUserForm.formState.errors.firstName.message as string}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input
                  {...newUserForm.register('lastName')}
                  placeholder="Doe"
                  className="border-[#dfdfe2]"
                />
                {newUserForm.formState.errors.lastName && (
                  <p className="text-xs text-red-500">
                    {newUserForm.formState.errors.lastName.message as string}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...newUserForm.register('password')}
                  className="pr-10 border-[#dfdfe2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newUserForm.formState.errors.password && (
                <p className="text-xs text-red-500">
                  {newUserForm.formState.errors.password.message as string}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#476e66] hover:bg-[#3d6059] text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Create account & join ${orgName}`
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE WRAPPER (Suspense required for useSearchParams)
// ─────────────────────────────────────────

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <Card className="shadow-lg">
          <CardContent className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#476e66]" />
          </CardContent>
        </Card>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}