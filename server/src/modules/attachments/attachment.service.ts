/**
 * @file attachment.service.ts
 * @description File upload and management via Cloudinary.
 *
 * UPLOAD FLOW:
 * 1. File received by multer (memory storage — no disk writes)
 * 2. Uploaded to Cloudinary via stream
 * 3. Cloudinary returns secure URL + public_id
 * 4. Attachment record saved in DB with metadata
 * 5. URL returned to frontend for display
 *
 * PLAN LIMITS:
 * FREE: 10MB per file, 1GB total storage
 * PRO: 50MB per file, 10GB total storage
 *
 * ALLOWED TYPES:
 * Images: jpg, jpeg, png, gif, webp
 * Documents: pdf
 * (More can be added — just extend ALLOWED_MIME_TYPES)
 */

import cloudinary from '@/config/cloudinary';
import { BaseService } from '@/common/BaseService';
import ApiError from '@/utils/ApiError';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE_FREE = 10 * 1024 * 1024; // 10MB

class AttachmentService extends BaseService {

  /**
   * Upload a file to Cloudinary and save attachment record.
   */
  async uploadFile(
    file: Express.Multer.File,
    taskId: string,
    organizationId: string,
    uploadedBy: string,
  ) {
    this.log('Uploading file', { taskId, fileName: file.originalname });

    // Verify task exists and belongs to org
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) throw ApiError.notFound('Task not found');

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw ApiError.badRequest(
        'File type not allowed. Allowed: images (jpg, png, gif, webp) and PDF',
      );
    }

    // Validate file size (FREE plan limit)
    if (file.size > MAX_FILE_SIZE_FREE) {
      throw ApiError.badRequest('File too large. Maximum size is 10MB');
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `teamflow/${organizationId}/${taskId}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(file.buffer);
    });

    // Save to database
    const attachment = await this.prisma.attachment.create({
      data: {
        taskId,
        organizationId,
        fileName: file.originalname,
        fileUrl: uploadResult.secure_url,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        uploadedBy,
      },
    });

    this.log('File uploaded', {
      attachmentId: attachment.id,
      url: uploadResult.secure_url,
    });

    return { attachment: { ...attachment, fileSize: attachment.fileSize.toString() } };
  }

  /**
   * Delete an attachment from Cloudinary and the database.
   */
  async deleteFile(
    attachmentId: string,
    organizationId: string,
    userId: string,
  ) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId },
    });

    if (!attachment) throw ApiError.notFound('Attachment not found');

    // Only the uploader or OWNER/ADMIN can delete
    if (attachment.uploadedBy !== userId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
        },
      });
      if (!member) {
        throw ApiError.forbidden('Only the uploader or an admin can delete this file');
      }
    }

    // Delete from Cloudinary — extract public_id from URL
    try {
      const urlParts = attachment.fileUrl.split('/');
      const fileWithExt = urlParts[urlParts.length - 1];
      const fileName = fileWithExt.split('.')[0];
      const folder = urlParts.slice(-4, -1).join('/');
      const publicId = `${folder}/${fileName}`;
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Continue even if Cloudinary delete fails
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    return { message: 'File deleted' };
  }

  /**
   * List attachments for a task.
   */
  async listAttachments(taskId: string, organizationId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });

    if (!task) throw ApiError.notFound('Task not found');

    const attachments = await this.prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploader: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      attachments: attachments.map((a) => ({
        ...a,
        fileSize: a.fileSize.toString(),
      })),
    };
  }
}

export default new AttachmentService();