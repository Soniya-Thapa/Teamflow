import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import searchService from './search.service';

class SearchController extends BaseController {
  search = this.asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.organizationId!;
    const userId = req.userId!;
    const { q } = req.query as { q: string };

    const result = await searchService.globalSearch(organizationId, userId, q);
    return this.sendSuccess(res, result, 'Search results');
  });
}

export default new SearchController();