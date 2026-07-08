'use client';

/**
 * @file upgrade-prompt.tsx
 * @description Modal shown when a user hits a quota limit.
 *
 * Triggered by:
 * 1. API returns 403 with code: 'QUOTA_EXCEEDED'
 * 2. Axios interceptor detects this and dispatches showUpgradePrompt
 *
 * Shows the specific resource that hit the limit and routes to billing.
 */

import { useRouter } from 'next/navigation';
import { TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpgradePromptProps {
  resource: string;
  current: number;
  max: number;
  plan: string;
  upgradeMessage: string;
  onClose: () => void;
}

export function UpgradePrompt({
  resource,
  current,
  max,
  plan,
  upgradeMessage,
  onClose,
}: UpgradePromptProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-[#fefefe] dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#dfdfe2] dark:border-slate-700 p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#f4f4f4] text-[#708a83]"
        >
          <X size={14} />
        </button>

        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-2xl flex items-center justify-center">
          <TrendingUp size={22} className="text-amber-500" />
        </div>

        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">
            Plan limit reached
          </h3>
          <p className="text-sm text-[#708a83] mt-1">
            You&apos;ve used {current} of {max}{' '}
            {resource === 'users' ? 'team members' : resource} on your{' '}
            <strong>{plan}</strong> plan.
          </p>
          <p className="text-sm text-[#476e66] mt-2 font-medium">
            {upgradeMessage}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-[#dfdfe2]"
          >
            Maybe later
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push('/settings/billing');
            }}
            className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            Upgrade plan
          </Button>
        </div>
      </div>
    </div>
  );
}