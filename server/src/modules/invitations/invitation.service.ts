/**
 * @file invitation.service.ts
 * @description Business logic for the User Invitation System
 *
 * INVITATION FLOW:
 *   1. OWNER/ADMIN calls createInvitation(email, role)
 *   2. Service generates raw token → hashes it → stores hash in DB
 *   3. Raw token sent in email link
 *   4. Invitee clicks link → hits acceptInvitation(rawToken)
 *   5. Service hashes incoming token → finds matching hash in DB
 *   6. Validates: not expired, not already accepted
 *   7. Creates/finds User account
 *   8. Creates OrganizationMember record (status: ACTIVE)
 *   9. Marks invitation as accepted (acceptedAt: now)
 *
 * SECURITY:
 *   - Token hashed before storage (SHA256 via passwordUtil)
 *   - Raw token only ever exists in email link — never in DB
 *   - Tokens expire after 7 days
 *   - Cannot reuse accepted tokens
 *
 * QUOTA CHECK:
 *   - Cannot invite if org is at maxUsers limit
 *   - Cannot invite email that is already an active member
 *   - Cannot send duplicate pending invitation to same email
 *
 */

import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';
import passwordUtil from '@/utils/password.util';
import { MemberRole } from '@prisma/client';
import { addEmailJob, EmailJobType } from '@/modules/email/email.queue';

// Invitation expires after 7 days
const INVITATION_EXPIRY_DAYS = 7;

// ─────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────

class InvitationService extends BaseService {

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Verify requester is OWNER or ADMIN in the org.
   * Only they can send invitations.
   *
   * @throws 403 if user is not OWNER or ADMIN
   */
  private async verifyCanInvite(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) {
      throw ApiError.forbidden(
        'Only organization OWNER or ADMIN can send invitations',
      );
    }

