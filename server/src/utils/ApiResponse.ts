import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

//Standardized API Response utility

class ApiResponse {
  static success(res: Response, data: any, message = 'Success', statusCode = StatusCodes.OK) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res: Response, data: any, message = 'Resource created successfully') {
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res: Response) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }

  static error(
    res: Response,
    message: string,
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    errors?: any,
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  }
}

export default ApiResponse;