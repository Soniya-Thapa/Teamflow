
import prisma from '@/config/database';
import ApiError from '@/utils/ApiError';
import jwtUtil from '@/utils/jwt.util';
import { Request, Response, NextFunction } from 'express';

// JWT Authentication Middleware
// Verifies access token and attaches user to request

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    //Verify token 
    const payload = jwtUtil.verifyAccessToken(token);

    //check if user exists 
    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Attach user to request
    req.userId = user.id;
    req.user = user as any;

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication
// Attaches user if token is valid, but doesn't throw error if not

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtUtil.verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isEmailVerified: true,
        },
      });

      if (user) {
        req.userId = user.id;
        req.user = user as any;
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};