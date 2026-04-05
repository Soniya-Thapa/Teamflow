'use client';

/**
 * @file verification-banner.tsx
 * @description Shows when user email is not verified.
 * Gates invitation sending behind verification.
 * Dismissed once email is verified.
 */

import { useState } from 'react';
import { Mail, X, Loader2 } from 'lucide-react';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';

export function VerificationBanner() {
  const { user } = useAppSelector((state) => state.auth);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already verified or dismissed
  if (!user || user.isEmailVerified || dismissed) return null;

  const handleResend = async () => {
    setIsSending(true);
    try {
      await api.post('/auth/send-verification');
      setSent(true);
    } catch {
      // silent
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 flex items-center gap-3">
      <Mail size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />

      <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
        <strong>Verify your email</strong> to invite team members.
        {!sent ? (
          <>
            {' '}
            <button
              onClick={handleResend}
              disabled={isSending}
              className="underline hover:no-underline font-medium disabled:opacity-50"
            >
              {isSending ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  Sending...
                </span>
              ) : (
                'Resend verification email'
              )}
            </button>
          </>
        ) : (
          <span className="text-green-600 dark:text-green-400 ml-1 font-medium">
            ✓ Email sent — check your inbox
          </span>
        )}
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors ml-auto shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}