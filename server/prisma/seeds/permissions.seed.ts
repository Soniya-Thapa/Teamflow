
// file : permissions.seed.ts
// description : Seeds default permissions and system roles into the database

// PERMISSION FORMAT: resource:action
// Resources: organization, member, team, project, task, comment, attachment
// Actions: create, read, update, delete, manage

// RUN: npx ts-node -r tsconfig-paths/register prisma/seeds/permissions.seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ───────────────────────────────────────── ALL PERMISSIONS ─────────────────────────────────────────

const permissions = [
  // Organization
  { name: 'organization:read', displayName: 'View Organization', resource: 'organization', action: 'read', description: 'View organization details and settings' },
  { name: 'organization:update', displayName: 'Update Organization', resource: 'organization', action: 'update', description: 'Update organization name, logo, and settings' },
  { name: 'organization:delete', displayName: 'Delete Organization', resource: 'organization', action: 'delete', description: 'Delete the organization permanently' },
  { name: 'organization:suspend', displayName: 'Suspend Organization', resource: 'organization', action: 'suspend', description: 'Suspend or reactivate the organization' },

  // Members
  { name: 'member:read', displayName: 'View Members', resource: 'member', action: 'read', description: 'View organization members list' },
  { name: 'member:invite', displayName: 'Invite Members', resource: 'member', action: 'invite', description: 'Send invitations to new members' },
  { name: 'member:remove', displayName: 'Remove Members', resource: 'member', action: 'remove', description: 'Remove members from organization' },
  { name: 'member:manage', displayName: 'Manage Members', resource: 'member', action: 'manage', description: 'Change member roles and permissions' },

  // Teams
  { name: 'team:create', displayName: 'Create Teams', resource: 'team', action: 'create', description: 'Create new teams' },
  { name: 'team:read', displayName: 'View Teams', resource: 'team', action: 'read', description: 'View teams and their members' },
  { name: 'team:update', displayName: 'Update Teams', resource: 'team', action: 'update', description: 'Update team details' },
  { name: 'team:delete', displayName: 'Delete Teams', resource: 'team', action: 'delete', description: 'Delete teams' },

  // Projects
  { name: 'project:create', displayName: 'Create Projects', resource: 'project', action: 'create', description: 'Create new projects' },
  { name: 'project:read', displayName: 'View Projects', resource: 'project', action: 'read', description: 'View projects and their details' },
  { name: 'project:update', displayName: 'Update Projects', resource: 'project', action: 'update', description: 'Update project details and settings' },
  { name: 'project:delete', displayName: 'Delete Projects', resource: 'project', action: 'delete', description: 'Delete or archive projects' },

  // Tasks
  { name: 'task:create', displayName: 'Create Tasks', resource: 'task', action: 'create', description: 'Create new tasks' },
  { name: 'task:read', displayName: 'View Tasks', resource: 'task', action: 'read', description: 'View tasks and their details' },
  { name: 'task:update', displayName: 'Update Tasks', resource: 'task', action: 'update', description: 'Update task details, status, priority' },
  { name: 'task:delete', displayName: 'Delete Tasks', resource: 'task', action: 'delete', description: 'Delete tasks' },
  { name: 'task:assign', displayName: 'Assign Tasks', resource: 'task', action: 'assign', description: 'Assign tasks to members' },

  // Comments
  { name: 'comment:create', displayName: 'Create Comments', resource: 'comment', action: 'create', description: 'Add comments to tasks' },
  { name: 'comment:read', displayName: 'View Comments', resource: 'comment', action: 'read', description: 'View task comments' },
  { name: 'comment:update', displayName: 'Update Comments', resource: 'comment', action: 'update', description: 'Edit own comments' },
  { name: 'comment:delete', displayName: 'Delete Comments', resource: 'comment', action: 'delete', description: 'Delete comments' },

  // Attachments
  { name: 'attachment:create', displayName: 'Upload Files', resource: 'attachment', action: 'create', description: 'Upload file attachments' },
  { name: 'attachment:read', displayName: 'View Files', resource: 'attachment', action: 'read', description: 'View and download attachments' },
  { name: 'attachment:delete', displayName: 'Delete Files', resource: 'attachment', action: 'delete', description: 'Delete attachments' },
];

// ───────────────────────────────────────── ROLE → PERMISSION MAPPING ─────────────────────────────────────────

const rolePermissions: Record<string, string[]> = {
  // OWNER: full access to everything
  OWNER: permissions.map(p => p.name),

  // ADMIN: everything except delete org and suspend org
  ADMIN: permissions
    .map(p => p.name)
    .filter(name => !['organization:delete', 'organization:suspend'].includes(name)),

  // MEMBER: standard day-to-day work
  MEMBER: [
    'organization:read',
    'member:read',
    'team:read',
    'project:create',
    'project:read',
    'project:update',
    'task:create',
    'task:read',
    'task:update',
    'task:assign',
    'comment:create',
    'comment:read',
    'comment:update',
    'comment:delete',
    'attachment:create',
    'attachment:read',
    'attachment:delete',
  ],

  // GUEST: read-only access
  GUEST: [
    'organization:read',
    'member:read',
    'team:read',
    'project:read',
    'task:read',
    'comment:read',
    'attachment:read',
  ],
};

// ───────────────────────────────────────── SEED FUNCTION ─────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding permissions and default roles...');

  // Step 1: Upsert all permissions
  // upsert: create if not exists, skip if already exists
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name
      },
      update: {},
      create: permission,
    });
  }
  console.log(`✅ ${permissions.length} permissions seeded`);

  // Step 2: Create system roles with their permissions
  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    // Create or update the system role
    const role = await prisma.role.upsert({
      where: { 
        name: roleName 
      },
      update: {},
      create: {
        name: roleName,
        displayName: roleName.charAt(0) + roleName.slice(1).toLowerCase(),
        isSystem: true,      // Cannot be deleted
        organizationId: null, // Applies to all orgs
        description: `Default ${roleName.toLowerCase()} role`,
      },
    });

    // Step 3: Assign permissions to role
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: { 
          name: permissionName 
        },
      });

      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    console.log(`✅ Role ${roleName} seeded with ${permissionNames.length} permissions`);
  }

  console.log('✅ RBAC seeding complete');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });