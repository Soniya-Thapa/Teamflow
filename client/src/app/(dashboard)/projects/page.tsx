'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Plus,
  Search,
  Star,
  StarOff,
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  Lock,
  Globe,
  CheckSquare,
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
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { SkeletonCard } from '@/components/shared/skeleton';
import { useOrgApi } from '@/hooks/use-org-api';
import { Project } from '@/types';
import { ProjectForm } from './_components/project-form';

// ─────────────────────────────────────────
// PROJECT CARD
// ─────────────────────────────────────────

function ProjectCard({
  project,
  onEdit,
  onArchive,
  onDelete,
  onFavorite,
  onClick,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onArchive: (p: Project) => void;
  onDelete: (p: Project) => void;
  onFavorite: (p: Project) => void;
  onClick: (p: Project) => void;
}) {
  return (
    <Card
      className="border-[#dfdfe2] dark:border-slate-700 hover:shadow-md hover:border-[#708a83] transition-all duration-200 cursor-pointer group"
      onClick={() => onClick(project)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#476e66]/10 dark:bg-[#476e66]/20 rounded-xl flex items-center justify-center">
              <FolderOpen size={15} className="text-[#476e66]" />
            </div>
            {project.visibility === 'PRIVATE' && (
              <Lock size={12} className="text-[#bec0bf]" />
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Favorite star */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(project);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                project.isFavorite
                  ? 'text-amber-400'
                  : 'opacity-0 group-hover:opacity-100 text-[#bec0bf] hover:text-amber-400'
              }`}
            >
              {project.isFavorite ? (
                <Star size={13} fill="currentColor" />
              ) : (
                <StarOff size={13} />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#f4f4f4] dark:hover:bg-slate-800 transition-all"
                >
                  <MoreHorizontal size={13} className="text-[#708a83]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                >
                  <Pencil size={12} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                {project.status !== 'ARCHIVED' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(project);
                    }}
                  >
                    <Archive size={12} className="mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 size={12} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-white mb-1 truncate">
          {project.name}
        </h3>

        {project.description && (
          <p className="text-xs text-[#708a83] line-clamp-2 mb-3">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#f4f4f4] dark:border-slate-800">
          <ProjectStatusBadge status={project.status} />
          <div className="flex items-center gap-1 text-xs text-[#708a83]">
            <CheckSquare size={11} className="text-[#bec0bf]" />
            {project._count?.tasks ?? 0} tasks
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter();
  const { orgId, buildUrl, api } = useOrgApi();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(buildUrl(`/projects?${params}`));
      setProjects(res.data.data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleFavorite = async (project: Project) => {
    try {
      await api.post(buildUrl(`/projects/${project.id}/favorite`));
      fetchProjects();
    } catch {}
  };

  const handleArchive = async (project: Project) => {
    try {
      await api.patch(buildUrl(`/projects/${project.id}/archive`));
      fetchProjects();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteProject) return;
    setIsDeleting(true);
    try {
      await api.delete(buildUrl(`/projects/${deleteProject.id}`));
      setDeleteProject(null);
      fetchProjects();
    } catch {
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const statuses = ['ACTIVE', 'ARCHIVED', 'COMPLETED'];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-[#708a83] mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#476e66] hover:bg-[#3d6059] text-white"
        >
          <Plus size={16} className="mr-2" />
          New project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bec0bf]"
          />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-56 border-[#dfdfe2] bg-[#fefefe]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !statusFilter
                ? 'bg-[#476e66] text-white'
                : 'bg-[#f4f4f4] text-[#708a83] hover:bg-[#dfdfe2]'
            }`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#476e66] text-white'
                  : 'bg-[#f4f4f4] text-[#708a83] hover:bg-[#dfdfe2]'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
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
            <FolderOpen size={24} className="text-[#bec0bf]" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {search || statusFilter ? 'No projects match' : 'No projects yet'}
          </p>
          {!search && !statusFilter && (
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 bg-[#476e66] hover:bg-[#3d6059] text-white"
            >
              <Plus size={14} className="mr-2" />
              Create project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={setEditProject}
              onArchive={handleArchive}
              onDelete={setDeleteProject}
              onFavorite={handleFavorite}
              onClick={(p) => router.push(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <Modal
          title="Create project"
          description="Set up a new project for your team"
          onClose={() => setShowCreate(false)}
        >
          <ProjectForm
            orgId={orgId!}
            onSuccess={() => {
              setShowCreate(false);
              fetchProjects();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editProject && (
        <Modal
          title="Edit project"
          onClose={() => setEditProject(null)}
        >
          <ProjectForm
            orgId={orgId!}
            project={editProject}
            onSuccess={() => {
              setEditProject(null);
              fetchProjects();
            }}
            onCancel={() => setEditProject(null)}
          />
        </Modal>
      )}

      {deleteProject && (
        <ConfirmDialog
          title={`Delete "${deleteProject.name}"`}
          message="All tasks and activity in this project will be permanently deleted."
          confirmLabel="Delete project"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteProject(null)}
        />
      )}
    </div>
  );
}