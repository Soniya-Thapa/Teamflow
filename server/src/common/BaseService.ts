
import prisma from "@/config/database";
import logger from "@/utils/logger";

//  Base Service Class
//  Provides common functionality for all services

export abstract class BaseService {
  protected prisma = prisma;
  protected logger = logger;

  // Every object in JavaScript/TypeScript has a constructor, which is the class it was created from.
  // .name gives the class name as a string.
  // Example:
  // class UserService extends BaseService {}
  // const userService = new UserService();
  // console.log(userService.constructor.name); // "UserService"

  // Log service activity
  protected log(message: string, meta?: any) {
    this.logger.info(`[${this.constructor.name}] ${message}`, meta);
  }
  // Log service error
  protected logError(message: string, error?: any) {
    this.logger.error(`[${this.constructor.name}] ${message}`, { error });
  }

  // Build pagination metadata

  protected buildPaginationMeta(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };
  }
}