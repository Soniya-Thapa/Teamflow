'use client';

/**
 * @file usage-card.tsx
 * @description Shows current plan usage with progress bars.
 * Shown on the dashboard and billing page.
 *
 * VISUAL STATES:
 *   < 80%  → teal progress bar (normal)
 *   80-99% → amber progress bar (warning)
 *   100%   → red progress bar + upgrade button
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Users, FolderOpen, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';

interface UsageData {
  plan: string;
  limits: {
    maxUsers: number;
    maxProjects: number;
    maxStorage: string;
  };
  usage: {
    currentUsers: number;
    currentProjects: number;
    currentStorage: string;
  };
}

function UsageBar({
  label,
  icon: Icon,
  current,
  max,
  formatValue,
}: {
  label: string;
  icon: any;
  current: number;
  max: number;
  formatValue?: (n: number) => string;
}) {
  const pct = max >= 9999 ? 5 : Math.min(Math.round((current / max) * 100), 100);
  const isUnlimited = max >= 9999;

  const barColor =
    pct >= 100
      ? 'bg-red-500'
      : pct >= 80
      ? 'bg-amber-500'
      : 'bg-[#476e66]';

  const fmt = formatValue ?? ((n: number) => n.toString());

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#708a83]">
          <Icon size={12} />
          {label}
        </span>
        <span className={pct >= 100 ? 'text-red-500 font-medium' : 'text-[#708a83]'}>
          {fmt(current)} / {isUnlimited ? '∞' : fmt(max)}
          {!isUnlimited && (
            <span className="ml-1 text-[#bec0bf]">({pct}%)</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-[#f4f4f4] dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${isUnlimited ? 5 : pct}%` }}
        />
      </div>
    </div>
  );
}

function formatStorage(bytes: string): string {
  const n = parseInt(bytes || '0');
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UsageCard() {
  const router = useRouter();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    api
      .get(`/organizations/${activeOrg.id}/billing/info`)
      .then((res) => setUsageData(res.data.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeOrg?.id]);

  if (isLoading || !usageData) return null;

  const userPct =
    usageData.limits.maxUsers >= 9999
      ? 0
      : (usageData.usage.currentUsers / usageData.limits.maxUsers) * 100;

  const projectPct =
    usageData.limits.maxProjects >= 9999
      ? 0
      : (usageData.usage.currentProjects / usageData.limits.maxProjects) * 100;

  const isNearLimit = userPct >= 80 || projectPct >= 80;
  const isAtLimit = userPct >= 100 || projectPct >= 100;

  return (
    <Card
      className={`border-[#dfdfe2] dark:border-slate-700 ${
        isAtLimit ? 'border-red-300 dark:border-red-800' : ''
      }`}
    >
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-[#708a83]" />
          <CardTitle className="text-sm font-semibold">Plan Usage</CardTitle>
        </div>
        <Badge
          className={`text-xs ${
            usageData.plan === 'FREE'
              ? 'bg-[#f4f4f4] text-[#708a83]'
              : usageData.plan === 'PRO'
              ? 'bg-[#476e66]/10 text-[#476e66]'
              : 'bg-purple-100 text-purple-600'
          }`}
        >
          {usageData.plan}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <UsageBar
          label="Members"
          icon={Users}
          current={usageData.usage.currentUsers}
          max={usageData.limits.maxUsers}
        />
        <UsageBar
          label="Projects"
          icon={FolderOpen}
          current={usageData.usage.currentProjects}
          max={usageData.limits.maxProjects}
        />
        <UsageBar
          label="Storage"
          icon={HardDrive}
          current={parseInt(usageData.usage.currentStorage || '0')}
          max={parseInt(usageData.limits.maxStorage || '0')}
          formatValue={(n) => formatStorage(n.toString())}
        />

        {(isNearLimit || isAtLimit) && (
          <div
            className={`rounded-lg p-3 mt-2 ${
              isAtLimit
                ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <p
              className={`text-xs font-medium mb-2 ${
                isAtLimit
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {isAtLimit
                ? '🚫 Plan limit reached — upgrade to continue'
                : '⚠️ Approaching your plan limits'}
            </p>
            <Button
              size="sm"
              onClick={() => router.push('/settings/billing')}
              className="w-full bg-[#476e66] hover:bg-[#3d6059] text-white text-xs h-7"
            >
              Upgrade plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}