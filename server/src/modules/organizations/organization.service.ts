
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

//-----------------------------ORGANIZATION SERVICE-----------------------------

// Handles all business logic for organizations

class OrganizationService extends BaseService {

  //-----------------------------PRIVATE HELPERS-----------------------------

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

  //-----------------------------CREATE ORGANIZATION-----------------------------

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

  //-----------------------------GET ORGANIZATION BY ID (SINGLE)-----------------------------

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

  //-----------------------------GET ORGANIZATION AS PER USER-----------------------------

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
      data: organizations,
      meta: this.buildPaginationMeta(page, limit, total),
    };

  }

  //-----------------------------UPDATE ORGANIZATION-----------------------------

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

  //-----------------------------DELETE ORGANIZATION (soft delete)-----------------------------

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
}

export default new OrganizationService;