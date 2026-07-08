
import { config } from "dotenv" //config is function given by dotenv
config()

export const envConfig = {

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  portNumber: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || '6379',
  redisPassword: process.env.REDIS_PASSWORD,

  logLevel: process.env.LOG_LEVEL || 'info',

  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,

  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    fromName: process.env.SMTP_FROM_NAME || 'TeamFlow',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
}