    return member;
  }

  /**
   * Calculate expiry date for invitation.
   * Returns a date 7 days from now.
   */
  private getExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
    return expiresAt;
  }

  /**
   * Log invitation activity to audit trail.
   */
  private async logActivity(
    organizationId: string,
    userId: string,
    action: string,
    invitationId: string,
    metadata?: Record<string, any>,
  ) {
    await this.prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'INVITATION',
        resourceId: invitationId,
        metadata: metadata ?? {},
      },
    });
  }

  // ─────────────────────────────────────────
  // CREATE INVITATION
  // ─────────────────────────────────────────

  /**
   * Send an invitation to an email address to join the organization.
   *
   * Validates:
   *   1. Requester is OWNER or ADMIN
   *   2. Org has not reached maxUsers limit
   *   3. Email is not already an active member
   *   4. No pending invitation already exists for this email
   *
   * Token handling:
   *   - Generate 32-byte random raw token
   *   - Hash it with SHA256
   *   - Store ONLY the hash in DB
   *   - Return raw token for email (Day 12) — devOnly for now
   *
   * @param organizationId - Organization UUID
   * @param inviterId      - User sending the invitation
   * @param email          - Email to invite
   * @param role           - Role to assign on acceptance
   * @throws 403           - If requester is not OWNER/ADMIN
   * @throws 400           - If org is at member limit
   * @throws 409           - If email already member or has pending invite
   */
  async createInvitation(
    organizationId: string,
    inviterId: string,
    email: string,
    role: MemberRole = MemberRole.MEMBER,
  ) {
    this.log('Creating invitation', { organizationId, email, role });

    await this.verifyCanInvite(inviterId, organizationId);

    // Get org with current member count and limits
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Check org is not suspended or canceled
    if (organization.status !== 'ACTIVE') {
      throw ApiError.badRequest(
        `Cannot send invitations — organization is ${organization.status.toLowerCase()}`,
      );
    }

    // Check quota: cannot invite if at maxUsers limit
    if (organization._count.members >= organization.maxUsers) {
      throw ApiError.badRequest(
        `Organization has reached its member limit of ${organization.maxUsers}. ` +
        `Upgrade your plan to invite more members.`,
      );
    }

    // Check if email is already an active member
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
        user: { email },
      },
    });

    if (existingMember) {
      throw ApiError.conflict(
        `${email} is already an active member of this organization`,
      );
    }

    // Check if pending invitation already exists for this email
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        acceptedAt: null,         // not yet accepted
        expiresAt: { gt: new Date() }, // not yet expired
      },
    });

    if (existingInvitation) {
      throw ApiError.conflict(
        `A pending invitation already exists for ${email}. ` +
        `Use the resend endpoint to send a new one.`,
      );
    }

    // Generate raw token → hash it → store hash
    const rawToken = passwordUtil.generateResetToken(); // 32 random bytes hex
    const tokenHash = passwordUtil.hashResetToken(rawToken);
    const expiresAt = this.getExpiryDate();

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        role,
        tokenHash,
        invitedBy: inviterId,
        expiresAt,
      },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    await this.logActivity(
      organizationId,
      inviterId,
      'INVITATION_SENT',
      invitation.id,
      { invitedEmail: email, role },
    );

    this.log('Invitation created', { invitationId: invitation.id, email });

    // Email link format: https://teamflow.com/invite?token=${rawToken}

    // Send email via queue
    await addEmailJob(EmailJobType.INVITATION, {
      to: invitation.email,
      inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
      orgName: invitation.organization.name,
      role: invitation.role,
      token: rawToken,
    });
    return {
      invitation,
      // devOnly: remove this when email service is wired up on Day 12
      devOnly_token: rawToken,
    };
  }

  // ─────────────────────────────────────────
  // ACCEPT INVITATION
  // ─────────────────────────────────────────

  /**
   * Accept an invitation using the raw token from the email link.
   *
   * Two scenarios:
   *   A) Invitee already has an account → just add them to org
   *   B) Invitee is new → create account first, then add to org
   *
   * On acceptance:
   *   - Find invitation by hashing the incoming token
   *   - Validate: not expired, not already accepted
   *   - Create user if they don't exist (requires firstName, lastName, password)
   *   - Create OrganizationMember (status: ACTIVE, joinedAt: now)
   *   - Mark invitation acceptedAt
   *   - Generate tokens → user is logged in immediately after accepting
   *
   * This is a PUBLIC endpoint — no authentication required.
   * The invitation token IS the authentication for this action.
   *
   * @param rawToken  - Raw token from email link
   * @param userData  - Required only if user has no account yet
   * @throws 400      - If token invalid, expired, or already accepted
   * @throws 409      - If user is already a member
   */
  async acceptInvitation(
    rawToken: string,
    userData?: {
      firstName?: string;
      lastName?: string;
      password?: string;
    },
  ) {
    this.log('Accepting invitation');

    // Hash incoming token to find the matching invitation
    const tokenHash = passwordUtil.hashResetToken(rawToken);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    // Same error for invalid + expired — don't reveal which
    if (!invitation) {
      throw ApiError.badRequest('Invalid or expired invitation token');
    }

    // Check not already accepted
    if (invitation.acceptedAt) {
      throw ApiError.badRequest(
        'This invitation has already been accepted',
      );
    }

    // Check not expired
    if (new Date() > invitation.expiresAt) {
      throw ApiError.badRequest(
        'This invitation has expired. Please ask for a new invitation.',
      );
    }

    // Check org is still active
    if (invitation.organization.status !== 'ACTIVE') {
      throw ApiError.badRequest(
        'This organization is no longer active',
      );
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      // New user — requires registration data
      if (!userData?.firstName || !userData?.lastName || !userData?.password) {
        throw ApiError.badRequest(
          'Please provide firstName, lastName, and password to create your account',
        );
      }

      const hashedPassword = await require('@/utils/password.util').default.hash(
        userData.password,
      );

      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: hashedPassword,
          isEmailVerified: true, // Email verified via invitation token
        },
      });

      this.log('New user created via invitation', { userId: user.id });
    }

    // Check not already a member
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId: invitation.organizationId,
        status: 'ACTIVE',
      },
    });

    if (existingMember) {
      throw ApiError.conflict(
        'You are already a member of this organization',
      );
    }

    // Add user to org + mark invitation accepted in transaction
    await this.prisma.$transaction(async (tx) => {
      // Add user as org member
      await tx.organizationMember.create({
        data: {
          userId: user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: 'ACTIVE',
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    // Log activity
    await this.logActivity(
      invitation.organizationId,
      user.id,
      'INVITATION_ACCEPTED',
      invitation.id,
      { email: invitation.email, role: invitation.role },
    );

    this.log('Invitation accepted', {
      invitationId: invitation.id,
      userId: user.id,
    });

    // Generate tokens so user is logged in immediately
    const crypto = require('crypto');
    const { default: jwtUtil } = require('@/utils/jwt.util');

    const accessToken = jwtUtil.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshTokenId = crypto.randomUUID();
    const refreshToken = jwtUtil.generateRefreshToken({
      userId: user.id,
      tokenId: refreshTokenId,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + jwtUtil.getRefreshTokenExpiry(),
    );

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      message: `Welcome to ${invitation.organization.name}!`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: invitation.organization,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: jwtUtil.getAccessTokenExpiry(),
      },
    };
  }

  // ─────────────────────────────────────────
  // REVOKE INVITATION
  // ─────────────────────────────────────────

  /**
   * Revoke ( officially cancel or withdraw) a pending invitation before it is accepted.
   * Only OWNER or ADMIN can revoke.
   * Cannot revoke an already accepted invitation.
   *
   * @throws 404 - If invitation not found in this org
   * @throws 400 - If invitation already accepted
   * @throws 403 - If user is not OWNER or ADMIN
   */
  async revokeInvitation(
    organizationId: string,
    inviterId: string,
    invitationId: string,
  ) {
    this.log('Revoking invitation', { invitationId });

    await this.verifyCanInvite(inviterId, organizationId);

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
      },
    });

    if (!invitation) {
      throw ApiError.notFound('Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw ApiError.badRequest(
        'Cannot revoke an invitation that has already been accepted',
      );
    }

    await this.prisma.invitation.delete({
      where: { id: invitationId },
    });

    await this.logActivity(
      organizationId,
      inviterId,
      'INVITATION_REVOKED',
      invitationId,
      { revokedEmail: invitation.email },
    );

    this.log('Invitation revoked', { invitationId });

    return { message: 'Invitation revoked successfully' };
  }

  // ─────────────────────────────────────────
  // RESEND INVITATION
  // ─────────────────────────────────────────

  /**
   * Resend an invitation by generating a fresh token.
   *
   * WHY DELETE AND RECREATE?
   * The old token may have been compromised or the email may have been missed. 
   * Deleting the old invitation and creating a new one ensures only ONE valid token exists at a time per email.
   * This prevents someone from using an old token after resend.
   *
   * @throws 404 - If invitation not found
   * @throws 400 - If invitation already accepted
   * @throws 403 - If user is not OWNER or ADMIN
   */
  async resendInvitation(
    organizationId: string,
    inviterId: string,
    invitationId: string,
  ) {
    this.log('Resending invitation', { invitationId });

    await this.verifyCanInvite(inviterId, organizationId);

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
      },
    });

    if (!existingInvitation) {
      throw ApiError.notFound('Invitation not found');
    }

    if (existingInvitation.acceptedAt) {
      throw ApiError.badRequest(
        'Cannot resend an invitation that has already been accepted',
      );
    }

    // Generate fresh token
    const rawToken = passwordUtil.generateResetToken();
    const tokenHash = passwordUtil.hashResetToken(rawToken);
    const expiresAt = this.getExpiryDate();

    // Delete old invitation and create new one in transaction
    // Ensures only ONE valid token exists per email at any time
    const newInvitation = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.delete({
        where: { id: invitationId },
      });

      return tx.invitation.create({
        data: {
          organizationId,
          email: existingInvitation.email,
          role: existingInvitation.role,
          tokenHash,
          invitedBy: inviterId,
          expiresAt,
        },
        include: {
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    await this.logActivity(
      organizationId,
      inviterId,
      'INVITATION_RESENT',
      newInvitation.id,
      { email: existingInvitation.email },
    );

    this.log('Invitation resent', {
      oldId: invitationId,
      newId: newInvitation.id,
    });

    // TODO Day 12: Send email instead of returning raw token
    return {
      invitation: newInvitation,
      devOnly_token: rawToken,
    };
  }

  // ─────────────────────────────────────────
  // LIST INVITATIONS
  // ─────────────────────────────────────────

  /**
   * List invitations for an organization.
   * OWNER and ADMIN can see all invitations.
   * Supports filtering by status: pending, accepted, all.
   *
   * @param organizationId - Organization UUID
   * @param userId         - Requesting user
   * @param page           - Page number
   * @param limit          - Items per page
   * @param status         - Filter: 'pending' | 'accepted' | 'all'
   */
  async listInvitations(
    organizationId: string,
    userId: string,
    page = 1,
    limit = 10,
    status: 'pending' | 'accepted' | 'all' = 'pending',
  ) {
    await this.verifyCanInvite(userId, organizationId);

    const skip = (page - 1) * limit;

    // Build filter based on status
    const statusFilter = status === 'pending' ? { acceptedAt: null, expiresAt: { gt: new Date() } }
      : status === 'accepted' ? { acceptedAt: { not: null } }
        : {}; // 'all' — no filter

    const where = {
      organizationId,
      ...statusFilter,
    };

    const [invitations, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        include: {
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.invitation.count({ where }),
    ]);

    // Add computed status field to each invitation
    const invitationsWithStatus = invitations.map((inv) => ({
      ...inv,
      status: inv.acceptedAt ? 'accepted'
        : new Date() > inv.expiresAt ? 'expired'
          : 'pending',
      // Never expose tokenHash to client
      tokenHash: undefined,
    }));

    return {
      invitations: invitationsWithStatus,
      meta: this.buildPaginationMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // GET INVITATION BY TOKEN (for preview page)
  // ─────────────────────────────────────────

  /**
   * Get invitation details using raw token.
   * Used by frontend to show "You've been invited to join X org" page
   * before the user decides to accept.
   *
   * Public endpoint — no auth required.
   *
   * @throws 400 - If token invalid or expired
   */
  async getInvitationByToken(rawToken: string) {
    const tokenHash = passwordUtil.hashResetToken(rawToken);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
        inviter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      throw ApiError.badRequest('Invalid or expired invitation token');
    }

    if (invitation.acceptedAt) {
      throw ApiError.badRequest('This invitation has already been accepted');
    }

    if (new Date() > invitation.expiresAt) {
      throw ApiError.badRequest(
        'This invitation has expired. Please ask for a new invitation.',
      );
    }

    // Check if email already has an account
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        organization: invitation.organization,
        inviter: invitation.inviter,
        tokenHash: undefined, // Never expose hash
      },
      hasAccount: !!existingUser, // Frontend shows login vs register form
    };
  }
}

export default new InvitationService();