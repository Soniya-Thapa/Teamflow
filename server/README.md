# TeamFlow API

A production-grade **Multi-Tenant SaaS Backend** built with Node.js, TypeScript, Express, Prisma, and PostgreSQL. This project demonstrates real-world backend architecture patterns used in professional software development.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Security](#security)
- [Progress](#progress)

---

## Overview

TeamFlow is a backend API for a project management SaaS platform (like Jira or Asana) that supports multiple organizations (tenants) on a single instance. Each organization has its own users, teams, projects, and tasks — fully isolated from other organizations.

**Key Concepts Demonstrated:**
- Multi-tenancy architecture
- JWT authentication with refresh token rotation
- Role-Based Access Control (RBAC)
- Secure password handling
- Request validation with Zod
- Structured logging with Winston
- Redis caching
- Docker-based local development

---

## Tech Stack

| Layer               |  Technology              |
|---------------------|--------------------------|
| Runtime             | Node.js 18+              |
| Language            | TypeScript               |
| Framework           | Express.js v5            |
| ORM                 | Prisma                   |
| Database            | PostgreSQL 16            |
| Cache               | Redis 7                  |
| Validation          | Zod                      |
| Authentication      | JWT (jsonwebtoken)       |
| Password Hashing    | bcryptjs                 |
| Logging             | Winston                  |
| Containerization    | Docker + Docker Compose  |

---

## Architecture

```
src/
├── common/          # Base classes (BaseService, BaseController)
├── config/          # Database, Redis, environment config
├── middleware/       # Auth, validation, rate limiting, tenant, error handling
├── modules/         # Feature modules (auth, organizations, teams, etc.)
│   └── auth/
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── auth.routes.ts
│       └── auth.validation.ts
├── types/           # TypeScript type extensions
└── utils/           # Utilities (ApiError, ApiResponse, jwt, password, logger)
```

Each module follows a **Controller → Service → Prisma** pattern:
- **Controller** — handles HTTP request/response, no business logic
- **Service** — contains all business logic, talks to database
- **Routes** — wires up middleware and controller methods

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Soniya-Thapa/Teamflow.git
cd teamflow/server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start Docker services (PostgreSQL + Redis)

```bash
docker-compose up -d
```

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Start development server

```bash
npm run dev
```

Server runs at: `http://localhost:5000`  
Health check: `http://localhost:5000/health`  
API base: `http://localhost:5000/api/v1`

---

## Environment Variables

| Variable                 | Description                   | Example                                        |
|--------------------------|-------------------------------|------------------------------------------------|
| `NODE_ENV`               | Environment                   | `development`                                  |
| `PORT`                   | Server port                   | `5000`                                         |
| `API_PREFIX`             | API route prefix              | `/api/v1`                                      |
| `DATABASE_URL`           | PostgreSQL connection string  | `postgresql://user:pass@localhost:5432/db`     |
| `REDIS_HOST`             | Redis host                    | `localhost`                                    |
| `REDIS_PORT`             | Redis port                    | `6379`                                         |
| `REDIS_PASSWORD`         | Redis password                | `yourpassword`                                 |
| `JWT_SECRET`             | Access token secret           | `your-secret-key`                              |
| `JWT_REFRESH_SECRET`     | Refresh token secret          | `your-refresh-secret`                          |
| `JWT_EXPIRES_IN`         | Access token expiry           | `15m`                                          |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry          | `7d`                                           |
| `CORS_ORIGIN`            | Allowed CORS origin           | `http://localhost:3000`                        |
| `LOG_LEVEL`              | Winston log level             | `debug`                                        |

---

## API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

### Auth Endpoints

#### POST `/auth/register`
Register a new user. Automatically logs them in and returns tokens.

**Request Body:**
```json
{
  "firstName": "Soniya",
  "lastName": "Thapa",
  "email": "soniya@example.com",
  "password": "Test@123456"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Response: 201 Created**
```json
{
  "success": true,
  "message": "Registration Successful",
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "Soniya",
      "lastName": "Thapa",
      "email": "soniya@example.com",
      "isEmailVerified": false,
      "createdAt": "2026-02-19T..."
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

---

#### POST `/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "soniya@example.com",
  "password": "Test@123456"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Login Successful.",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

---

#### POST `/auth/refresh-token`
Get a new access token using a refresh token. Old refresh token is invalidated (rotation).

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Token Refreshed Successfully.",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

---

#### POST `/auth/logout` 🔒
Logout user. Pass refreshToken to logout from current device only, or omit to logout from all devices.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body (optional):**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Logout Successful.",
  "data": null
}
```

---

#### GET `/auth/me` 🔒
Get current authenticated user's profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "soniya@example.com",
      "firstName": "Soniya",
      "lastName": "Thapa",
      "avatar": null,
      "isEmailVerified": false,
      "lastLoginAt": "2026-02-19T...",
      "createdAt": "2026-02-19T...",
      "updatedAt": "2026-02-19T..."
    }
  }
}
```

---

#### POST `/auth/change-password` 🔒
Change password when currently logged in and know existing password.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "currentPassword": "Test@123456",
  "newPassword": "NewPass@123456"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Password Changed Successfully",
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

#### POST `/auth/forgot-password`
Request a password reset link. Always returns success regardless of whether email exists (prevents email enumeration).

**Request Body:**
```json
{
  "email": "soniya@example.com"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Password reset request processed.",
  "data": {
    "message": "If this email exists, a reset link has been sent.",
    "devOnly_resetToken": "abc123..." 
  }
}
```

> ⚠️ `devOnly_resetToken` is only returned in development. In production, the token is sent via email.

---

#### POST `/auth/reset-password`
Reset password using the token received from forgot-password.

**Request Body:**
```json
{
  "token": "abc123...",
  "newPassword": "NewPass@123456"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Password reset successful.",
  "data": {
    "message": "Password reset successfully. Please log in with your new password."
  }
}
```

---

### Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```
---

### Organization Endpoints

> All organization endpoints require `Authorization: Bearer <accessToken>` header.

---

#### GET `/organizations` 🔒
Get all organizations the authenticated user belongs to. Supports pagination.

**Query Params:**
| Param   | Type   | Default | Description    |
|---------|--------|---------|----------------|
| `page`  | number | 1       | Page number    |
| `limit` | number | 10      | Items per page |

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Organizations retrieved successfully",
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "slug": "acme-corp",
        "logo": null,
        "plan": "FREE",
        "status": "ACTIVE",
        "ownerId": "uuid",
        "owner": {
          "id": "uuid",
          "email": "soniya@example.com",
          "firstName": "Soniya",
          "lastName": "Thapa"
        },
        "members": [{ "role": "OWNER", "status": "ACTIVE", "joinedAt": "..." }],
        "_count": { "members": 1, "projects": 0, "tasks": 0 },
        "createdAt": "2026-02-19T..."
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

#### POST `/organizations` 🔒
Create a new organization. The authenticated user automatically becomes the OWNER and is added as an active member.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "logo": "https://example.com/logo.png"
}
```

**Slug Rules:**
- Minimum 3 characters, maximum 50
- Lowercase letters, numbers, and hyphens only
- Must be unique across all organizations
- Cannot be changed after creation

**Response: 201 Created**
```json
{
  "success": true,
  "message": "Organization created successfully",
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "FREE",
    "status": "ACTIVE",
    "maxUsers": 5,
    "maxProjects": 3,
    "maxStorage": "1073741824",
    "ownerId": "uuid",
    "createdAt": "2026-02-19T..."
  }
}
```

---

#### GET `/organizations/:id` 🔒
Get a single organization by ID. User must be an active member of the organization.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Organization retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "FREE",
    "status": "ACTIVE",
    "owner": { ... },
    "_count": {
      "members": 1,
      "projects": 0,
      "tasks": 0
    }
  }
}
```

