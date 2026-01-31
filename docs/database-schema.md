# TeamFlow Database Schema (ERD)

## Multi-Tenant Architecture Strategy

**Approach:** Shared Database with Row-Level Security  
**Tenant Isolation:** Every query MUST include `organizationId`

---

## Core Entities

### 1. Organizations (Tenants)
Primary tenant entity - each organization is completely isolated.

```
Organizations
├── id (UUID, PK)
├── name (String)
├── slug (String, unique)
├── logo (String, nullable)
├── plan (Enum: FREE, PRO, ENTERPRISE)
├── status (Enum: ACTIVE, SUSPENDED, CANCELED)
├── maxUsers (Int)
├── maxProjects (Int)
├── maxStorage (BigInt, bytes)
├── ownerId (UUID, FK → Users)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: slug, status, ownerId
```

---

### 2. Users
User accounts - can belong to multiple organizations.

```
Users
├── id (UUID, PK)
├── email (String, unique)
├── password (String, hashed)
├── firstName (String)
├── lastName (String)
├── avatar (String, nullable)
├── isEmailVerified (Boolean, default: false)
├── lastLoginAt (DateTime, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: email, lastLoginAt
```

---

### 3. OrganizationMembers
Junction table linking users to organizations with roles.

```
OrganizationMembers
├── id (UUID, PK)
├── userId (UUID, FK → Users)
├── organizationId (UUID, FK → Organizations)
├── role (Enum: OWNER, ADMIN, MEMBER, GUEST)
├── status (Enum: ACTIVE, INVITED, SUSPENDED)
├── invitedBy (UUID, FK → Users, nullable)
├── joinedAt (DateTime, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: userId, organizationId
Unique: (userId, organizationId)
```

---

### 4. Teams
Sub-groups within an organization.

```
Teams
├── id (UUID, PK)
├── organizationId (UUID, FK → Organizations)
├── name (String)
├── description (Text, nullable)
├── leaderId (UUID, FK → Users, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: organizationId, leaderId
```

---

### 5. TeamMembers
Junction table for team membership.

```
TeamMembers
├── id (UUID, PK)
├── teamId (UUID, FK → Teams)
├── userId (UUID, FK → Users)
├── role (Enum: TEAM_LEAD, MEMBER)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: teamId, userId
Unique: (teamId, userId)
```

---

### 6. Projects
Work containers within an organization.

```
Projects
├── id (UUID, PK)
├── organizationId (UUID, FK → Organizations)
├── teamId (UUID, FK → Teams, nullable)
├── name (String)
├── description (Text, nullable)
├── status (Enum: ACTIVE, ARCHIVED, COMPLETED)
├── startDate (DateTime, nullable)
├── endDate (DateTime, nullable)
├── createdBy (UUID, FK → Users)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: organizationId, teamId, status, createdBy
```

---

### 7. Tasks
Individual work items.

```
Tasks
├── id (UUID, PK)
├── organizationId (UUID, FK → Organizations)
├── projectId (UUID, FK → Projects)
├── title (String)
├── description (Text, nullable)
├── status (Enum: TODO, IN_PROGRESS, REVIEW, DONE)
├── priority (Enum: LOW, MEDIUM, HIGH, URGENT)
├── assignedTo (UUID, FK → Users, nullable)
├── dueDate (DateTime, nullable)
├── estimatedHours (Int, nullable)
├── actualHours (Int, nullable)
├── createdBy (UUID, FK → Users)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: organizationId, projectId, assignedTo, status, dueDate
```

---

### 8. Comments
Task comments with mentions support.

```
Comments
├── id (UUID, PK)
├── taskId (UUID, FK → Tasks)
├── userId (UUID, FK → Users)
├── content (Text)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: taskId, userId, createdAt
```

---

### 9. Attachments
Files attached to tasks.

```
Attachments
├── id (UUID, PK)
├── taskId (UUID, FK → Tasks)
├── organizationId (UUID, FK → Organizations)
├── fileName (String)
├── fileUrl (String)
├── fileSize (BigInt, bytes)
├── mimeType (String)
├── uploadedBy (UUID, FK → Users)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: taskId, organizationId, uploadedBy
```

