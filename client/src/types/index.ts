// ─────────────────────────────────────────
// USER
// ─────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isEmailVerified: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─────────────────────────────────────────
// ORGANIZATION
// ─────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
  maxUsers: number;
  maxProjects: number;
  maxStorage: string;
  ownerId: string;
  myRole?: string;
}

// ─────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─────────────────────────────────────────
// TEAM TYPES
// ─────────────────────────────────────────

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'TEAM_LEAD' | 'MEMBER';
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  leader?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
  members?: TeamMember[];
  _count?: {
    members: number;
    projects: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// PROJECT TYPES
// ─────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';

export interface Project {
  id: string;
  organizationId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  archivedAt: string | null;
  isFavorite?: boolean;
  team?: { id: string; name: string } | null;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
  _count?: {
    tasks: number;
    projectMembers: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// TASK TYPES
// ─────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  createdBy: string;
  parentTaskId: string | null;
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    email: string;
  } | null;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
  project?: {
    id: string;
    name: string;
    visibility: ProjectVisibility;
  };
  _count?: {
    comments: number;
    attachments: number;
    subtasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}