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

### Team Endpoints

> All endpoints require `Authorization: Bearer <accessToken>` header.
> All endpoints require `X-Organization-ID` header OR org ID is in the route path.

---

#### GET `/organizations/:id/teams` 🔒
List all teams in an organization with pagination and optional search.
Any active org member can list teams.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | — | Search by team name |

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Teams retrieved successfully",
  "data": {
    "teams": [
      {
        "id": "uuid",
        "name": "Engineering",
        "description": "Core engineering team",
        "leaderId": "uuid",
        "organizationId": "uuid",
        "_count": { "members": 3, "projects": 2 },
        "members": [
          {
            "role": "TEAM_LEAD",
            "user": {
              "id": "uuid",
              "firstName": "Soniya",
              "lastName": "Thapa",
              "email": "soniya@example.com",
              "avatar": null
            }
          }
        ]
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

#### POST `/organizations/:id/teams` 🔒
Create a new team. Requires **OWNER** or **ADMIN** role.
If `leaderId` is provided, the leader is automatically added as a `TEAM_LEAD` member.

**Request Body:**
```json
{
  "name": "Engineering",
  "description": "Core engineering team",
  "leaderId": "uuid"
}
```

**Errors:**
| Status | Reason |
|---|---|
| 403 | User is not OWNER or ADMIN |
| 404 | leaderId not an active org member |

---

#### GET `/organizations/:id/teams/:teamId` 🔒
Get a single team with full member list and associated projects.

**Response includes:** team details, all members with user info, active projects, member count.

---

#### PATCH `/organizations/:id/teams/:teamId` 🔒
Update team details. Team **LEAD** or org **OWNER/ADMIN** can update.

**Request Body (all fields optional, at least one required):**
```json
{
  "name": "Engineering Team",
  "description": "Updated description",
  "leaderId": "uuid"
}
```

> Slug is not applicable to teams. Name can be updated freely.

---

#### DELETE `/organizations/:id/teams/:teamId` 🔒
Delete a team. Requires **OWNER** or **ADMIN** role only.
Team member records cascade delete automatically.
Projects linked to the team have `teamId` set to `null`.

---

#### GET `/organizations/:id/teams/:teamId/members` 🔒
List all members of a team with pagination.
TEAM_LEAD appears first, then members ordered by join date.

**Query Params:** `page`, `limit`

---

#### POST `/organizations/:id/teams/:teamId/members` 🔒
Add an organization member to a team. Team **LEAD** or org **OWNER/ADMIN** only.

> User must be an active org member before they can join a team.

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "MEMBER"
}
```

**Allowed roles:** `TEAM_LEAD`, `MEMBER`

**Errors:**
| Status | Reason |
|---|---|
| 403 | Requester is not team lead or OWNER/ADMIN |
| 404 | Target user not an active org member |
| 409 | User already a team member |

---

#### PATCH `/organizations/:id/teams/:teamId/members/:memberId` 🔒
Update a team member's role. Requires org **OWNER** or **ADMIN**.
Promoting to `TEAM_LEAD` automatically updates `team.leaderId`.

**Request Body:**
```json
{
  "role": "TEAM_LEAD"
}
```

---

#### DELETE `/organizations/:id/teams/:teamId/members/:memberId` 🔒
Remove a member from a team.

**Who can remove:**
- The member themselves (self-removal)
- Team LEAD
- Org OWNER or ADMIN

> If the removed member was the team leader, `team.leaderId` is set to `null`.

---

### Invitation Endpoints

---

#### POST `/organizations/:id/invitations` 🔒
Send an invitation to an email address. Requires **OWNER** or **ADMIN**.

**Validates:**
- Org has not reached `maxUsers` limit
- Email is not already an active member
- No pending invitation already exists for this email

**Request Body:**
```json
{
  "email": "jane@example.com",
  "role": "MEMBER"
}
```

**Allowed roles:** `ADMIN`, `MEMBER`, `GUEST` (cannot invite as OWNER)

**Response: 201 Created**
```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "data": {
    "invitation": {
      "id": "uuid",
      "email": "jane@example.com",
      "role": "MEMBER",
      "expiresAt": "2026-04-07T...",
      "inviter": { "firstName": "Soniya", "lastName": "Thapa", "email": "soniya@example.com" },
      "organization": { "id": "uuid", "name": "Acme Corp", "slug": "acme-corp" }
    },
    "devOnly_token": "abc123..."
  }
}
```

> ⚠️ `devOnly_token` is only returned in development for Postman testing.
> On Day 12 this is removed and the token is sent via email instead.

**Errors:**
| Status | Reason |
|---|---|
| 400 | Organization is at maxUsers limit — upgrade plan |
| 400 | Organization is suspended or canceled |
| 403 | User is not OWNER or ADMIN |
| 409 | Email is already an active member |
| 409 | Pending invitation already exists for this email |

---

#### GET `/organizations/:id/invitations` 🔒
List invitations for an organization. Requires **OWNER** or **ADMIN**.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `status` | string | `pending` | Filter: `pending`, `accepted`, `all` |

**Response includes computed `status` field:** `pending`, `accepted`, or `expired`

---

#### DELETE `/organizations/:id/invitations/:invitationId` 🔒
Revoke a pending invitation. Requires **OWNER** or **ADMIN**.
Cannot revoke an already accepted invitation.

---

#### POST `/organizations/:id/invitations/:invitationId/resend` 🔒
Resend invitation with a fresh token. Requires **OWNER** or **ADMIN**.

> Deletes the old invitation and creates a new one.
> Only ONE valid token per email exists at any time.
> Cannot resend an already accepted invitation.

---

#### GET `/invitations/:token` 🌐
**Public endpoint — no authentication required.**
Preview invitation details before accepting.
Used by frontend to show "You've been invited to join X" page.

**Response includes:**
- Invitation details (email, role, expiry)
- Organization info (name, slug, logo)
- Inviter info
- `hasAccount: boolean` — frontend shows login vs register form

**Errors:**
| Status | Reason |
|---|---|
| 400 | Token invalid or expired |
| 400 | Invitation already accepted |

---

#### POST `/invitations/accept` 🌐
**Public endpoint — no authentication required.**
Accept an invitation. The invitation token authenticates the request.

**Two scenarios:**

**Scenario A — Existing user (already has account):**
```json
{
  "token": "abc123..."
}
```

**Scenario B — New user (no account yet):**
```json
{
  "token": "abc123...",
  "firstName": "Jane",
  "lastName": "Doe",
  "password": "Test@123456"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Welcome to Acme Corp!",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "organization": {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

> New users are created with `isEmailVerified: true` — the invitation token proves email ownership.
> User is automatically logged in after accepting (tokens returned).

**Errors:**
| Status | Reason |
|---|---|
| 400 | Token invalid or expired |
| 400 | Invitation already accepted |
| 400 | New user — firstName, lastName, password required |
| 409 | Already an active member of this organization |

---

### Email System

TeamFlow sends transactional emails asynchronously via a Bull queue backed by Redis.
Emails never block API responses — they are queued and processed in the background.

**Email flow:**
```
API response sent instantly
     ↓
addEmailJob() → Redis (Bull queue)
     ↓
email.processor.ts picks up job (concurrency: 5)
     ↓
EmailService.sendX() → Resend API → delivered to inbox
```

**Retry logic:** Failed jobs retry 3 times with exponential backoff (2s → 4s → 8s).

**Triggered automatically by:**
| Trigger | Email Sent |
|---|---|
| `POST /auth/register` | Welcome email to new user |
| `POST /auth/forgot-password` | Password reset link |
| `POST /organizations/:id/invitations` | Invitation email to invitee |

> No HTTP endpoints exist for email — it is purely internal.
> All email links point to `FRONTEND_URL` configured in `.env`.

---

### Project Endpoints

> All endpoints require `Authorization: Bearer <accessToken>` header.
> Organization context comes from the route path `/:id` — no separate header needed.

---

#### GET `/organizations/:id/projects` 🔒
List all accessible projects. Enforces visibility rules automatically.

**Visibility rules:**
- `PUBLIC` projects → visible to all active org members
- `PRIVATE` projects → visible only to ProjectMember records + org OWNER/ADMIN

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | — | Search by project name |
| `status` | string | — | Filter: `ACTIVE`, `ARCHIVED`, `COMPLETED` |
| `teamId` | uuid | — | Filter by team |
| `visibility` | string | — | Filter: `PUBLIC`, `PRIVATE` |
| `sortBy` | string | `createdAt` | Sort field: `name`, `createdAt`, `updatedAt`, `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |
| `favorites` | boolean | false | Show only starred projects |
| `startDate` | datetime | — | Filter projects starting after this date |
| `endDate` | datetime | — | Filter projects ending before this date |

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "TeamFlow Backend",
        "description": "Core backend API",
        "status": "ACTIVE",
        "visibility": "PUBLIC",
        "isFavorite": false,
        "teamId": null,
        "createdBy": "uuid",
        "team": null,
        "creator": {
          "id": "uuid",
          "firstName": "Soniya",
          "lastName": "Thapa",
          "avatar": null
        },
        "_count": { "tasks": 12, "projectMembers": 0 },
        "createdAt": "2026-03-31T...",
        "updatedAt": "2026-03-31T..."
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

#### POST `/organizations/:id/projects` 🔒
Create a new project. Requires `project:create` permission.
If visibility is `PRIVATE`, creator is automatically added as a project member.
Updates onboarding step to 3 when the first project is created.

**Request Body:**
```json
{
  "name": "TeamFlow Backend",
  "description": "Core backend API project",
  "teamId": "uuid",
  "visibility": "PUBLIC",
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": "2026-06-30T00:00:00.000Z"
}
```

**Visibility options:** `PUBLIC` (default), `PRIVATE`

**Errors:**
| Status | Reason |
|---|---|
| 403 | Missing `project:create` permission |
| 404 | teamId not found in this organization |

---

#### GET `/organizations/:id/projects/:projectId` 🔒
Get a single project with full details including members and member count.

> Private projects return `404` (not `403`) to non-members to avoid leaking existence.

**Response includes:** project details, team info, creator info, project members list, task count, `isFavorite` flag.

---

#### PATCH `/organizations/:id/projects/:projectId` 🔒
Update project details. Project **creator** or org **OWNER/ADMIN** can update.
Requires `project:update` permission.

**Request Body (all fields optional, at least one required):**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "teamId": "uuid",
  "visibility": "PRIVATE",
  "startDate": "2026-04-01T00:00:00.000Z",
  "endDate": null
}
```

> Send `null` for `teamId`, `description`, `startDate`, or `endDate` to clear the field.

---

#### DELETE `/organizations/:id/projects/:projectId` 🔒
Hard delete a project. Requires `project:delete` permission + org **OWNER/ADMIN**.
Cascades to all tasks, comments, and attachments.

---

#### PATCH `/organizations/:id/projects/:projectId/archive` 🔒
Archive a project (sets `status: ARCHIVED`, records `archivedAt`).
Archived projects are excluded from default listing unless `status=ARCHIVED` filter is used.
Data is fully preserved — nothing is deleted.

**Errors:**
| Status | Reason |
|---|---|
| 400 | Project already archived |
| 403 | Missing `project:update` permission |

---

#### PATCH `/organizations/:id/projects/:projectId/unarchive` 🔒
Restore an archived project back to `ACTIVE` status.

**Errors:**
| Status | Reason |
|---|---|
| 400 | Project is not archived |

---

#### POST `/organizations/:id/projects/:projectId/duplicate` 🔒
Create a copy of a project. Optionally copies task structure as a skeleton.

> Duplicated tasks are reset: status → `TODO`, no assignee, no due date.
> Only task titles, descriptions, priorities, and estimated hours are copied.

**Request Body:**
```json
{
  "name": "Copy of Backend Project",
  "includeTasks": true
}
```

**Response: 201 Created** — returns the new project.

---

#### POST `/organizations/:id/projects/:projectId/favorite` 🔒
Toggle favorite (star/unstar) for the current user.
Favorites are per-user and do not affect other members.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Project added to favorites",
  "data": { "isFavorite": true, "message": "Project added to favorites" }
}
```

---

#### GET `/organizations/:id/projects/:projectId/stats` 🔒
Get task statistics for a project.

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Project stats retrieved successfully",
  "data": {
    "stats": {
      "total": 20,
      "todo": 8,
      "inProgress": 5,
      "review": 3,
      "done": 4,
      "overdue": 2,
      "completionPercentage": 20
    }
  }
}
```

---

#### GET `/organizations/:id/projects/:projectId/activity` 🔒
Get the activity timeline for a project from the audit log.
Returns all actions performed on this project ordered by most recent.

**Query Params:** `page`, `limit` (default limit: 20)

**Response includes:** action type, user who performed it, timestamp, metadata.

---

#### POST `/organizations/:id/projects/:projectId/members` 🔒
Add an org member to a **PRIVATE** project's access list.
Requires `project:update` permission + project creator or OWNER/ADMIN.

> Cannot add members to a PUBLIC project. Change visibility to PRIVATE first.
> Target user must be an active org member.

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Errors:**
| Status | Reason |
|---|---|
| 400 | Project is PUBLIC — members not applicable |
| 404 | Target user not an active org member |
| 409 | User already a project member |

---

#### DELETE `/organizations/:id/projects/:projectId/members/:memberId` 🔒
Remove a member from a private project's access list.

> Cannot remove the project creator.

---

---

### Task Endpoints

> All endpoints require `Authorization: Bearer <accessToken>` header.
> Organization context comes from the route path `/:id`.

---

#### GET `/organizations/:id/tasks` 🔒
List tasks with rich filtering, search, and pagination.
Requires `task:read` permission.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `projectId` | uuid | — | Filter by project |
| `status` | enum | — | `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE` |
| `priority` | enum | — | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `assignedTo` | uuid | — | Filter by assignee user ID |
| `createdBy` | uuid | — | Filter by creator user ID |
| `dueBefore` | datetime | — | Tasks due before this date |
| `dueAfter` | datetime | — | Tasks due after this date |
| `isOverdue` | boolean | — | `true` returns tasks past due date with status != DONE |
| `search` | string | — | Search on title and description |
| `parentTaskId` | uuid\|`null` | — | `null` = root tasks only, uuid = subtasks of that task |
| `sortBy` | string | `createdAt` | `createdAt`, `updatedAt`, `dueDate`, `priority`, `title` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

---

#### POST `/organizations/:id/tasks` 🔒
Create a new task. Requires `task:create` permission.
Any active org member with `task:create` permission can create tasks.

**Request Body:**
```json
{
  "projectId": "uuid",
  "title": "Implement login page",
  "description": "Build login UI with validation",
  "status": "TODO",
  "priority": "HIGH",
  "assignedTo": "uuid",
  "dueDate": "2026-04-15T00:00:00.000Z",
  "estimatedHours": 8,
  "parentTaskId": null
}
```

> First task created in an org advances onboarding to step 4.
> `assignedTo` field on Task stores the primary assignee UUID for quick reference.
> Use the `/assignees` endpoint to manage multiple assignees.

**Errors:**
| Status | Reason |
|---|---|
| 400 | Project is archived |
| 400 | `assignedTo` is not an active org member |
| 403 | Project is private and user is not a project member |
| 404 | Project not found |

---

#### GET `/organizations/:id/tasks/:taskId` 🔒
Get a single task with full details including subtasks, watchers, and all assignees.

---

#### PATCH `/organizations/:id/tasks/:taskId` 🔒
Update a task. Requires `task:update` permission.

**Access Rules (enforced at service layer):**

| Update Type | Who can update |
|---|---|
| Status only (`{ "status": "DONE" }`) | Assignee, watcher, creator, OWNER/ADMIN |
| Full update (title, description etc.) | Assignee, creator, OWNER/ADMIN only |
| Random member with no relation | ❌ 403 Forbidden |

> Pass `null` to clear optional fields: `{ "dueDate": null }`, `{ "assignedTo": null }`
> A task cannot be set as its own parent.

**Errors:**
| Status | Reason |
|---|---|
| 400 | No fields provided |
| 400 | `parentTaskId` is the same as `taskId` |
| 403 | User has no relation to this task (not assignee, creator, watcher, or admin) |
| 404 | Task not found |

---

#### DELETE `/organizations/:id/tasks/:taskId` 🔒
Delete a task. Requires `task:delete` permission.
Only task **creator** or org **OWNER/ADMIN** can delete.
All subtasks, comments, attachments cascade delete automatically.

---

#### GET `/organizations/:id/tasks/overdue` 🔒
Return all tasks past their due date with status not `DONE`.
Ordered by `dueDate` ascending (most overdue first).

**Query Params:** `page`, `limit`, `projectId`, `assignedTo`

---

#### GET `/organizations/:id/tasks/:taskId/activity` 🔒
Retrieve the activity log for a specific task.

---

### Task Assignment Endpoints

TeamFlow supports **two assignment scenarios**:
```
Scenario 1 — REPLACE (replacePrevious: true):
  Task was Soniya's → reassigned to Ram exclusively
  → Soniya removed from assignees AND watchers (discarded)
  → Ram becomes primary assignee
  → Ram auto-added as watcher

Scenario 2 — ADD (replacePrevious: false):
  Task is urgent → Ram added alongside Soniya
  → Soniya stays as assignee
  → Ram added as additional assignee
  → Both can update task status
```

---

#### GET `/organizations/:id/tasks/:taskId/assignees` 🔒
List all assignees for a task. Primary assignee appears first.
Requires `task:read` permission.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "assignees": [
      {
        "id": "uuid",
        "firstName": "Soniya",
        "lastName": "Thapa",
        "email": "soniya@example.com",
        "avatar": null,
        "isPrimary": true,
        "assignedAt": "2026-04-01T..."
      },
      {
        "id": "uuid",
        "firstName": "Ram",
        "lastName": "Sharma",
        "email": "ram@example.com",
        "avatar": null,
        "isPrimary": false,
        "assignedAt": "2026-04-02T..."
      }
    ]
  }
}
```

---

#### POST `/organizations/:id/tasks/:taskId/assignees` 🔒
Assign a user to a task. Requires `task:assign` permission.

**Request Body:**
```json
{
  "userId": "uuid",
  "isPrimary": true,
  "replacePrevious": true
}
```

**Fields:**
| Field | Type | Default | Description |
|---|---|---|---|
| `userId` | uuid | required | User to assign |
| `isPrimary` | boolean | `true` | Is this the main responsible person? |
| `replacePrevious` | boolean | `true` | `true` = Scenario 1 (replace), `false` = Scenario 2 (add alongside) |

**Scenario 1 — Replace (`replacePrevious: true`):**
```json
{
  "userId": "<ram-uuid>",
  "isPrimary": true,
  "replacePrevious": true
}
```
Result: All previous assignees removed and their watcher subscriptions deleted. Ram becomes sole assignee.

**Scenario 2 — Add alongside (`replacePrevious: false`):**
```json
{
  "userId": "<ram-uuid>",
  "isPrimary": false,
  "replacePrevious": false
}
```
Result: Soniya stays assigned. Ram added as additional assignee. Both can update task status.

**Errors:**
| Status | Reason |
|---|---|
| 400 | Target user is not an active org member |
| 403 | Missing `task:assign` permission |
| 404 | Task not found |

---

#### DELETE `/organizations/:id/tasks/:taskId/assignees/:userId` 🔒
Remove a specific assignee from a task. Requires `task:assign` permission.

> If the removed person was the primary assignee, the next assignee is automatically promoted to primary.
> Removed assignee is also removed from task watchers (they are discarded).

---

### Bulk Task Endpoints

---

#### PATCH `/organizations/:id/tasks/bulk/status` 🔒
Update status for up to 100 tasks at once. Requires `task:update` permission.

**Request Body:**
```json
{
  "taskIds": ["uuid", "uuid"],
  "status": "DONE"
}
```

---

#### PATCH `/organizations/:id/tasks/bulk/assign` 🔒
Assign up to 100 tasks at once (Scenario 1 — replace). Requires `task:update` permission.
Pass `null` for `assignedTo` to unassign all tasks.

**Request Body:**
```json
{
  "taskIds": ["uuid", "uuid"],
  "assignedTo": "uuid"
}
```

---

#### DELETE `/organizations/:id/tasks/bulk` 🔒
Delete up to 100 tasks at once. Requires `task:delete` permission.

**Request Body:**
```json
{
  "taskIds": ["uuid", "uuid"]
}
```

---

### Task Watcher Endpoints

Watchers subscribe to a task and receive notifications on changes.
Assignees are auto-added as watchers. When replaced (Scenario 1), they are auto-removed.

---

#### GET `/organizations/:id/tasks/:taskId/watchers` 🔒
List all task watchers.

#### POST `/organizations/:id/tasks/:taskId/watchers` 🔒
Add a watcher manually. Target must be active org member.

**Request Body:** `{ "userId": "uuid" }`

#### DELETE `/organizations/:id/tasks/:taskId/watchers/:userId` 🔒
Remove a watcher from a task.

---

### Task Comment Endpoints

---

#### GET `/organizations/:id/tasks/:taskId/comments` 🔒
List comments ordered oldest first. Requires `comment:read` permission.

#### POST `/organizations/:id/tasks/:taskId/comments` 🔒
Add a comment. Requires `comment:create` permission. Max 5000 characters.

**Request Body:** `{ "content": "This needs a design review first." }`

#### PATCH `/organizations/:id/tasks/:taskId/comments/:commentId` 🔒
Update a comment. Requires `comment:update` permission.
Only comment **author** can edit. OWNER/ADMIN can edit any comment.

#### DELETE `/organizations/:id/tasks/:taskId/comments/:commentId` 🔒
Delete a comment. Requires `comment:delete` permission.
Only comment **author** or OWNER/ADMIN can delete.

---

### Subtask Endpoints

---

#### GET `/organizations/:id/tasks/:taskId/subtasks` 🔒
List all subtasks of a parent task.

#### POST `/organizations/:id/tasks/:taskId/subtasks` 🔒
Create a subtask. Inherits `projectId` from parent automatically.
Only **one level** of nesting allowed — a subtask cannot have subtasks.

**Request Body:**
```json
{
  "title": "Write unit tests for login",
  "priority": "MEDIUM",
  "assignedTo": "uuid",
  "dueDate": "2026-04-10T00:00:00.000Z",
  "estimatedHours": 3
}
```

**Errors:**
| Status | Reason |
|---|---|
| 400 | Parent is itself a subtask — max one level deep |
| 404 | Parent task not found |

---

#### GET `/organizations/:id/tasks/:taskId/subtasks` 🔒
List all subtasks of a parent task. Ordered by `createdAt` ascending.
Requires `task:read` permission.

**Response includes:** full task shape for each subtask (same fields as task list).

---

#### POST `/organizations/:id/tasks/:taskId/subtasks` 🔒
Create a subtask under a parent task. Requires `task:create` permission.
The subtask inherits the parent's `projectId` automatically.

**Validates:**
- Parent task exists in the organization
- Parent is not itself a subtask — only one level of nesting allowed
- `assignedTo` must be an active org member

**Request Body:**
```json
{
  "title": "Write unit tests for login",
  "description": "Cover happy path and error cases",
  "priority": "MEDIUM",
  "assignedTo": "uuid",
  "dueDate": "2026-04-10T00:00:00.000Z",
  "estimatedHours": 3
}
```

> `projectId` is inherited from the parent — do not pass it here.

**Response: 201 Created**

**Errors:**
| Status | Reason |
|---|---|
| 400 | Parent task is itself a subtask — nesting only one level deep |
| 400 | `assignedTo` is not an active org member |
| 404 | Parent task not found |

### Member Endpoints

> All endpoints require `Authorization: Bearer <accessToken>` header.

---

#### GET `/organizations/:id/members` 🔒
List all organization members with pagination.
Requires `member:read` permission. Any active member can list.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | — | Search by first name, last name, or email |
| `role` | string | — | Filter: `OWNER`, `ADMIN`, `MEMBER`, `GUEST` |
| `status` | string | `ACTIVE` | Filter: `ACTIVE`, `INVITED`, `SUSPENDED` |

**Response includes:** user info, custom role assignments, join date, last login.
Members are ordered: OWNER first, then ADMIN, then MEMBER, then GUEST.

---

#### GET `/organizations/:id/members/search?q=` 🔒
Quick member search for autocomplete (task assignment, team addition etc).
Returns max 20 results. Query must be at least 2 characters.
Requires `member:read` permission.
```
GET /organizations/:id/members/search?q=jan
```

---

#### POST `/organizations/:id/members/transfer-ownership` 🔒
Transfer organization ownership. **OWNER only.**

**Rules:**
- Target must already be an active **ADMIN** (not MEMBER or GUEST)
- Transfer is atomic — old OWNER → ADMIN, new OWNER → OWNER, `org.ownerId` updated
- Cannot transfer to yourself

**Request Body:**
```json
{
  "newOwnerUserId": "uuid"
}
```

**Errors:**
| Status | Reason |
|---|---|
| 400 | Target is not an active ADMIN |
| 400 | Cannot transfer to yourself |
| 403 | Requester is not the current OWNER |

---

#### GET `/organizations/:id/members/:memberId` 🔒
Get a single member with full details including custom role assignments and inviter info.

---

#### GET `/organizations/:id/members/:memberId/profile` 🔒
Get a member's profile within the organization.

**Response includes:**
- Basic member info (role, join date)
- Active assigned tasks (up to 10, ordered by due date)
- Team memberships with team leader status
- Recent activity (last 10 actions)
- Task summary stats (total, todo, in_progress, review, done)

---

#### PATCH `/organizations/:id/members/:memberId/role` 🔒
Update a member's base role. Requires `member:manage` permission.

**Allowed target roles:** `ADMIN`, `MEMBER`, `GUEST`
(Use `transfer-ownership` to change OWNER role)

**Rules:**
- Cannot change the OWNER's role
- Cannot change your own role
- ADMIN can change MEMBER/GUEST roles but cannot promote to ADMIN (OWNER only)

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

---

#### DELETE `/organizations/:id/members/:memberId` 🔒
Remove a member from the organization. Requires `member:remove` permission.

**Who can remove whom:**
| Requester | Can remove |
|---|---|
| OWNER | ADMIN, MEMBER, GUEST |
| ADMIN | MEMBER, GUEST only |
| Any member | Themselves (self-removal / leave org) |
| Anyone | Cannot remove OWNER |

> Removing yourself is logged as `MEMBER_LEFT`. Being removed is logged as `MEMBER_REMOVED`.

---

### Notification Endpoints

> Requires `Authorization: Bearer <accessToken>` + `X-Organization-ID` header.

---

#### GET `/notifications` 🔒
List notifications for the authenticated user in the current org.
Unread notifications appear first, then read, ordered by recency.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `unreadOnly` | boolean | false | Show only unread notifications |

**Notification types:**
`TASK_ASSIGNED`, `TASK_COMMENT`, `TASK_DUE_SOON`, `MEMBER_INVITED`,
`MEMBER_JOINED`, `MEMBER_REMOVED`, `PROJECT_CREATED`, `PROJECT_ARCHIVED`,
`MENTION`, `ORG_SUSPENDED`, `OWNERSHIP_TRANSFERRED`

---

#### GET `/notifications/unread-count` 🔒
Get the count of unread notifications for the badge indicator.

**Response: 200 OK**
```json
{
  "success": true,
  "data": { "unreadCount": 5 }
}
```

---

#### PATCH `/notifications/read-all` 🔒
Mark all unread notifications as read for the current user in this org.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "markedCount": 5,
    "message": "5 notifications marked as read"
  }
}
```

