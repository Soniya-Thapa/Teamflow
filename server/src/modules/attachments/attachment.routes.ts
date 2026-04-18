import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth.middleware';
import { requireOrganization } from '@/middleware/tenant.middleware';
import attachmentController from './attachment.controller';

const router = Router({ mergeParams: true });
router.use(authenticate, requireOrganization);

// Memory storage — no disk, pass to Cloudinary as buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB guard
});

router.get('/:taskId/attachments', attachmentController.list);
router.post('/:taskId/attachments', upload.single('file'), attachmentController.upload);
router.delete('/attachments/:attachmentId', attachmentController.delete);

export default router;