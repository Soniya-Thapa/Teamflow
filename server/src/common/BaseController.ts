
import ApiResponse from "@/utils/ApiResponse"
import { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"

// We use abstract so BaseController cannot be used directly, only extended.
// Means:
// You cannot create an object of this class, It exists only to be inherited

export abstract class BaseController {

  // Wrap async route handlers to catch errors

  protected asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next)
    }
  }

  // Send success response: sendSuccess is generic:
  // GET → 200 OK
  // PUT → 200 or 204
  // PATCH → 200
  // DELETE → 200 or 204

  protected sendSuccess(res: Response, data: any, message = "Success", statusCode = StatusCodes.OK) {
    return ApiResponse.success(res, data, message, statusCode)
  }

  // Send created response : send created always mean http 201, so no need to pass status code 

  protected sendCreated(res: Response, data: any, message = "Resourse Created Successfully.") {
    return ApiResponse.created(res, data, message)
  }

  // Because HTTP 204 (No Content) means:
  // no data
  // no message
  // no response body
  // So only res is needed.
  // HTTP 204 is used when:
  // request succeeded ✅
  // but there is nothing to return

  protected sendNoContent(res: Response) {
    return ApiResponse.noContent(res)
  }

  // Pagination: 

  // Extract pagination params from query
  // They read data from URL like:
  // /api/users?page=2&limit=5&sortBy=name&sortOrder=asc

  protected getPagination(req: Request) {

    const page = parseInt(req.query.page as string) || 1;

    //How many items per page?
    const limit = parseInt(req.query.limit as string) || 10;

    // Example:
    // Page = 3
    // Limit = 10
    // skip = (3 - 1) * 10 = 20
    // Meaning: Skip first 20 records.
    const skip = (page - 1) * limit;

    //summary:
    // page → which page number
    // limit → items per page
    // skip → how many to ignore
    // take → how many to fetch
    return {
      page,
      limit,
      skip,
      take: limit,
    };
  }

  // Sorting:

  //Extract sort params from query

  protected getSort(req: Request, defaultSort = { createdAt: 'desc' }) {
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    
    //If user does not tell how to sort → sort by newest first.
    if (!sortBy) {
      return defaultSort;
    }

    // This is dynamic object key.
    return {
      [sortBy]: sortOrder,
    };
  }
}