---

#### PATCH `/notifications/:notificationId/read` 🔒
Mark a single notification as read. No-op if already read.

---

#### DELETE `/notifications/:notificationId` 🔒
Delete a single notification. User can only delete their own notifications.

---

### Activity Feed Endpoint

#### GET `/activity` 🔒
Get the organization activity feed from the audit log.
Any active org member can view the activity feed.

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number |
| `limit` | number | Items per page (default: 20) |
| `userId` | uuid | Filter by user who performed action |
| `resourceType` | string | Filter by resource: `PROJECT`, `TASK`, `TEAM`, `MEMBER`, `INVITATION` |
| `resourceId` | uuid | Filter by specific resource ID |

**Examples:**
```
GET /activity                                     → All org activity
GET /activity?userId=<uuid>                       → Activity by specific user
GET /activity?resourceType=PROJECT                → All project activity
GET /activity?resourceType=PROJECT&resourceId=<uuid> → Activity on one project
```

**Response includes:** action name, user who performed it, resource info, timestamp, metadata.

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

### Project Visibility System

Projects support two visibility levels:
```
PUBLIC  → All active org members can read the project
PRIVATE → Only ProjectMember records + org OWNER/ADMIN can read

Security note: Private projects return 404 (not 403) to non-members.
This prevents leaking that a private project exists at all.
```