**Errors:**
| Status | Reason                       |
|--------|------------------------------|
| 404    | Organization not found       |
| 403    | User is not an active member |

---

#### PATCH `/organizations/:id` 🔒
Update organization name or logo. Requires **OWNER** or **ADMIN** role.

> Slug is intentionally not updatable — it is a permanent identifier.

**Request Body (all fields optional, at least one required):**
```json
{
  "name": "Acme Corporation",
  "logo": "https://example.com/new-logo.png"
}
```

**To remove logo, send:**
```json
{
  "logo": null
}
```

**Errors:**
| Status | Reason                     |
|--------|----------------------------|
| 400    | No fields provided         |
| 403    | User is not OWNER or ADMIN |
| 404    | Organization not found     |

---

#### DELETE `/organizations/:id` 🔒
Soft deletes an organization by setting status to `CANCELED`. Requires **OWNER** role only.

> Data is never permanently deleted — soft delete preserves audit history and allows recovery.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Organization deleted successfully",
  "data": {
    "message": "Organization deleted successfully"
  }
}
```

**Errors:**
| Status | Reason                 |
|--------|------------------------|
| 403    | User is not the OWNER  |
| 404    | Organization not found |

---

### Organization Settings Endpoints

> Requires `Authorization: Bearer <accessToken>` header on all endpoints.

---

#### GET `/organizations/:id/settings` 🔒
Get organization branding and feature settings. Created with defaults if accessed for the first time.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Settings retrieved successfully",
  "data": {
    "id": "uuid",
    "organizationId": "uuid",
    "primaryColor": "#6366f1",
    "accentColor": "#8b5cf6",
    "isOnboarded": false,
    "onboardingStep": 0,
    "isInviteOnly": false,
    "allowGuestAccess": true,
    "createdAt": "2026-02-19T...",
    "updatedAt": "2026-02-19T..."
  }
}
```
---

