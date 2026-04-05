'use client';

/**
 * @file settings/organization/page.tsx
 * @description Organization settings — General, Branding, Danger zone.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/hooks/redux.hooks';
import { setActiveOrg, fetchUserOrganizations, clearOrganization } from '@/store/slices/organization.slice';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// TABS
// ─────────────────────────────────────────

type Tab = 'general' | 'branding' | 'danger';

const tabs: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'branding', label: 'Branding' },
  { key: 'danger', label: 'Danger Zone' },
];

// ─────────────────────────────────────────
// GENERAL TAB
// ─────────────────────────────────────────

const generalSchema = z.object({
  name: z.string().min(2).max(100),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

function GeneralTab() {
  const dispatch = useAppDispatch();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: activeOrg?.name || '',
      logo: activeOrg?.logo || '',
    },
  });

  const onSubmit = async (data: any) => {
    if (!activeOrg) return;
    setIsLoading(true);
    setApiError('');
    setSuccess(false);

    try {
      const response = await api.patch(`/organizations/${activeOrg.id}`, {
        name: data.name,
        logo: data.logo || null,
      });

      dispatch(setActiveOrg(response.data.data));
      dispatch(fetchUserOrganizations());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm text-green-600 dark:text-green-400">
            Organization updated successfully
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Organization name</Label>
        <Input {...register('name')} className={errors.name ? 'border-red-500' : ''} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
      </div>

      <div className="space-y-2">
        <Label>
          Slug{' '}
          <span className="text-slate-400 font-normal text-xs">(cannot be changed)</span>
        </Label>
        <Input value={activeOrg?.slug || ''} disabled className="bg-slate-50 dark:bg-indigo-50" />
        <p className="text-xs text-slate-400">Slug is permanent after creation.</p>
      </div>

      <div className="space-y-2">
        <Label>Logo URL <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
        <Input
          type="url"
          placeholder="https://example.com/logo.png"
          {...register('logo')}
          className={errors.logo ? 'border-red-500' : ''}
        />
        {errors.logo && <p className="text-xs text-red-500">{errors.logo.message as string}</p>}
      </div>

      <Button
        type="submit"
        className="bg-indigo-600 hover:bg-indigo-700"
        disabled={isLoading}
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
        ) : (
          <><Save size={14} className="mr-2" />Save changes</>
        )}
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────
// BRANDING TAB
// ─────────────────────────────────────────

function BrandingTab() {
  const dispatch = useAppDispatch();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!activeOrg) return;
    setIsLoading(true);

    try {
      await api.patch(`/organizations/${activeOrg.id}/settings`, {
        primaryColor,
        accentColor,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-600 dark:text-green-400">Branding updated</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Primary color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-indigo-200 dark:border-slate-700 cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#6366f1"
              className="w-32 font-mono text-sm"
            />
            <div
              className="w-10 h-10 rounded-lg border border-indigo-200"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Accent color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-indigo-200 dark:border-slate-700 cursor-pointer"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#8b5cf6"
              className="w-32 font-mono text-sm"
            />
            <div
              className="w-10 h-10 rounded-lg border border-indigo-200"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        className="bg-indigo-600 hover:bg-indigo-700"
        disabled={isLoading}
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
        ) : (
          <><Save size={14} className="mr-2" />Save branding</>
        )}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────
// DANGER ZONE TAB
// ─────────────────────────────────────────

function DangerZoneTab() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { activeOrg } = useAppSelector((state) => state.organization);
  const { user } = useAppSelector((state) => state.auth);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isOwner = activeOrg?.ownerId === user?.id;

  const handleDelete = async () => {
    if (!activeOrg || confirmDelete !== activeOrg.slug) return;
    setIsLoading(true);

    try {
      await api.delete(`/organizations/${activeOrg.id}`);
      dispatch(clearOrganization());
      router.push('/dashboard');
    } catch {
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-slate-50 dark:bg-indigo-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          Only the organization owner can access the danger zone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200 text-sm">
              Delete organization
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              This action is permanent. All projects, tasks, and members will be deleted.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-red-700 dark:text-red-300">
            Type <strong>{activeOrg?.slug}</strong> to confirm
          </Label>
          <Input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder={activeOrg?.slug}
            className="border-red-300 dark:border-red-700 focus-visible:ring-red-500"
          />
        </div>

        <Button
          onClick={handleDelete}
          variant="destructive"
          disabled={confirmDelete !== activeOrg?.slug || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
          ) : (
            <><Trash2 size={14} className="mr-2" />Delete organization</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function OrganizationSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const { activeOrg } = useAppSelector((state) => state.organization);

  if (!activeOrg) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Organization settings
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mt-1 text-sm">
          Manage {activeOrg.name}
        </p>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-200">
        {/* Tab Headers */}
        <div className="flex border-b border-indigo-200 dark:border-indigo-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-600 hover:text-slate-900 dark:hover:text-white'
              } ${tab.key === 'danger' ? 'text-red-500 hover:text-red-600' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <CardContent className="pt-6">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'branding' && <BrandingTab />}
          {activeTab === 'danger' && <DangerZoneTab />}
        </CardContent>
      </Card>
    </div>
  );
}