
import { envConfig } from '@/config/env.config';
import winston from 'winston';

// Logger is a tool to log messages (like console.log)
// But it’s more powerful and structured
// Instead of just printing to the console, it can:
//    |->Add timestamps
//    |->Add log levels (info, warn, error)
//    |->Format messages nicely
//    |->Save logs to files or external services

//Winston Logger Configuration
//Deployment-safe: Uses console logging for cloud platforms

// When you create a Winston logger, it automatically gives you methods for different log levels:
// logger.error() → for errors
// logger.warn() → for warnings
// logger.info() → for general information
// logger.verbose() → more detailed info
// logger.debug() → debug info
// logger.silly() → very low priority logs
// You don’t have to define these methods yourself — Winston adds them automatically.

const logger = winston.createLogger({
  level: envConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(), //Allows placeholders
    winston.format.json(),
  ),
  defaultMeta: { service: 'teamflow-api' },
  transports: [],
});

// Development: Colorized console output
if (envConfig.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        }),
      ),
    }),
  );
}

// Production: JSON console output (for log aggregation)
if (envConfig.nodeEnv === 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  );
}

export default logger;