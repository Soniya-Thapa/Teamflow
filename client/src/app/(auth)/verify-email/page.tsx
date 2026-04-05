'use client';

/**
 * @file verify-email/page.tsx
 * @description Email verification landing page.
 * User lands here after clicking link in verification email.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/axios';
import { useAppDispatch } from '@/hooks/redux.hooks';
import { fetchCurrentUser } from '@/store/slices/auth.slice';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    const verify = async () => {
      try {
        await api.get(`/auth/verify-email?token=${token}`);
        // Refresh user state so isEmailVerified updates
        await dispatch(fetchCurrentUser());
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error?.response?.data?.message || 'Verification failed. Link may be expired.',
        );
      }
    };

    verify();
  }, [token, dispatch]);

  return (
    <Card className="shadow-lg border-[#dfdfe2]">
      <CardContent className="pt-10 pb-8 text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="animate-spin mx-auto text-[#476e66]" size={32} />
            <p className="text-sm text-[#708a83]">Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 bg-[#f4f4f4] rounded-2xl flex items-center justify-center mx-auto border border-[#dfdfe2]">
              <CheckCircle2 className="text-[#476e66]" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Email verified!
              </h2>
              <p className="text-sm text-[#708a83] mt-1">
                Your email has been verified. You can now invite team members.
              </p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-[#476e66] hover:bg-indigo-700 text-white"
            >
              Go to dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="text-red-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Verification failed
              </h2>
              <p className="text-sm text-[#708a83] mt-1">{message}</p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full border-[#dfdfe2]">
                Back to dashboard
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card className="shadow-lg border-[#dfdfe2]">
          <CardContent className="pt-10 text-center">
            <Loader2 className="animate-spin mx-auto text-[#476e66]" size={24} />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}