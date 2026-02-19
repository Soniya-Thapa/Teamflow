
import { envConfig } from "@/config/env.config";
import jwt from "jsonwebtoken";
import ApiError from "./ApiError";

//                    JWT UTILITY FUNCTIONS

interface TokenPayload {
  userId: string,
  email: string
}

interface RefreshTokenPayload {
  userId: string,
  tokenId: string
}

//                    JWT UTILITY CLASS 

class JwtUtil {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = envConfig.jwtSecret!;
    this.refreshTokenSecret = envConfig.jwtRefreshSecret!;
    this.accessTokenExpiry = envConfig.expiresIn!;
    this.refreshTokenExpiry = envConfig.refreshExpiresIn!;

    // Validate secrets in production
    if (process.env.NODE_ENV === 'production') {
      if (
        this.accessTokenSecret === 'your-secret-key' ||
        this.refreshTokenSecret === 'your-refresh-secret'
      ) {
        throw new Error('JWT secrets must be set in production!');
      }
    }
  }

  //                  generate access token (short - lived)
  generateAccessToken(payload: TokenPayload): string {
    const expiresInSec = this.parseExpiry(this.accessTokenExpiry);
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: expiresInSec,  // number of seconds
    });
  }

  //                  generate refresh token (long - lived)
  generateRefreshToken(payload: RefreshTokenPayload): string {
    const expiresInSec = this.parseExpiry(this.refreshTokenExpiry);
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: expiresInSec,
    });
  }

  //                  verify access token 

//   What jwt.verify() returns
// jwt.verify(token, secret)
// This:
// checks signature
// checks expiry
// decodes payload
// returns the payload object
// So it returns:
// {
//   userId: "u123",
//   email: "test@mail.com",
//   iat: 123456,
//   exp: 123999
// }
  verifyAccessToken(token: string) {
    try {
      return jwt.verify(token, this.accessTokenSecret) as TokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw ApiError.unauthorized('Invalid access token');
      }
      throw ApiError.unauthorized('Token verification failed');
    }
  }

  //                  verify refesh token 
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as RefreshTokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw ApiError.unauthorized('Invalid refresh token');
      }
      throw ApiError.unauthorized('Token verification failed');
    }
  }

  //                  Decode token without verification (for debugging)
  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  //                  Get token expiry time in seconds
  getAccessTokenExpiry(): number {
    return this.parseExpiry(this.accessTokenExpiry);
  }

  getRefreshTokenExpiry(): number {
    return this.parseExpiry(this.refreshTokenExpiry);
  }

  //                Parse expiry string to seconds
  private parseExpiry(expiry: string): number {

    //This line checks format correctness.
    // What it allows:
    // digits + unit 
    //Eg: 15m, 5d

    // Regex breakdown (simple):
    // ^        start
    // (\d+)   one or more numbers
    // ([smhd]) one character: s, m, h, or d
    // $        end
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    //Time conversion table
    const multipliers: { [key: string]: number } = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * multipliers[unit];
  }
}
export default new JwtUtil();