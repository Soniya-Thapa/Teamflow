import { envConfig } from '@/config/env.config';
import winston from 'winston';

//Winston Logger Configuration
//Deployment-safe: Uses console logging for cloud platforms

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