#### PATCH `/organizations/:id/settings` 🔒
Update organization branding and feature settings. Requires **OWNER** or **ADMIN** role.

**Request Body (all fields optional, at least one required):**
```json
{
  "primaryColor": "#6366f1",
  "accentColor": "#8b5cf6",
  "isInviteOnly": false,
  "allowGuestAccess": true
}
```

**Color format:** Must be a valid 6-digit hex color e.g. `#6366f1`

**Errors:**
| Status | Reason                     |
|--------|----------------------------|
| 400    | No fields provided         |
| 400    | Invalid hex color format   |
| 403    | User is not OWNER or ADMIN |

---

#### GET `/organizations/:id/usage` 🔒
Get current usage vs plan limits. Recalculates live counts for accuracy.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Usage retrieved successfully",
  "data": {
    "limits": {
      "maxUsers": 5,
      "maxProjects": 3,
      "maxStorage": "1073741824",
      "plan": "FREE"
    },
    "current": {
      "users": 2,
      "projects": 1
    },
    "percentages": {
      "users": 40,
      "projects": 33
    }
  }
}
```

---

#### PATCH `/organizations/:id/status` 🔒
Owner suspends or reactivates their organization. Requires **OWNER** role only.

> If organization was suspended by a super admin, owner cannot reactivate it.
> Contact platform support in that case.

**Request Body:**
```json
{
  "status": "SUSPENDED"
}
```

**Allowed values:** `ACTIVE` or `SUSPENDED` only

**Errors:**
| Status | Reason                                        |
|--------|-----------------------------------------------|
| 400    | Organization already has that status          |
| 400    | Canceled organizations cannot be reactivated  |
| 403    | User is not the OWNER                         |
| 403    | Suspended by platform admin — contact support |

---

#### PATCH `/organizations/:id/onboarding` 🔒
Update onboarding progress. Called by frontend after each setup step is completed.

> `isOnboarded` is calculated server-side — automatically set to `true` when step reaches 5.

**Request Body:**
```json
{
  "onboardingStep": 2
}
```

**Onboarding Steps:**
| Step | Meaning               |
|------|-----------------------|
| 0    | Organization created  |
| 1    | Profile completed     |
| 2    | First member invited  |
| 3    | First project created |
| 4    | First task created    |
| 5    | Onboarding complete   |

---

### Admin Endpoints

> These endpoints require **Super Admin** privileges (`isSuperAdmin: true` on user).
> Non-admin users receive `404 Not Found` to hide the existence of the admin panel.

---

#### GET `/admin/stats` 🔒👑
Get platform-wide statistics.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Platform stats retrieved successfully",
  "data": {
    "organizations": {
      "total": 10,
      "active": 8,
      "suspended": 1,
      "canceled": 1
    },
    "users": { "total": 47 },
    "projects": { "total": 123 },
    "tasks": { "total": 891 },
    "generatedAt": "2026-02-19T..."
  }
}
```

---

#### GET `/admin/organizations` 🔒👑
List all organizations across the platform with optional filters.

**Query Params:**
| Param    | Type   | Description                                 |
|----------|--------|---------------------------------------------|
| `page`   | number | Page number (default: 1)                    |
| `limit`  | number | Items per page (default: 10)                |
| `status` | string | Filter by `ACTIVE`, `SUSPENDED`, `CANCELED` |
| `plan`   | string | Filter by `FREE`, `PRO`, `ENTERPRISE`       |
| `search` | string | Search by name or slug                      |

**Example:**
```
GET /admin/organizations?status=SUSPENDED&page=1&limit=10
```

---

#### PATCH `/admin/organizations/:id/status` 🔒👑
Update any organization's status. Super admin can set `ACTIVE`, `SUSPENDED`, or `CANCELED`.

