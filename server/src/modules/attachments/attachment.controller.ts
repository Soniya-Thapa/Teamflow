import { Request, Response } from 'express';
import { BaseController } from '@/common/BaseController';
import attachmentService from './attachment.service';

class AttachmentController extends BaseController {
  upload = this.asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const result = await attachmentService.uploadFile(
      req.file,
      taskId as string,
      organizationId,
      userId,
    );

    return this.sendCreated(res, result, 'File uploaded successfully');
  });

  list = this.asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const organizationId = req.organizationId!;

    const result = await attachmentService.listAttachments(taskId as string, organizationId);
    return this.sendSuccess(res, result, 'Attachments retrieved');
  });

  delete = this.asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const organizationId = req.organizationId!;
    const userId = req.userId!;

    const result = await attachmentService.deleteFile(attachmentId as string, organizationId, userId);
    return this.sendSuccess(res, result, 'File deleted');
  });
}

export default new AttachmentController();