
import { Router } from "express";
import authController from "./auth.controller";
import { validate } from "@/middleware/validation.middleware";
import {
  changePasswordSchema,
  loginSchema,
  // refreshTokenSchema,
  registerSchema,
  forgotPasswordSchema,  
  resetPasswordSchema,   
} from "./auth.validation";
import { authenticate } from "@/middleware/auth.middleware";
import { authRateLimit } from "@/middleware/rateLimit.middleware";

const router = Router();

// Authentication Routes

// Public routes (no auth required)

//POST /api/v1/auth/register
router.post("/register", authRateLimit, validate(registerSchema), authController.register);

//POST /api/v1/auth/login
router.post('/login', authRateLimit, validate(loginSchema), authController.login);

//POST /api/v1/auth/refresh-token
// router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/refresh-token', authController.refreshToken); // ← no body validation needed

//POST /api/v1/auth/forgot-password
router.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), authController.forgotPassword);

//POST /api/v1/auth/reset-password
router.post('/reset-password', authRateLimit, validate(resetPasswordSchema), authController.resetPassword);

// Protected routes (auth required)

//POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout);


//GET /api/v1/auth/me
router.get('/me', authenticate, authController.getProfile);

router.patch('/me', authenticate, authController.updateProfile);

//POST /api/v1/auth/change-password
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

router.post('/send-verification', authenticate, authController.sendVerificationEmail);
router.get('/verify-email', authController.verifyEmail); // public — token in query

export default router;