import { StatusCodes } from 'http-status-codes';

// Custom API Error class for consistent error handling
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean; //isOperational : true → expected error (user mistake, invalid input) & false → unexpected error (bug, crash)

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    //It shows: Where the error happened, Which files/functions led to it
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string) {
    return new ApiError(StatusCodes.BAD_REQUEST, message);
  }

  static unauthorized(message: string) {
    return new ApiError(StatusCodes.UNAUTHORIZED, message);
  }

  static forbidden(message: string) {
    return new ApiError(StatusCodes.FORBIDDEN, message);
  }

  static notFound(message: string) {
    return new ApiError(StatusCodes.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  static internal(message: string) {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message);
  }
}

export default ApiError;