> Unlike the owner endpoint, super admin can set `CANCELED` directly.
> When super admin suspends an org, the owner cannot reactivate it independently.

**Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Payment failure - invoice overdue 30 days"
}
```

**Errors:**
| Status | Reason                          |
|--------|---------------------------------|
| 403    | Not a super admin (returns 404) |
| 404    | Organization not found          |

---

### RBAC — Roles & Permissions Endpoints

> All endpoints require `Authorization: Bearer <accessToken>` header.
> Access control is enforced inside the service layer.

---

#### GET `/organizations/:id/roles` 🔒
Get all roles available in an organization. Returns both system roles and custom org roles with their permissions.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": {
    "roles": [
      {
        "id": "uuid",
        "name": "OWNER",
        "displayName": "Owner",
        "isSystem": true,
        "organizationId": null,
        "rolePermissions": [
          {
            "permission": {
              "id": "uuid",
              "name": "project:create",
              "displayName": "Create Projects",
              "resource": "project",
              "action": "create"
            }
          }
        ],
        "_count": { "memberRoles": 1 }
      }
    ]
  }
}
```

---

#### GET `/organizations/:id/roles/permissions` 🔒
Get all available permissions grouped by resource. Used to build permission assignment UI.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Permissions retrieved successfully",
  "data": {
    "permissions": [...],
    "grouped": {
      "organization": [
        { "name": "organization:read", "displayName": "View Organization" },
        { "name": "organization:update", "displayName": "Update Organization" }
      ],
      "project": [
        { "name": "project:create", "displayName": "Create Projects" },
        { "name": "project:read", "displayName": "View Projects" }
      ]
    }
  }
}
```

---

#### POST `/organizations/:id/roles` 🔒
Create a custom role for the organization. Requires **OWNER** or **ADMIN**.

> System roles (OWNER, ADMIN, MEMBER, GUEST) are created by the seed script and cannot be duplicated.

**Request Body:**
```json
{
  "name": "TEAM_LEAD",
  "displayName": "Team Lead",
  "description": "Leads a team, manages tasks and members",
  "permissionIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Name Rules:**
- Uppercase letters and underscores only
- Examples: `TEAM_LEAD`, `QA_ENGINEER`, `DEVELOPER`

**Errors:**
| Status | Reason                                            |
|--------|---------------------------------------------------|
| 400    | Name not uppercase or contains invalid characters |
| 400    | No permissions provided                           |
| 403    | User is not OWNER or ADMIN                        |
| 409    | Role name already exists in this organization     |

---

#### DELETE `/organizations/:id/roles/:roleId` 🔒
Delete a custom role. Requires **OWNER** only.

> System roles (OWNER, ADMIN, MEMBER, GUEST) cannot be deleted — they are required for the platform to function.

**Errors:**
| Status | Reason                             |
|--------|------------------------------------|
| 400    | Attempting to delete a system role |
| 403    | User is not OWNER                  |
| 404    | Role not found                     |

---

#### POST `/organizations/:id/roles/members/:memberId/roles` 🔒
Assign a role to an organization member. Requires **OWNER** or **ADMIN**.

> Custom roles add ON TOP of the member's base role (OWNER/ADMIN/MEMBER/GUEST).
> A member's final permissions = base role permissions + all custom role permissions (merged).

**Request Body:**
```json
{
  "roleId": "uuid"
}
```

**Errors:**
| Status | Reason                           |
|--------|----------------------------------|
| 403    | User is not OWNER or ADMIN       |
| 404    | Member not found in organization |
| 404    | Role not found                   |

---

#### DELETE `/organizations/:id/roles/members/:memberId/roles/:roleId` 🔒
Remove a custom role assignment from a member. Requires **OWNER** or **ADMIN**.

> Removing a custom role only removes the additional permissions.
> The member's base role (OWNER/ADMIN/MEMBER/GUEST) is unaffected.

---

#### GET `/organizations/:id/roles/members/:memberId/permissions` 🔒
Get all permissions a specific member has, with the source role for each permission.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Member permissions retrieved successfully",
  "data": {
    "member": {
      "id": "uuid",
      "baseRole": "MEMBER"
    },
    "permissions": [
      {
        "name": "project:create",
        "displayName": "Create Projects",
        "resource": "project",
        "action": "create",
        "source": "system",
        "roleName": "MEMBER"
      },
      {
        "name": "member:manage",
        "displayName": "Manage Members",
        "resource": "member",
        "action": "manage",
        "source": "custom",
        "roleName": "TEAM_LEAD"
      }
    ],
    "totalPermissions": 2
  }
}
```
---

### Authorization — Resource Access & Bulk Assignment

> All endpoints require `Authorization: Bearer <accessToken>` header.

---

#### POST `/organizations/:id/roles/bulk-assign` 🔒
Assign a role to multiple members at once. Requires **OWNER** or **ADMIN**.

> Uses a database transaction — if any assignment fails, none are applied.
> Duplicate assignments are silently skipped.
> Maximum 50 members per request.

**Request Body:**
```json
{
  "memberIds": [
    "member-uuid-1",
    "member-uuid-2",
    "member-uuid-3"
  ],
  "roleId": "role-uuid"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Roles bulk assigned successfully",
  "data": {
    "message": "Role assigned to 3 members successfully",
    "assignedCount": 3
  }
}
```

**Errors:**
| Status | Reason                                        |
|--------|-----------------------------------------------|
| 400    | No member IDs provided                        |
| 400    | More than 50 members in request               |
| 400    | One or more members not found in organization |
| 403    | User is not OWNER or ADMIN                    |
| 404    | Role not found                                |

---

## Permission System

TeamFlow uses **Role-Based Access Control (RBAC)** with two layers:

### Layer 1 — Base Role (MemberRole)
Every organization member has one base role assigned at invitation:

| Role     | Description                                                 |
|----------|-------------------------------------------------------------|
| `OWNER`  | Full access to everything including delete and suspend      |
| `ADMIN`  | Full access except delete org and suspend org               |
| `MEMBER` | Standard day-to-day work — create/update projects and tasks |
| `GUEST`  | Read-only access across all resources                       |

### Layer 2 — Custom Roles
OWNER and ADMIN can create custom roles with specific permissions and assign them to members. Custom role permissions are **merged** with the base role.
```
Member base role: MEMBER
  → has: project:create, task:create, task:update ...

