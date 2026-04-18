'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Crown,
  Users,
  Plus,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/shared/modal';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { SkeletonTable } from '@/components/shared/skeleton';
import { TeamForm } from '../_components/team-form';
import { useOrgApi } from '@/hooks/use-org-api';
import { Team, TeamMember } from '@/types';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// ADD MEMBER MODAL
// ─────────────────────────────────────────

function AddMemberModal({
  orgId,
  teamId,
  existingMemberIds,
  onSuccess,
  onClose,
}: {
  orgId: string;
  teamId: string;
  existingMemberIds: string[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/members`)
      .then((res) => {
        const all = res.data.data.members || [];
        // Filter out already-added members
        setMembers(
          all.filter((m: any) => !existingMemberIds.includes(m.user?.id)),
        );
      })
      .catch(() => {});
  }, [orgId, existingMemberIds]);

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setIsLoading(true);
    setApiError('');
    try {
      await api.post(`/organizations/${orgId}/teams/${teamId}/members`, {
        userId: selectedUserId,
        role,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal title="Add team member" onClose={onClose} size="sm">
      <div className="space-y-4 mt-2">
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{apiError}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Member
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Select a member</option>
            {members.map((m) => (
              <option key={m.user?.id} value={m.user?.id}>
                {m.user?.firstName} {m.user?.lastName} ({m.user?.email})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="TEAM_LEAD">Team Lead</option>
            <option value="MEMBER">Member</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-[#dfdfe2]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedUserId || isLoading}
            className="flex-1 bg-[#476e66] hover:bg-[#3d6059] text-white"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add member'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId, buildUrl } = useOrgApi();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const [teamRes, projectsRes] = await Promise.all([
        api.get(`/organizations/${orgId}/teams/${teamId}`),
        api.get(`/organizations/${orgId}/projects`),
      ]);

      const t = teamRes.data.data.team;
      setTeam(t);
      setMembers(t.members || []);

      // Filter projects belonging to this team
      const allProjects = projectsRes.data.data.projects || [];
      setProjects(allProjects.filter((p: any) => p.teamId === teamId));
    } catch {
      router.push('/teams');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRemoveMember = async () => {
    if (!removeMember || !orgId) return;
    setIsRemoving(true);
    try {
      await api.delete(
        `/organizations/${orgId}/teams/${teamId}/members/${removeMember.id}`,
      );
      setRemoveMember(null);
      fetchTeam();
    } catch {
      // handle error
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, newRole: string) => {
    if (!orgId) return;
    try {
      await api.patch(
        `/organizations/${orgId}/teams/${teamId}/members/${member.id}`,
        { role: newRole },
      );
      fetchTeam();
    } catch {
      // handle error
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <SkeletonTable rows={4} />
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/teams')}
        className="inline-flex items-center gap-1.5 text-sm text-[#708a83] hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Back to teams
      </button>

      {/* Team Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#476e66]/10 dark:bg-[#476e66]/20 rounded-2xl flex items-center justify-center">
            <Users size={22} className="text-[#476e66]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {team.name}
            </h1>
            {team.description && (
              <p className="text-sm text-[#708a83] mt-0.5">{team.description}</p>
            )}
            {team.leader && (
              <div className="flex items-center gap-1.5 mt-1">
                <Crown size={12} className="text-amber-500" />
                <span className="text-xs text-[#708a83]">
                  Led by {team.leader.firstName} {team.leader.lastName}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={() => setShowEdit(true)}
          variant="outline"
          size="sm"
          className="border-[#dfdfe2]"
        >
          <Pencil size={13} className="mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Members */}
      <Card className="border-[#dfdfe2] dark:border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Members ({members.length})
          </CardTitle>
          <Button
            onClick={() => setShowAddMember(true)}
            size="sm"
            className="bg-[#476e66] hover:bg-[#3d6059] text-white h-7 text-xs"
          >
            <Plus size={12} className="mr-1" />
            Add member
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {members.length === 0 ? (
            <p className="text-sm text-[#708a83] text-center py-6">
              No members yet. Add your first team member.
            </p>
          ) : (
            <div className="divide-y divide-[#f4f4f4] dark:divide-slate-800">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 py-3"
                >
                  <UserAvatar user={member.user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-xs text-[#708a83]">{member.user.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.role === 'TEAM_LEAD' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Crown size={10} />
                        Lead
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f4f4f4] text-[#708a83] dark:bg-slate-800">
                        <Shield size={10} />
                        Member
                      </span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-[#f4f4f4] dark:hover:bg-slate-800">
                          <MoreHorizontal size={13} className="text-[#708a83]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === 'MEMBER' ? (
                          <DropdownMenuItem
                            onClick={() =>
                              handleRoleChange(member, 'TEAM_LEAD')
                            }
                          >
                            <Crown size={12} className="mr-2" />
                            Make Team Lead
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member, 'MEMBER')}
                          >
                            <Shield size={12} className="mr-2" />
                            Make Member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setRemoveMember(member)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 size={12} className="mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Projects */}
      <Card className="border-[#dfdfe2] dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {projects.length === 0 ? (
            <p className="text-sm text-[#708a83] text-center py-6">
              No projects assigned to this team.
            </p>
          ) : (
            <div className="divide-y divide-[#f4f4f4] dark:divide-slate-800">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 py-3 cursor-pointer hover:bg-[#f4f4f4]/50 dark:hover:bg-slate-800/50 rounded-lg px-2 -mx-2 transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="w-7 h-7 bg-[#f4f4f4] dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <FolderOpen size={13} className="text-[#708a83]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-[#708a83]">
                      {project._count?.tasks ?? 0} tasks
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showEdit && (
        <Modal title="Edit team" onClose={() => setShowEdit(false)}>
          <TeamForm
            orgId={orgId!}
            team={team}
            onSuccess={() => {
              setShowEdit(false);
              fetchTeam();
            }}
            onCancel={() => setShowEdit(false)}
          />
        </Modal>
      )}

      {showAddMember && (
        <AddMemberModal
          orgId={orgId!}
          teamId={teamId}
          existingMemberIds={members.map((m) => m.userId)}
          onSuccess={fetchTeam}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {removeMember && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${removeMember.user.firstName} ${removeMember.user.lastName} from this team?`}
          confirmLabel="Remove"
          isLoading={isRemoving}
          onConfirm={handleRemoveMember}
          onCancel={() => setRemoveMember(null)}
        />
      )}
    </div>
  );
}