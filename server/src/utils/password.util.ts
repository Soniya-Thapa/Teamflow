
import bcrypt from 'bcryptjs';
import crypto from 'crypto';


//                    PASSWORD UTILITY FUNCTIONS 

class PasswordUtil {

  private saltRounds: number = 10;

  //                  Hash Password With Bcrypt
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  //                  Compare Password With Hash
  async compare(password: string, hash: string): Promise<Boolean> {
    return bcrypt.compare(password, hash);
  }

  //                  Generate random password reset token
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  //                  Hash password reset token for storage
  // What it does:
  // Takes a string token (like a randomly generated password-reset token).
  // Creates a SHA-256 hash of that token.
  // Converts the hash to hexadecimal format (string of letters & numbers).
  // Returns that hashed string.

  hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

   //                   Validate password strength
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[]; 
  } {
    const errors: string[] = [];  //Create an empty array to store errors

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default new PasswordUtil();