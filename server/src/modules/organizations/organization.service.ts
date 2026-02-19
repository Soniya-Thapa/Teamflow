
import { BaseService } from "@/common/BaseService";
import ApiError from "@/utils/ApiError";
import { OrganizationPlan, OrganizationStatus } from "@prisma/client";

// Organization Service
// Handles all business logic for organizations

class OrganizationService extends BaseService {
  // Create a new organization
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
      throw ApiError.conflict('Organization slug already exists');
    }

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        ownerId: userId,
        plan: OrganizationPlan.FREE,
        status: OrganizationStatus.ACTIVE
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

    // Create organization membership for owner
    await this.prisma.organizationMember.create({
      data: {
        userId: userId,
        organizationId: organization.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    this.log('Organization created successfully', { organizationId: organization.id });

    return organization;
  }

  //Get organization by ID

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

    // Verify user has access
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId: id,
        status: 'ACTIVE',
      },
    });

    if (!member) {
      throw ApiError.forbidden('You do not have access to this organization');
    }

    return organization;
  }

  // Get all organizations for a user
   async getUserOrganizations(userId:string, page = 1, limit = 10){
    
   }
}

export default new OrganizationService;