**When to use PRIVATE:**
- Confidential client work
- Executive planning projects
- Projects involving sensitive data

**How private access works:**
```
Creator creates PRIVATE project
  → Creator auto-added as ProjectMember
  → Creator manually adds other members via POST /members
  → Non-members get 404 on any request to that project
  → Org OWNER/ADMIN can always access all projects regardless
```

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
- **Invitation Token Hashing** — Raw token travels in email link only. SHA256 hash stored in DB. Leaked DB cannot be used to accept invitations.
- **One Token Per Email** — Resending deletes the old token before creating a new one. Only one valid invitation token per email at any time.
- **Public Endpoint Rate Limiting** — `/invitations/accept` and `/invitations/:token` are rate limited to prevent token brute-forcing.
- **Private Project Isolation** — Private projects return `404` (not `403`) to non-members to avoid leaking their existence.
-- **Task Update Access Control** — Status-only updates allowed for assignees, watchers, creator, and OWNER/ADMIN. Full detail updates (title, description) restricted to assignees, creator, and OWNER/ADMIN only. Random org members cannot edit tasks they have no relation to.
- **TaskAssignee System** — Two assignment scenarios supported: Scenario 1 (replace — previous assignee discarded, removed from watchers) and Scenario 2 (add alongside — both assignees active, both can update status).
- **Auto-watcher Management** — New assignees are automatically added as watchers. Replaced assignees (Scenario 1) are automatically removed from watchers, preventing them from updating the task after reassignment.
- **Bulk Operation Atomicity** — All bulk operations run in a single `$transaction`. Any invalid task ID rejects the entire batch before any writes occur.
- **Subtask Depth Limit** — Maximum one level of nesting. A subtask cannot itself have subtasks, enforced at service layer before any DB write.
- **Comment Ownership** — `requireCommentAccess` middleware enforces authorship after RBAC permission check. OWNER/ADMIN can manage any comment.
---

