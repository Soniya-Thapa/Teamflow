'use client';

/**
 * @file onboarding-checklist.tsx
 * @description Step-by-step onboarding guide shown on first login.
 * Appears on dashboard when isOnboarded is false.
 */

import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';

const steps = [
  { step: 0, label: 'Create your organization', href: '/organizations/new' },
  { step: 1, label: 'Complete your profile', href: '/settings/profile' },
  { step: 2, label: 'Invite your first team member', href: '/settings/members' },
  { step: 3, label: 'Create your first project', href: '/projects' },
  { step: 4, label: 'Create your first task', href: '/tasks' },
];

interface Props {
  currentStep: number;
  isOnboarded: boolean;
  onDismiss: () => void;
}

export function OnboardingChecklist({ currentStep, isOnboarded, onDismiss }: Props) {
  const router = useRouter();
  const { activeOrg } = useAppSelector((state) => state.organization);

  if (isOnboarded) return null;

  const completedCount = steps.filter((s) => s.step < currentStep).length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <Card className="border-[#dfdfe2] dark:border-indigo-900 bg-[#f4f4f4]/50 dark:bg-indigo-950/20">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base text-indigo-900 dark:text-indigo-200">
            🚀 Get started with TeamFlow
          </CardTitle>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <X size={16} />
        </button>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#f4f4f4]0 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((s) => {
            const isComplete = s.step < currentStep;
            const isCurrent = s.step === currentStep;

            return (
              <button
                key={s.step}
                onClick={() => router.push(s.href)}
                disabled={isComplete}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isCurrent
                    ? 'bg-white dark:bg-slate-900 shadow-sm border border-[#dfdfe2] dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium'
                    : isComplete
                    ? 'text-slate-400 dark:text-gray-600 cursor-default'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : (
                  <Circle
                    size={16}
                    className={`shrink-0 ${
                      isCurrent
                        ? 'text-indigo-500'
                        : 'text-slate-300 dark:text-gray-600'
                    }`}
                  />
                )}
                {s.label}
                {isCurrent && (
                  <span className="ml-auto text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    Next
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}