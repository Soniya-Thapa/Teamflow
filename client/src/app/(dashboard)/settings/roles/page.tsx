'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/shared/modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SkeletonTable } from '@/components/shared/skeleton';
import { useAppSelector } from '@/hooks/redux.hooks';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// CREATE ROLE MODAL
// ─────────────────────────────────────────

function CreateRoleModal({
  orgId,
  permissions,
  onSuccess,
  onClose,
}: {
  orgId: string;
  permissions: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Group permissions by resource
  const grouped = permissions.reduce(
    (acc: Record<string, any[]>, perm: any) => {
      if (!acc[perm.resource]) acc[perm.resource] = [];
      acc[perm.resource].push(perm);
      return acc;
    },
    {},
  );

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleGroup = (resource: string) => {
    const groupPerms = grouped[resource].map((p: any) => p.id);
    const allSelected = groupPerms.every((id: string) =>
      selectedPerms.includes(id),
    );
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((id) => !groupPerms.includes(id)));
    } else {
      setSelectedPerms((prev) => [...new Set([...prev, ...groupPerms])]);
    }
  };

  const handleCreate = async () => {
    if (!name || !displayName) return;
    setIsLoading(true);
    setApiError('');
    try {
      const res = await api.post(`/organizations/${orgId}/roles`, {
        name,
        displayName,
        permissionIds: selectedPerms,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to create role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal title="Create custom role" onClose={onClose} size="lg">
      <div className="space-y-5 mt-2">
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{apiError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Role name</Label>
            <Input
              placeholder="PROJECT_MANAGER"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase().replace(/\s/g, '_'))}
              className="border-[#dfdfe2] font-mono text-sm"
            />
            <p className="text-xs text-[#bec0bf]">Uppercase, no spaces</p>
          </div>
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              placeholder="Project Manager"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border-[#dfdfe2]"
            />
          </div>
        </div>

        {/* Permissions */}
        <div>
          <Label>Permissions ({selectedPerms.length} selected)</Label>
          <div className="mt-2 border border-[#dfdfe2] dark:border-slate-700 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {Object.entries(grouped).map(([resource, perms]) => {
              const isExpanded = expandedGroups.includes(resource);
              const groupSelected = (perms as any[]).filter((p) =>
                selectedPerms.includes(p.id),
              ).length;

              return (
                <div
                  key={resource}
                  className="border-b border-[#f4f4f4] dark:border-slate-800 last:border-0"
                >
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#fafafa] dark:bg-slate-800/50">
                    <button
                      onClick={() =>
                        setExpandedGroups((prev) =>
                          prev.includes(resource)
                            ? prev.filter((r) => r !== resource)
                            : [...prev, resource],
                        )
                      }
                      className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white capitalize"
                    >
                      {isExpanded ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      {resource}
                      <span className="text-xs text-[#708a83] font-normal">
                        ({groupSelected}/{(perms as any[]).length})
                      </span>
                    </button>
                    <button
                      onClick={() => toggleGroup(resource)}
                      className="text-xs text-[#476e66] hover:underline"
                    >
                      {groupSelected === (perms as any[]).length
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 py-2 space-y-1.5 bg-white dark:bg-slate-900">
                      {(perms as any[]).map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2.5 cursor-pointer"
                        >
                          <div
                            onClick={() => togglePerm(perm.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedPerms.includes(perm.id)
                                ? 'bg-[#476e66] border-[#476e66]'
                                : 'border-[#dfdfe2] dark:border-slate-600'
                            }`}
                          >
                            {selectedPerms.includes(perm.id) && (
                              <Check size={10} className="text-white" />
                            )}
                          </div>
                          <span className="text-xs text-slate-700 dark:text-slate-300">
                            {perm.displayName}
                          </span>
                          <code className="text-[10px] text-[#bec0bf] ml-auto">
                            {perm.name}
                          </code>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-[#dfdfe2]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name || !displayName || isLoading}
            className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create role'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function RolesSettingsPage() {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteRole, setDeleteRole] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get(`/organizations/${activeOrg.id}/roles`),
        api.get(`/organizations/${activeOrg.id}/roles/permissions`),
      ]);
      setRoles(rolesRes.data.data.roles || []);
      setPermissions(permsRes.data.data.permissions || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrg?.id]);

  const handleDelete = async () => {
    if (!activeOrg || !deleteRole) return;
    setIsDeleting(true);
    try {
      await api.delete(
        `/organizations/${activeOrg.id}/roles/${deleteRole.id}`,
      );
      setDeleteRole(null);
      fetchData();
    } catch {
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Roles & Permissions
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            Manage custom roles for your organization
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#476e66] hover:bg-[#3d6059] text-white"
        >
          <Plus size={16} className="mr-2" />
          New role
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : (
        <Card className="border-[#dfdfe2] dark:border-slate-700">
          <CardContent className="pt-0">
            <div className="divide-y divide-[#f4f4f4] dark:divide-slate-800">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-3 py-3.5 px-1"
                >
                  <div className="w-8 h-8 bg-[#476e66]/10 dark:bg-[#476e66]/20 rounded-lg flex items-center justify-center">
                    <Shield size={14} className="text-[#476e66]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {role.displayName}
                    </p>
                    <p className="text-xs text-[#708a83] font-mono">
                      {role.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {role.isSystem && (
                      <span className="text-xs text-[#708a83] bg-[#f4f4f4] dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        System
                      </span>
                    )}
                    {!role.isSystem && (
                      <button
                        onClick={() => setDeleteRole(role)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-[#bec0bf] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {roles.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-[#708a83]">No custom roles yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <CreateRoleModal
          orgId={activeOrg!.id}
          permissions={permissions}
          onSuccess={fetchData}
          onClose={() => setShowCreate(false)}
        />
      )}

      {deleteRole && (
        <ConfirmDialog
          title={`Delete "${deleteRole.displayName}"`}
          message="This will permanently delete the role. Members assigned this role will lose these permissions."
          confirmLabel="Delete role"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteRole(null)}
        />
      )}
    </div>
  );
}