## Progress

| Day | Feature                                                                         | Status  |
|-----|---------------------------------------------------------------------------------|---------|
| 1   | Project setup, Docker, environment config                                       | ✅ Done |
| 2   | Database schema design, Prisma setup, migrations                                | ✅ Done |
| 3   | Express app structure, error handling, logging, middleware                      | ✅ Done |
| 4   | JWT authentication, registration, login, middleware                             | ✅ Done |
| 5   | Refresh token rotation, password reset, rate limiting                           | ✅ Done |
| 6   | Organization/tenant management (CRUD, soft delete, status)                      | ✅ Done |
| 7   | Tenant settings, usage tracking, suspension, super admin                        | ✅ Done |
| 8   | RBAC system — roles, permissions, middleware, seeding                           | ✅ Done |
| 9   | Resource-based authorization, ownership checks, bulk role assignment            | ✅ Done |
| 10  | Team management, team members, activity logging                                 | ✅ Done |
| 11  | User invitation system, token hashing, public accept endpoint                   | ✅ Done |
| 12  | Email service — Resend, Bull queue, async processing, templates                 | ✅ Done |
| 13  | Project management Part 1 — CRUD, visibility, archiving, tenant isolation       | ✅ Done |
| 14  | Project management Part 2 — members, stats, activity, favorites, duplication    | ✅ Done |
| 15  | Task management — CRUD, filters, bulk operations, overdue endpoint              | ✅ Done |
| 16  | Task comments, watchers, subtasks, activity log, TaskAssignee system            | ✅ Done |
| 17  | Member management — list, profile, role update, remove, transfer ownership      | ✅ Done |
| 18  | Notification system + Activity feed                                             | ✅ Done |
---

## Author

**Soniya Thapa**  
College Project — Multi-Tenant SaaS Backend


