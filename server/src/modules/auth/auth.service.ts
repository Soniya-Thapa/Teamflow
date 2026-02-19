
import { BaseService } from "@/common/BaseService";
import ApiError from "@/utils/ApiError";
import jwtUtil from "@/utils/jwt.util";
import passwordUtil from "@/utils/password.util";

//-----------------------------AUTHENTICATION SERVICE-----------------------------

class AuthService extends BaseService {

  //-----------------------------GENERATE ACCESS AND REFRESH TOKENS -----------------------------

  private async generateTokens(userId: string, email: string) {

    //generate access token
    const accessToken = jwtUtil.generateAccessToken({
      userId,
      email
    });

    // Generate refresh token
    const refreshTokenId = crypto.randomUUID();
    const refreshToken = jwtUtil.generateRefreshToken({
      userId,
      tokenId: refreshTokenId,
    });

    // Calculate expiry date of the refresh token
    //This is the start time of the refresh token.
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + jwtUtil.getRefreshTokenExpiry());

    //store refresh token in the database
    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        token: refreshToken,
        expiresAt,
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtUtil.getAccessTokenExpiry(),
    };
  }

  //-----------------------------REGISTER NEW USER-----------------------------

  async register(data: {
    firstName: string,
    lastName: string,
    email: string,
    password: string
  }) {

    this.log("Registering New User.", { email: data.email });

    // Checking if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: data.email
      }
    });

    if (existingUser) {
      throw ApiError.conflict("User with this email already exists.");
    }

    // Hash Password
    const hashedPassword = await passwordUtil.hash(data.password);

    // create user
    const user = await this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        isEmailVerified: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isEmailVerified: true,
        createdAt: true,
      }
    });

    this.log("User Registered Successfully.", { userId: user.id });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      tokens
    };
  }

  //-----------------------------LOGIN USER-----------------------------

  async login(email: string, password: string) {

    this.log("User Login Attempt.", { email });

    // Find user
    const user = await this.prisma.user.findUnique({
      where: {
        email
      },
    });

    if (!user) {
      throw ApiError.unauthorized("Invalid Email or Password.");
    }

    // Verify password
    const isPasswordValid = await passwordUtil.compare(password, user.password);

    if (!isPasswordValid) {
      throw ApiError.unauthorized("Invalid Email or Password");
    }

    //update last login
    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLoginAt: new Date(),
      }
    });

    this.log("User Logged In Successfully.", { userId: user.id });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // This is JavaScript object destructuring with rest operator.
    // Take password from user
    // Store it in a variable called _

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens
    };
  }

  //-----------------------------REFRESH ACCESS TOKEN-----------------------------

  async refreshToken(refreshToken: string) {

    this.log("Refreshing Access Token.");

    //verify refresh token
    const payload = jwtUtil.verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        token: refreshToken
      },
      include: {
        user: true
      },
    });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Delete expired token
      await this.prisma.refreshToken.delete({
        where: {
          id: storedToken.id
        },
      });
      throw ApiError.unauthorized('Refresh token expired');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(storedToken.user.id, storedToken.user.email);

    // Delete old refresh token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    this.log("Tokens Refreshed Successfully.", { userId: storedToken.user.id });

    return tokens;
  }

  //-----------------------------LOGOUT USER-----------------------------

  // The refreshtoken is optional because : 
  // User is logged out only from that device
  // Other devices stay logged in

  async logout(userId: string, refreshToken?: string) {

    this.log("User Logout", { userId });

    if (refreshToken) {
      // Delete specific refresh token
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    }
    else {
      // Delete all refresh tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId
        }
      });
    }

    this.log('User logged out successfully', { userId });
  }

  //-----------------------------GET USER PROFILE-----------------------------

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound("User Not Found.");
    }

    return {
      user
    };
  }

  //-----------------------------CHANGE PASSWORD -----------------------------

  async changePassword(userId: string, currentPassword: string, newPassword: string) {

    this.log('Changing password', { userId });

    // Get user with password
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
    });

    if (!user) {
      throw ApiError.notFound("User Not Found.");
    }

    // Verify current password
    const isPasswordValid = await passwordUtil.compare(currentPassword, user.password)

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');

    }

    // Hash new password
    const hashedPassword = await passwordUtil.hash(newPassword);

    // Update password
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId
      }
    });

    //For developers / system (logging)
    //Goes to logs (file / console / monitoring tool)
    this.log('Password changed successfully', { userId });

    //For frontend / user (responding)
    //Used by:Frontend to show toast / message
    return { message: 'Password changed successfully' };
  }

  //-----------------------------REQUEST PASSWORD RESET-----------------------------

  async requestPasswordReset(email: string) {
    this.log("Password Reset Requested", { email });

    const user = await this.prisma.user.findUnique({
      where: {
        email
      },
    });

    // Always return same message — prevents email enumeration attacks
    // (attacker can't tell if email exists or not)
    if (!user) {
      return { message: 'If this email exists, a reset link has been sent.' };
    }

    // Generate raw token (this is what goes in the email link)
    const rawToken = passwordUtil.generateResetToken();

    // Hash it (this is what gets stored in DB)
    const tokenHash = passwordUtil.hashResetToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry

    // Delete any existing reset tokens for this user first
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id
      },
    });

    // Store the HASH, never the raw token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    this.log('Password reset token generated', { userId: user.id });

    return {
      message: 'If this email exists, a reset link has been sent.',
      devOnly_resetToken: rawToken,
    };
  }

  //-----------------------------RESET PASSWORD-----------------------------

  async resetPassword(rawToken: string, newPassword: string) {
    this.log('Password reset attempt');

    // Hash the incoming token to compare with what's in DB
    const tokenHash = passwordUtil.hashResetToken(rawToken);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { 
        tokenHash 
      },
    });

    // Same error message for both invalid and expired — 
    // don't tell attacker which one it is
    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await passwordUtil.hash(newPassword);

    // Update password
    await this.prisma.user.update({
      where: { 
        id: resetToken.userId 
      },
      data: { 
        password: hashedPassword 
      },
    });

    // Mark token as used (don't delete — keep for audit trail)
    await this.prisma.passwordResetToken.update({
      where: { 
        id: resetToken.id 
      },
      data: { 
        used: true 
      },
    });

    // Invalidate ALL refresh tokens — force re-login everywhere
    await this.prisma.refreshToken.deleteMany({
      where: { 
        userId: resetToken.userId 
      },
    });

    this.log('Password reset successfully', { userId: resetToken.userId });

    return { 
      message: 'Password reset successfully. Please log in with your new password.' 
    };
  }
}

export default new AuthService()