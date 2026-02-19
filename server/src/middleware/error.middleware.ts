
import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import ApiError from '@/utils/ApiError';
import logger from '@/utils/logger';
import { envConfig } from '@/config/env.config';

// Global error handling middleware

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let error = err;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errors = error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Handle Prisma errors (check after generating Prisma client)
  if (error.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    if (prismaError.code === 'P2002') {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Resource already exists',
      });
    }
    if (prismaError.code === 'P2025') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Resource not found',
      });
    }
  }

  // Convert to ApiError if not already
  if (!(error instanceof ApiError)) {
    const statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  const { statusCode, message } = error as ApiError;

  // Log error
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    error: err,
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    ...(envConfig.nodeEnv === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};