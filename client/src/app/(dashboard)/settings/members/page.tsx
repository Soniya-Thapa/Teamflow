'use client';

/**
 * @file settings/members/page.tsx
 * @description Organization members management page.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Loader2,
  MoreHorizontal,
  Crown,
  Shield,
  User,
  Eye,
  Trash2,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppSelector } from '@/hooks/redux.hooks';
import { SkeletonTable } from '@/components/shared/skeleton';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; icon: any; className: string }> = {
    OWNER: {
      label: 'Owner',
      icon: Crown,
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    ADMIN: {
      label: 'Admin',
      icon: Shield,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    MEMBER: {
      label: 'Member',
      icon: User,
      className: 'bg-slate-100 text-slate-700 dark:bg-indigo-50 dark:text-slate-300',
    },
    GUEST: {
      label: 'Guest',
      icon: Eye,
      className: 'bg-slate-100 text-gray-600 dark:bg-indigo-50 dark:text-slate-400',
    },
  };

  const c = config[role] || config.MEMBER;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      <c.icon size={10} />
      {c.label}
    </span>
  );
}

// ─────────────────────────────────────────
// INVITE MODAL
// ─────────────────────────────────────────

function InviteModal({
  orgId,
  onClose,
  onSuccess,
}: {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async () => {
    if (!email) return;
    setIsLoading(true);
    setError('');

    try {
      await api.post(`/organizations/${orgId}/invitations`, { email, role });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-indigo-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Invite team member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Email address</Label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="GUEST">Guest</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              disabled={!email || isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Mail size={14} className="mr-2" />Send invite</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function MembersSettingsPage() {
  const { activeOrg } = useAppSelector((state) => state.organization);
  const { user } = useAppSelector((state) => state.auth);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isOwnerOrAdmin =
    members.find((m) => m.user?.id === user?.id)?.role === 'OWNER' ||
    members.find((m) => m.user?.id === user?.id)?.role === 'ADMIN';

  const fetchMembers = async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/organizations/${activeOrg.id}/members`);
      setMembers(response.data.data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeOrg?.id]);

  const handleRemove = async (memberId: string) => {
    if (!activeOrg) return;
    try {
      await api.delete(`/organizations/${activeOrg.id}/members/${memberId}`);
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!activeOrg) return;
    try {
      await api.patch(
        `/organizations/${activeOrg.id}/members/${memberId}/role`,
        { role: newRole },
      );
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update role');
    }
  };

  if (!activeOrg) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Members
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1 text-sm">
            {members.length} of {activeOrg.maxUsers} seats used
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <UserPlus size={16} className="mr-2" />
            Invite member
          </Button>
        )}
      </div>

      {/* Members List */}
      <Card className="border-indigo-200 dark:border-indigo-200">
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="pt-4">
              <SkeletonTable rows={3} />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600 text-sm">No members found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => {
                const initials = member.user
                  ? `${member.user.firstName?.[0] || ''}${member.user.lastName?.[0] || ''}`.toUpperCase()
                  : '??';
                const isCurrentUser = member.user?.id === user?.id;
                const isOwner = member.role === 'OWNER';

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-3 px-1"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {member.user?.firstName} {member.user?.lastName}
                          {isCurrentUser && (
                            <span className="text-slate-400 font-normal ml-1">
                              (you)
                            </span>
                          )}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                        {member.user?.email}
                      </p>
                    </div>

                    {/* Actions */}
                    {isOwnerOrAdmin && !isCurrentUser && !isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member.id, 'ADMIN')}
                            disabled={member.role === 'ADMIN'}
                          >
                            <Shield size={12} className="mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member.id, 'MEMBER')}
                            disabled={member.role === 'MEMBER'}
                          >
                            <User size={12} className="mr-2" />
                            Make Member
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member.id, 'GUEST')}
                            disabled={member.role === 'GUEST'}
                          >
                            <Eye size={12} className="mr-2" />
                            Make Guest
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRemove(member.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 size={12} className="mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          orgId={activeOrg.id}
          onClose={() => setShowInviteModal(false)}
          onSuccess={fetchMembers}
        />
      )}
    </div>
  );
}