Custom role assigned: TEAM_LEAD
  → adds: member:manage, member:invite ...

Final permissions = MEMBER permissions + TEAM_LEAD permissions
```

### Permission Format
All permissions follow the `resource:action` format:

| Resource        | Actions                                         |
|-----------------|-------------------------------------------------|
| `organization`  | `read`, `update`, `delete`, `suspend`           |
| `member`        | `read`, `invite`, `remove`, `manage`            |
| `team`          | `create`, `read`, `update`, `delete`            |
| `project`       | `create`, `read`, `update`, `delete`            |
| `task`          | `create`, `read`, `update`, `delete`, `assign`  |
| `comment`       | `create`, `read`, `update`, `delete`            |
| `attachment`    | `create`, `read`, `delete`                      |

### Using Permissions in Routes
```typescript
// Check single permission
router.post('/projects',
  authenticate,
  requireOrganization,
  requirePermission('project:create'),
  controller.createProject
);

// Check any of multiple permissions
router.patch('/tasks/:id',
  authenticate,
  requireOrganization,
  requireAnyPermission('task:update', 'task:manage'),
  controller.updateTask
);
```

### Permission Caching
Permissions are cached in memory for **5 minutes** per member to avoid hitting the database on every request. Cache is automatically cleared when a member's roles are changed. In production, this cache moves to Redis.

---

## Authorization Patterns

TeamFlow uses a **layered authorization system**. Every protected route passes through multiple middleware checks in order:

### The Middleware Chain
```typescript
router.patch('/:projectId',
  authenticate,                         // Layer 1: Who are you?
  requireOrganization,                  // Layer 2: Which org?
  requirePermission('project:update'),  // Layer 3: Do you have permission?
  requireProjectAccess('update'),       // Layer 4: Do you own this resource?
  controller.updateProject              // Execute
);
```

### Layer 1 — Authentication (`authenticate`)
Verifies the JWT access token and attaches `req.userId` to the request.
Rejects with `401` if token is missing, invalid, or expired.

### Layer 2 — Organization Context (`requireOrganization`)
Verifies the user is an active member of the organization specified in
the `X-Organization-ID` header. Attaches `req.organizationId` and
`req.memberRole` to the request. Rejects with `403` if not a member.

### Layer 3 — Permission Check (`requirePermission`)
Checks if the user's roles (base + custom) include the required permission.
Uses an in-memory cache (5 min TTL) to avoid DB hits on every request.
```typescript
// Single permission
requirePermission('project:create')

