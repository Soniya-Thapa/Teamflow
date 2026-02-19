
import { User } from '@prisma/client';

/**
 * Extend Express Request interface
 * Adds custom properties for authentication and multi-tenancy
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      organizationId?: string;
      memberRole?: MemberRole;
    }
  }
}

export {};