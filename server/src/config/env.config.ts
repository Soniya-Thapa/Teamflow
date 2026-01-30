import { config } from "dotenv" //config is function given by dotenv
config()

export const envConfig = {


  corsOrigin : process.env.CORS_ORIGIN || 'http://localhost:3000',
  apiPrefix :  process.env.API_PREFIX || '/api/v1',
  portNumber: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  redisUrl : process.env.REDIS_URL,
  redisHost : process.env.REDIS_HOST || 'localhost', 
  redisPort : process.env.REDIS_PORT || '6379',
  redisPassword : process.env.REDIS_PASSWORD, 

  logLevel : process.env.LOG_LEVEL || 'info',

  // databaseUrl: process.env.DATABASE_URL,

  // jwtSecretKey: process.env.JWT_SECRET,

  //email config
  // emailHost: process.env.EMAIL_HOST,
  // emailPort: process.env.EMAIL_PORT,
  // emailSecure: process.env.EMAIL_SECURE === 'true', // ✅ Now it's a boolean
  // emailUser: process.env.EMAIL_USER,
  // appPass: process.env.EMAIL_PASSWORD,
  // emailFrom: process.env.EMAIL_FROM,
  // resendApiKey : process.env.RESEND_API_KEY,

  // appName: process.env.APP_NAME,
  // appUrl: process.env.APP_URL,

  // //gemini
  // geminiApiKey: process.env.GEMINI_API_KEY,
  // geminiModel: process.env.GEMINI_MODEL,

  // apiUrl: process.env.NEXT_PUBLIC_API_URL,

  // clientUrls: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : [],
}
