
// @file organization.service.ts
// @description Business logic for organization (tenant) management

// WHAT IS AN ORGANIZATION HERE?
// In multi-tenant architecture, each "organization" is a tenant — a completely isolated workspace. When a user creates an organization, they become its OWNER with full control.

// KEY CONCEPTS:
// - Soft delete: organizations are never truly deleted, just marked deletedAt
// - Owner is automatically added as ACTIVE member with OWNER role on creation
// - Slug is the unique URL-safe identifier (like GitHub usernames)
// - Status transitions: ACTIVE → SUSPENDED → CANCELED

import { BaseService } from "@/common/BaseService";
import ApiError from "@/utils/ApiError";
import { OrganizationStatus } from "@prisma/client";

//-----------------------------ORGANIZATION SERVICE---------------------------------------------------------------------------------------

// Handles all business logic for organizations

class OrganizationService extends BaseService {

  //-----------------------------PRIVATE HELPERS---------------------------------------------------------------------------------------

  // Verify user is an active member of an organization.
  // Reused across multiple methods to avoid duplication.
  // @throws 403 if user is not an active member

  private async verifyActiveMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (!member) {
      throw ApiError.forbidden('You do not have access to this organization');
    }

    return member;
  }

  // Verify user has one of the required roles in an organization.
  // Always checks active membership first.
  // @param roles - Allowed roles e.g. ['OWNER', 'ADMIN']
  // @throws 403 if user is not an active member or lacks required role

  private async verifyRole(userId: string, organizationId: string, roles: string[]) {
    const member = await this.verifyActiveMember(userId, organizationId);

    if (!roles.includes(member.role)) {
      throw ApiError.forbidden(
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${member.role}`,
      );
    }

    return member;
  }

  //-----------------------------CREATE ORGANIZATION---------------------------------------------------------------------------------------

  // Create a new organization and add creator as OWNER member.

  // @param userId - ID of the user creating the org(becomes OWNER)
  // @param data - Organization data(name, slug, logo)
  // @throws 409 - If slug is already taken

  async createOrganization(userId: string, data: {
    name: string,
    slug: string,
    logo?: string
  }) {

    this.log("Creating Organization", { userId, slug: data.slug });

    // Check if slug already exists
    const existing = await this.prisma.organization.findUnique({
      where: {
        slug: data.slug
      }
    });

    if (existing) {
      throw ApiError.conflict(`Slug "${data.slug}" is already taken. Please choose a different slug.`,);
    }

    // Use transaction: org + membership created atomically
    // WHY A TRANSACTION?
    // Both the organization and the owner membership must be created together.
    // If org creates but membership fails, the owner can't access their own org.
    // A transaction ensures both succeed or both roll back — no partial state.

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          ownerId: userId,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Add creator as OWNER member so they pass membership checks
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      return org;
    })

    this.log('Organization created successfully', { organizationId: organization.id });

    return organization;
  }

  //-----------------------------GET ORGANIZATION BY ID (SINGLE)---------------------------------------------------------------------------------------

  async getOrganizationById(id: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        //This means: “Also tell me how many members, projects, and tasks this organization has.”
        _count: {
          select: {
            members: true,
            projects: true,
            tasks: true,
          },
        },
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Verify requesting user is an active member
    await this.verifyActiveMember(userId, id);

    return organization;
  }

  //-----------------------------GET ORGANIZATION AS PER USER---------------------------------------------------------------------------------------

  // Get all organizations a user actively belongs to.
  // Returns paginated results with user's role in each org.

  // @param userId - User ID
  // @param page - Page number(default: 1)
  // @param limit - Items per page(default: 10)

  async getUserOrganizations(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    //Only return organizations where this user is an ACTIVE member.
    // Prisma keyword	      Meaning
    // some	                At least one matches
    // every              	All must match
    // none               	No record should match

    // membershipFilter is just a JavaScript object.

    const membershipFilter = {
      members: {
        some: {
          userId,
          status: 'ACTIVE' as const,
        },
      },
    };

    // WHY PARALLEL QUERIES?
    // Running findMany + count sequentially wastes time.
    // Promise.all runs both at the same time — roughly 2x faster.
    // (pagination + filtering + parallel queries)

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where: membershipFilter,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          // Include only the current user's membership to show their role
          members: {
            where: {
              userId
            },
            select: {
              role: true,
              status: true,
              joinedAt: true,
            },
          },
          _count: {
            select: {
              members: true,
              projects: true,
              tasks: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
      }),

      this.prisma.organization.count({
        where: membershipFilter,
      }),
    ]);

    return {
      organizations,
      meta: this.buildPaginationMeta(page, limit, total),
    };

  }

  //-----------------------------UPDATE ORGANIZATION---------------------------------------------------------------------------------------

  // Update organization name and / or logo.
  // Only OWNER or ADMIN can update.
  // NOTE: Slug is intentionally excluded from updates.
  // Slug is a permanent identifier — changing it breaks
  // existing integrations, bookmarks, and API references.

  // @param id - Organization UUID
  // @param userId - Requesting user's ID
  // @param data - Fields to update(name, logo)
  // @throws 403 - If user is not OWNER or ADMIN
  // @throws 404 - If organization not found

  // Partial<T> means:
  // All properties become optional.
  // So this:
  // Partial<{ name: string; logo: string | null }>
  // Becomes:
  // {
  //   name?: string;
  //   logo?: string | null;
  // }

  async updateOrganization(id: string, userId: string, data: Partial<{
    name: string,
    logo: string
  }>) {
    this.log('Updating organization', { organizationId: id, userId });

    // Verify org exists before role check
    const organization = await this.prisma.organization.findUnique({
      where: {
        id
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Only OWNER or ADMIN can update
    await this.verifyRole(userId, id, ['OWNER', 'ADMIN']);

    const updated = await this.prisma.organization.update({
      where: {
        id
      },
      data,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.log('Organization updated', { organizationId: id });

    return updated;
  }

  //-----------------------------DELETE ORGANIZATION (soft delete)---------------------------------------------------------------------------------------

  // Soft delete an organization by setting status to CANCELED.
  // The record is never removed from the database.

  // WHY SOFT DELETE ?
  //- Preserves complete audit history
  //- Allows recovery if deletion was accidental
  //- Satisfies data retention requirements
  //- Cascading hard deletes across members / projects / tasks is destructive
  // Only the OWNER can delete their organization.

  // @param id - Organization UUID
  // @param userId - Requesting user's ID
  // @throws 404 - If organization not found
  // @throws 403 - If user is not the OWNER

  async deleteOrganization(id: string, userId: string) {
    this.log('Soft deleting organization', { organizationId: id, userId });

    const organization = await this.prisma.organization.findUnique({
      where: {
        id
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Only OWNER can delete — role check not enough, must be THE owner
    if (organization.ownerId !== userId) {
      throw ApiError.forbidden(
        'Only the organization owner can delete the organization',
      );
    }

    await this.prisma.organization.update({
      where: {
        id
      },
      data: {
        status: OrganizationStatus.CANCELED
      },
    });

    this.log('Organization soft deleted', { organizationId: id });

    return { message: 'Organization deleted successfully' };
  }

  //----------------------------- GET OR CREATE SETTINGS ---------------------------------------------------------------------------------------

  // This function returns the settings of an organization.
  // But it also ensures:
  // If the settings do not exist, create them automatically.
  // So it guarantees:
  // ✅ Every organization always has settings.

  // WHY UPSERT?
  // Settings are created lazily — we don't create them at org creation to keep the creation transaction simple. First time settings are requested, we create them with defaults automatically.

  // @param organizationId - Organization UUID
  // @param userId         - Requesting user's ID
  // @throws 403           - If user is not an active member

  async getOrganizationSettings(organizationId: string, userId: string) {
    this.log('Getting organization settings', { organizationId });

    await this.verifyActiveMember(userId, organizationId);

    // upsert: get if exists, create with defaults if not 
    // upsert = UPDATE + INSERT

    // What upsert requires ???
    // The structure of upsert always requires three things:
    // prisma.model.upsert({
    //   where: {...},
    //   update: {...},
    //   create: {...}
    // })
    // Field	Purpose:
    // where	Find the record
    // update	What to do if record exists
    // create	What to do if record does not exist
    // So update is mandatory. Prisma will give an error if you remove it.

    // Settings do NOT exist:
    // Example database:

    // organizationId   	primaryColor
    // (no record)	

    // Then Prisma executes:
    // create: {
    //   organizationId
    // }
    // So a new row is created:

    // organizationId   	primaryColor    	allowGuestAccess
    // org123           	default	          default

    // The other fields get default values from the Prisma schema.

    const settings = await this.prisma.organizationSettings.upsert({
      where: {
        organizationId
      },
      update: {},  // No update needed, just fetch
      create: {
        organizationId,
      },
    });

    return settings;
  }

  //----------------------------- UPDATE SETTINGS ---------------------------------------------------------------------------------------

  // Update organization branding and feature settings.
  // Only OWNER or ADMIN can update settings.

  // @param organizationId - Organization UUID
  // @param userId         - Requesting user's ID
  // @param data           - Settings fields to update
  // @throws 403           - If user is not OWNER or ADMIN

  async updateOrganizationSettings(organizationId: string, userId: string, data: {
    primaryColor?: string;
    accentColor?: string;
    isInviteOnly?: boolean;
    allowGuestAccess?: boolean;
  },
  ) {
    this.log('Updating organization settings', { organizationId });

    await this.verifyRole(userId, organizationId, ['OWNER', 'ADMIN']);

    // upsert: create settings if they don't exist yet, then update
    const settings = await this.prisma.organizationSettings.upsert({
      where: {
        organizationId
      },
      update: data,
      create: {
        organizationId,
        ...data,
      },
    });

    this.log('Organization settings updated', { organizationId });

    return settings;
  }

  //----------------------------- UPDATE ONBOARDING ---------------------------------------------------------------------------------------

  //Onboarding usually means: The setup steps a new organization must complete when starting the platform.

  // Update organization onboarding progress.
  // Called by frontend as user completes each setup step.

  // Onboarding steps:
  //   0 → Org created
  //   1 → Profile completed
  //   2 → First member invited
  //   3 → First project created
  //   4 → First task created
  //   5 → Onboarding complete

  // @param organizationId  - Organization UUID
  // @param userId          - Requesting user's ID
  // @param onboardingStep  - Current step number (0-5)
  // @param isOnboarded     - Whether onboarding is fully complete
  // @throws 403            - If user is not OWNER or ADMIN

  async updateOnboarding(organizationId: string, userId: string, onboardingStep: number) {

    this.log('Updating onboarding progress', { organizationId, onboardingStep });

    await this.verifyRole(userId, organizationId, ['OWNER', 'ADMIN']);

    // Always calculate isOnboarded from the step — never trust the client
    // Only mark as onboarded when step reaches 5
    const isOnboarded = onboardingStep >= 5;

    const settings = await this.prisma.organizationSettings.upsert({
      where: {
        organizationId
      },
      update: {
        onboardingStep,
        isOnboarded,
      },
      create: {
        organizationId,
        onboardingStep,
        isOnboarded,
      },
    });

    return settings;
  }

  //----------------------------- GET ORGANIZATION USAGE ---------------------------------------------------------------------------------------

  // Get current usage stats for an organization.
  // Recalculates live counts from DB for accuracy.

  // WHY RECALCULATE INSTEAD OF JUST READING OrganizationUsage?
  // Cached counts can drift if records are deleted or bulk operations run.
  // For a usage dashboard, accuracy matters more than speed.
  // The cached OrganizationUsage table is better used for billing/quotas
  // where we want fast reads (Day 31).

  // @param organizationId - Organization UUID
  // @param userId         - Requesting user's ID
  // @throws 403           - If user is not an active member

  async getOrganizationUsage(organizationId: string, userId: string) {
    this.log('Getting organization usage', { organizationId });

    await this.verifyActiveMember(userId, organizationId);

    // Get org with limits and live counts in one query
    const [organization, currentUsers, currentProjects] = await Promise.all([
      this.prisma.organization.findUnique({
        where: {
          id: organizationId
        },
        select: {
          maxUsers: true,
          maxProjects: true,
          maxStorage: true,
          plan: true,
        },
      }),
      // Live count of active members
      this.prisma.organizationMember.count({
        where: {
          organizationId,
          status: 'ACTIVE',
        },
      }),
      // Live count of active projects
      this.prisma.project.count({
        where: {
          organizationId,
          status: { not: 'ARCHIVED' },
        },
      }),
    ]);

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Update cached usage record
    await this.prisma.organizationUsage.upsert({
      where: {
        organizationId
      },
      update: {
        currentUsers,
        currentProjects,
        lastCalculatedAt: new Date(),
      },
      create: {
        organizationId,
        currentUsers,
        currentProjects,
      },
    });

    return {
      limits: {
        maxUsers: organization.maxUsers,
        maxProjects: organization.maxProjects,
        maxStorage: organization.maxStorage.toString(),
        plan: organization.plan,
      },
      current: {
        users: currentUsers,
        projects: currentProjects,
      },
      // Percentage used — useful for frontend progress bars
      percentages: {
        users: Math.round((currentUsers / organization.maxUsers) * 100),
        projects: Math.round((currentProjects / organization.maxProjects) * 100),
      },
    };
  }

  //----------------------------- SUSPEND / REACTIVATE (org admin action) ---------------------------------------------------------------------------------------

  // Suspend or reactivate an organization.
  // Only OWNER can suspend their own org.

  // WHY WOULD AN OWNER SUSPEND THEIR OWN ORG?
  // Temporary shutdown (company holiday, maintenance, etc.)
  // Members can't access the org while suspended.

  // For platform-level suspension (payment failure etc.),
  // use the super admin endpoint instead.

  // @param organizationId - Organization UUID
  // @param userId         - Requesting user's ID (must be OWNER)
  // @param status         - ACTIVE or SUSPENDED
  // @throws 403           - If user is not OWNER
  // @throws 400           - If trying to set invalid status transition

  async updateOrganizationStatus(organizationId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    this.log('Updating organization status', { organizationId, status });

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Only OWNER can suspend/reactivate their own org
    if (organization.ownerId !== userId) {
      throw ApiError.forbidden(
        'Only the organization owner can suspend or reactivate the organization',
      );
    }

    // Prevent suspending an already suspended org or activating an active one
    if (organization.status === status) {
      throw ApiError.badRequest(
        `Organization is already ${status.toLowerCase()}`,
      );
    }

    // CANCELED orgs cannot be reactivated — they are permanently closed
    if (organization.status === 'CANCELED') {
      throw ApiError.badRequest(
        'Canceled organizations cannot be reactivated. Please create a new organization.',
      );
    }

    // ← KEY CHECK: if suspended by SUPERADMIN, owner cannot reactivate
    if (
      status === 'ACTIVE' &&
      organization.status === 'SUSPENDED' &&
      organization.suspendedBy === 'SUPERADMIN'
    ) {
      throw ApiError.forbidden(
        'This organization was suspended by the platform administrator. Please contact support to reactivate.',
      );
    }
    const updated = await this.prisma.organization.update({
      where: {
        id: organizationId
      },
      data: {
        status,
        // Track who suspended — clear it on reactivation
        suspendedBy: status === 'SUSPENDED' ? 'OWNER' : null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    this.log('Organization status updated', { organizationId, status });

    return updated;
  }
}

export default new OrganizationService;