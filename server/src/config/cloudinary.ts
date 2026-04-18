import { v2 as cloudinary } from 'cloudinary';
import { envConfig } from './env.config';

cloudinary.config({
  cloud_name: envConfig.cloudinary.cloudName,
  api_key: envConfig.cloudinary.apiKey,
  api_secret: envConfig.cloudinary.apiSecret,
});

export default cloudinary;