
import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: {
    success: false,
    message: 'Too many attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});