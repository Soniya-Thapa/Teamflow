
import { Router } from "express";
import authController from "./auth.controller";
import { validate } from "@/middleware/validation.middleware";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  forgotPasswordSchema,  
  resetPasswordSchema,   
} from "./auth.validation";
import { authenticate } from "@/middleware/auth.middleware";
import { authRateLimit } from "@/middleware/rateLimit.middleware";

const router = Router();

// Authentication Routes

// Public routes (no auth required)

router.post("/register", authRateLimit, validate(registerSchema), authController.register);
router.post('/login', authRateLimit, validate(loginSchema), authController.login);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimit, validate(resetPasswordSchema), authController.resetPassword);

// Protected routes (auth required)
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getProfile);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;