// Any of multiple permissions
requireAnyPermission('task:update', 'task:manage')
```

### Layer 4 — Resource Ownership (`requireProjectAccess`, `requireTaskAccess`, etc.)
Checks if the user owns or has specific access to the requested resource.
This prevents users from modifying resources that belong to others,
even if they have the general permission.

**Ownership Rules:**

| Resource    | Read       | Update                            | Delete                 |
|-------------|------------|-----------------------------------|------------------------|
| Project     | Any member | Creator or OWNER/ADMIN            | Creator or OWNER/ADMIN |
| Task        | Any member | Creator, Assignee, or OWNER/ADMIN | Creator or OWNER/ADMIN |
| Task Status | Any member | Creator or Assignee only          |          —             |
| Comment     | Any member | Author only                       | Author or OWNER/ADMIN  |
| Team        | Any member | Team Leader or OWNER/ADMIN        | OWNER/ADMIN only       |

### Why Four Layers?

Each layer catches a different type of unauthorized access:
```
No token          → caught by authenticate
Wrong org         → caught by requireOrganization
Wrong role        → caught by requirePermission
Wrong resource    → caught by requireProjectAccess
```

Without all four layers, these attacks are possible:
```
Attack 1: No token         → access without logging in
Attack 2: Different org    → access another company's data
Attack 3: Wrong role       → GUEST deleting projects
Attack 4: Wrong resource   → MEMBER editing another member's tasks
```
---

## Status Code

| Status Code | Meaning                                                       |
|-------------|---------------------------------------------------------------|
| 400         | Bad Request — validation failed or invalid input              |
| 401         | Unauthorized — missing or invalid token                       |
| 403         | Forbidden — authenticated but not allowed                     |
| 404         | Not Found — resource doesn't exist                            |
| 409         | Conflict — resource already exists (e.g. duplicate email)     |
| 429         | Too Many Requests — rate limit exceeded                       |
| 500         | Internal Server Error                                         |

---

## Database Schema

### Core Models

| Model                | Description                             |
|----------------------|-----------------------------------------|
| `User`               | Registered users                        |
| `Organization`       | A tenant/company                        |
| `OrganizationMember` | User membership in an org with role     |
| `Team`               | A team within an org                    |
| `TeamMember`         | User membership in a team               |
| `Project`            | A project within an org/team            |
| `Task`               | A task within a project                 |
| `Comment`            | Comments on tasks                       |
| `Attachment`         | Files attached to tasks                 |
| `Invitation`         | Pending org invitations                 |
| `ActivityLog`        | Audit trail of actions                  |
| `Notification`       | User notifications                      |
| `RefreshToken`       | Active refresh tokens                   |
| `PasswordResetToken` | One-time password reset tokens          |

---

## Security

- **Password Hashing** — bcrypt with 10 salt rounds
- **JWT Rotation** — refresh tokens are rotated on every use
- **Rate Limiting** — auth endpoints limited to 10 requests per 15 minutes
- **Email Enumeration Prevention** — forgot-password never reveals if email exists
- **Token Hashing** — password reset tokens are hashed before DB storage
- **Helmet.js** — secure HTTP headers
- **Input Validation** — all inputs validated with Zod schemas
- **Per-device Logout** — logout from one device or all devices
- **Super Admin Protection** — Admin panel returns 404 to non-admin users to hide its existence
- **Suspension Lock** — Organizations suspended by super admin cannot be reactivated by the owner
- **Server-side Onboarding** — `isOnboarded` calculated server-side, never trusted from client

---

## Progress

| Day | Feature                                                                   | Status  |
|-----|---------------------------------------------------------------------------|---------|
| 1   | Project setup, Docker, environment config                                 | ✅ Done |
| 2   | Database schema design, Prisma setup, migrations                          | ✅ Done |
| 3   | Express app structure, error handling, logging, middleware                | ✅ Done |
| 4   | JWT authentication, registration, login, middleware                       | ✅ Done |
| 5   | Refresh token rotation, password reset, rate limiting                     | ✅ Done |
| 6   | Organization/tenant management (CRUD, soft delete, status)                | ✅ Done |
| 7   | Tenant settings, usage tracking, suspension, super admin                  | ✅ Done |
| 8   | RBAC system — roles, permissions, middleware, seeding                     | ✅ Done |
| 9   | Resource-based authorization, ownership checks, bulk role assignment      | ✅ Done |
---

## Author

**Soniya Thapa**  
College Project — Multi-Tenant SaaS Backend