
import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import { StatusCodes } from 'http-status-codes';

// Zod validation middleware
// Validates request body, query, and params

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
      }

      next(error);
    }
  };
};