---

### 10. Invitations
Pending user invitations.

```
Invitations
├── id (UUID, PK)
├── organizationId (UUID, FK → Organizations)
├── email (String)
├── role (Enum: ADMIN, MEMBER, GUEST)
├── token (String, unique)
├── invitedBy (UUID, FK → Users)
├── expiresAt (DateTime)
├── acceptedAt (DateTime, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: organizationId, email, token, expiresAt
```

---

### 11. ActivityLogs
Complete audit trail of all actions.

```
ActivityLogs
├── id (UUID, PK)
├── organizationId (UUID, FK → Organizations)
├── userId (UUID, FK → Users)
├── action (String, e.g., "CREATED_TASK")
├── resourceType (String, e.g., "TASK")
├── resourceId (UUID)
├── metadata (JSON, nullable)
├── ipAddress (String, nullable)
├── userAgent (String, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: organizationId, userId, resourceType, createdAt
```

---

### 12. Notifications
In-app notifications for users.

```
Notifications
├── id (UUID, PK)
├── userId (UUID, FK → Users)
├── organizationId (UUID, FK → Organizations)
├── type (String, e.g., "TASK_ASSIGNED")
├── title (String)
├── message (String)
├── isRead (Boolean, default: false)
├── metadata (JSON, nullable)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: userId, organizationId, isRead, createdAt
```

---

### 13. RefreshTokens
JWT refresh token storage.

```
RefreshTokens
├── id (UUID, PK)
├── userId (UUID, FK → Users)
├── token (String, unique)
├── expiresAt (DateTime)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Indexes: userId, token, expiresAt
```

---

## Relationships Summary

```
Organizations (1) ←→ (many) OrganizationMembers ←→ (many) Users
Organizations (1) ←→ (many) Teams
Organizations (1) ←→ (many) Projects
Organizations (1) ←→ (many) Tasks
Organizations (1) ←→ (many) Invitations
Organizations (1) ←→ (many) ActivityLogs
Organizations (1) ←→ (many) Notifications

Users (1) ←→ (many) Tasks (assigned)
Users (1) ←→ (many) Comments
Users (1) ←→ (many) RefreshTokens

Projects (1) ←→ (many) Tasks
Tasks (1) ←→ (many) Comments
Tasks (1) ←→ (many) Attachments

Teams (1) ←→ (many) TeamMembers ←→ (many) Users
Teams (1) ←→ (many) Projects
```

---

## Multi-Tenancy Implementation

### Critical Security Rule:
**EVERY query accessing tenant data MUST include organizationId**

```typescript
// ✅ CORRECT
const tasks = await prisma.task.findMany({
  where: {
    organizationId: user.organizationId, // ← REQUIRED
    status: 'TODO',
  },
});

// ❌ WRONG - DATA LEAK!
const tasks = await prisma.task.findMany({
  where: {
    status: 'TODO', // Missing organizationId!
  },
});
```

### Prisma Middleware (Auto-inject organizationId):
We'll implement middleware on Day 2 to automatically inject `organizationId` into all queries.

---

## Performance Optimizations

### Essential Indexes:
1. All foreign keys
2. `organizationId` on every multi-tenant table
3. Status fields (frequently filtered)
4. Date fields (sorting/filtering)
5. Email (user lookup)
6. Tokens (authentication)

### Pagination Strategy:
Use cursor-based pagination for scalability:
```typescript
{
  take: 20,
  skip: 1,
  cursor: { id: lastId },
  orderBy: { createdAt: 'desc' }
}
```

---

## Implementation Timeline

- **Day 2:** Implement all models in Prisma schema
- **Day 3:** Create migrations and seed data
- **Day 4-5:** Build authentication system
- **Day 6-12:** Implement multi-tenancy logic

---

## Notes

- All IDs use UUID for security and distribution
- Timestamps (createdAt, updatedAt) on all tables
- Soft deletes where needed (status flags)
- JSON fields for flexible metadata
- Enums for type safety