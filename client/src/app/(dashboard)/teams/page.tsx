'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Crown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { SkeletonCard } from '@/components/shared/skeleton';
import { useOrgApi } from '@/hooks/use-org-api';
import { Team } from '@/types';
import { TeamForm } from './_components/team-form';

// ─────────────────────────────────────────
// TEAM CARD
// ─────────────────────────────────────────

function TeamCard({
  team,
  onEdit,
  onDelete,
  onClick,
}: {
  team: Team;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
  onClick: (team: Team) => void;
}) {
  return (
    <Card
      className="border-[#dfdfe2] dark:border-slate-700 hover:shadow-md hover:border-[#708a83] transition-all duration-200 cursor-pointer group"
      onClick={() => onClick(team)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-[#476e66]/10 dark:bg-[#476e66]/20 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-[#476e66]" />
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#f4f4f4] dark:hover:bg-slate-800 transition-all"
              >
                <MoreHorizontal size={14} className="text-[#708a83]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(team);
                }}
              >
                <Pencil size={12} className="mr-2" />
                Edit team
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(team);
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 size={12} className="mr-2" />
                Delete team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-white mb-1 truncate">
          {team.name}
        </h3>

        {team.description && (
          <p className="text-xs text-[#708a83] line-clamp-2 mb-3">
            {team.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#f4f4f4] dark:border-slate-800">
          {team.leader ? (
            <div className="flex items-center gap-1.5">
              <Crown size={11} className="text-amber-500" />
              <span className="text-xs text-[#708a83]">
                {team.leader.firstName} {team.leader.lastName}
              </span>
            </div>
          ) : (
            <span className="text-xs text-[#bec0bf]">No leader</span>
          )}

          <div className="flex items-center gap-1">
            <Users size={11} className="text-[#bec0bf]" />
            <span className="text-xs text-[#708a83]">
              {team._count?.members ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function TeamsPage() {
  const router = useRouter();
  const { orgId, buildUrl, api } = useOrgApi();

  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const res = await api.get(buildUrl('/teams'));
      setTeams(res.data.data.teams || []);
    } catch {
      setTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleDelete = async () => {
    if (!deleteTeam) return;
    setIsDeleting(true);
    try {
      await api.delete(buildUrl(`/teams/${deleteTeam.id}`));
      setDeleteTeam(null);
      fetchTeams();
    } catch {
      // handle error
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Teams
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            {teams.length} team{teams.length !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#476e66] hover:bg-[#3d6059] text-white"
        >
          <Plus size={16} className="mr-2" />
          New team
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bec0bf]"
        />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-[#dfdfe2] bg-[#fefefe]"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-[#f4f4f4] dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-[#bec0bf]" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {search ? 'No teams match your search' : 'No teams yet'}
          </p>
          <p className="text-sm text-[#708a83] mt-1">
            {!search && 'Create your first team to get started'}
          </p>
          {!search && (
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 bg-[#476e66] hover:bg-[#3d6059] text-white"
            >
              <Plus size={14} className="mr-2" />
              Create team
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={setEditTeam}
              onDelete={setDeleteTeam}
              onClick={(t) => router.push(`/teams/${t.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal
          title="Create team"
          description="Set up a new team for your organization"
          onClose={() => setShowCreate(false)}
        >
          <TeamForm
            orgId={orgId!}
            onSuccess={() => {
              setShowCreate(false);
              fetchTeams();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTeam && (
        <Modal
          title="Edit team"
          description="Update team details"
          onClose={() => setEditTeam(null)}
        >
          <TeamForm
            orgId={orgId!}
            team={editTeam}
            onSuccess={() => {
              setEditTeam(null);
              fetchTeams();
            }}
            onCancel={() => setEditTeam(null)}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTeam && (
        <ConfirmDialog
          title={`Delete "${deleteTeam.name}"`}
          message="This will permanently remove the team and all its members. Projects assigned to this team will be unlinked."
          confirmLabel="Delete team"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTeam(null)}
        />
      )}
    </div>
  );
}