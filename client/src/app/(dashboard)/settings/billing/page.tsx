'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap, Building2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/hooks/redux.hooks';
import { SkeletonCard } from '@/components/shared/skeleton';
import api from '@/lib/axios';
import { Suspense } from 'react';

// ─────────────────────────────────────────
// PLAN CONFIG
// ─────────────────────────────────────────

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    description: 'For small teams getting started',
    icon: Star,
    color: 'text-slate-600',
    features: [
      'Up to 5 members',
      '3 projects',
      '1GB storage',
      'Basic notifications',
      'Email support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 12,
    description: 'For growing teams',
    icon: Zap,
    color: 'text-[#476e66]',
    popular: true,
    features: [
      'Up to 25 members',
      'Unlimited projects',
      '10GB storage',
      'Real-time notifications',
      'Priority support',
      'Custom roles',
      'File attachments',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 49,
    description: 'For large organizations',
    icon: Building2,
    color: 'text-purple-600',
    features: [
      'Unlimited members',
      'Unlimited projects',
      '100GB storage',
      'Everything in Pro',
      'Dedicated support',
      'SSO (coming soon)',
      'Audit logs',
    ],
  },
];

// ─────────────────────────────────────────
// BILLING CONTENT
// ─────────────────────────────────────────

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (!activeOrg) return;
    api
      .get(`/organizations/${activeOrg.id}/billing/info`)
      .then((res) => setBillingInfo(res.data.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeOrg?.id]);

  const handleUpgrade = async (planId: string) => {
    if (!activeOrg || planId === 'FREE') return;
    setCheckoutLoading(planId);
    try {
      const res = await api.post(
        `/organizations/${activeOrg.id}/billing/checkout`,
        { plan: planId },
      );
      // Redirect to Stripe Checkout
      window.location.href = res.data.data.checkoutUrl;
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to start checkout');
      setCheckoutLoading(null);
    }
  };

  const currentPlan = billingInfo?.plan || activeOrg?.plan || 'FREE';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-[#708a83] mt-0.5">
          Manage your subscription and usage
        </p>
      </div>

      {/* Success / Cancel banners */}
      {success && (
        <div className="bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            🎉 Payment successful! Your plan has been upgraded.
          </p>
        </div>
      )}
      {cancelled && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Payment cancelled. Your plan was not changed.
          </p>
        </div>
      )}

      {/* Current Usage */}
      {billingInfo && (
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: 'Members',
                used: billingInfo.usage.currentUsers,
                max: billingInfo.limits.maxUsers,
              },
              {
                label: 'Projects',
                used: billingInfo.usage.currentProjects,
                max: billingInfo.limits.maxProjects,
              },
            ].map((item) => {
              const pct = item.max >= 9999 ? 5 : Math.round((item.used / item.max) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-[#708a83] mb-1.5">
                    <span>{item.label}</span>
                    <span>
                      {item.used} / {item.max >= 9999 ? '∞' : item.max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#f4f4f4] dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 80 ? 'bg-red-500' : 'bg-[#476e66]'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade =
            (currentPlan === 'ENTERPRISE' && plan.id !== 'ENTERPRISE') ||
            (currentPlan === 'PRO' && plan.id === 'FREE');

          return (
            <Card
              key={plan.id}
              className={`border-2 transition-all ${
                isCurrent
                  ? 'border-[#476e66]'
                  : plan.popular
                  ? 'border-[#476e66]/30'
                  : 'border-[#dfdfe2] dark:border-slate-700'
              } ${plan.popular ? 'shadow-md' : ''}`}
            >
              <CardContent className="pt-6 pb-5 space-y-4">
                {/* Plan header */}
                <div>
                  {plan.popular && (
                    <span className="text-xs font-semibold text-[#476e66] bg-[#476e66]/10 px-2 py-0.5 rounded-full mb-2 inline-block">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <plan.icon size={18} className={plan.color} />
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <Badge className="text-xs bg-[#476e66] text-white">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#708a83]">{plan.description}</p>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-[#708a83]">/mo</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check size={12} className="text-[#476e66] shrink-0" />
                      <span className="text-xs text-[#708a83]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || isDowngrade || plan.id === 'FREE' || !!checkoutLoading}
                  className={`w-full ${
                    isCurrent
                      ? 'bg-[#f4f4f4] text-[#708a83] cursor-default'
                      : plan.id === 'FREE'
                      ? 'bg-[#f4f4f4] text-[#708a83] cursor-default'
                      : 'bg-[#476e66] hover:bg-[#3d6059] text-white'
                  }`}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current plan'
                  ) : isDowngrade ? (
                    'Downgrade (contact support)'
                  ) : plan.id === 'FREE' ? (
                    'Free forever'
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Test mode notice */}
      <p className="text-xs text-[#bec0bf] text-center">
        Stripe is in test mode. Use card number{' '}
        <code className="font-mono">4242 4242 4242 4242</code> for testing.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}>
      <BillingContent />
    </Suspense>
  );
}