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

---

## Author

**Soniya Thapa**  
College Project — Multi-Tenant SaaS Backend