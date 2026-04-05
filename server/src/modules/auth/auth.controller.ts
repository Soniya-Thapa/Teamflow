
import { Request, Response } from 'express';
import { BaseController } from "@/common/BaseController";
import authService from './auth.service';

// ─────────────────────────────────────────
// COOKIE HELPER — defined once, used in login/register/refresh
// ─────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

const setAuthCookies = (res: Response, tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) => {
  res.cookie('access_token', tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: tokens.expiresIn * 1000, // expiresIn is seconds → ms
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh-token', // scoped: only sent to this endpoint
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh-token' });
};

//-----------------------------AUTHENTICATION CONTROLLER-----------------------------

class AuthController extends BaseController {

  //----------------------REGISTER NEW USER-----------------------------

  //POST /api/v1/auth/register
  //register is: a controller method / a function / used as a route handler
  // register = this.asyncHandler(async (req: Request, res: Response) => {
  //   const { firstName, lastName, email, password } = req.body;
  //   const result = await authService.register({
  //     firstName,
  //     lastName,
  //     email,
  //     password
  //   });
  //   return this.sendCreated(res,result, "Registration Successful");
  // });

  register = this.asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body;

    const result = await authService.register({
      firstName,
      lastName,
      email,
      password
    });

    // Set tokens as httpOnly cookies
    setAuthCookies(res, result.tokens);

    // Send user only — no tokens in response body
    return this.sendCreated(res, { user: result.user }, "Registration Successful");
  });

  //-----------------------------LOGIN USER-----------------------------

  // POST /api/v1/auth/login
  // login = this.asyncHandler(async (req: Request, res: Response) => {
  //   const { email, password } = req.body;
  //   const result = await authService.login(email, password);
  //   return this.sendSuccess(res, result , "Login Successful.");
  // });

  login = this.asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    // Set tokens as httpOnly cookies
    setAuthCookies(res, result.tokens);

    // Send user only — no tokens in response body
    return this.sendSuccess(res, { user: result.user }, "Login Successful.");
  });

  //-----------------------------REFRESH ACCESS TOKEN-----------------------------

  //POST /api/v1/auth/refresh
  // refreshToken = this.asyncHandler(async (req: Request, res: Response) => {

  //   const { refreshToken } = req.body;

  //   const tokens = await authService.refreshToken(refreshToken);

  //   return this.sendSuccess(res, tokens, "Token Refreshed Successfully.");
  // })

  refreshToken = this.asyncHandler(async (req: Request, res: Response) => {

    // Read from cookie — not from req.body anymore
    const token = req.cookies?.refresh_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    const tokens = await authService.refreshToken(token);

    // Set new tokens as cookies (rotation complete)
    setAuthCookies(res, tokens);

    return this.sendSuccess(res, {}, "Token Refreshed Successfully.");
  });

  //-----------------------------LOGOUT USER-----------------------------

  //POST /api/v1/auth/logout
  // logout = this.asyncHandler(async (req: Request, res: Response) => {

  //   //The ! is called the Non-Null Assertion Operator. It means: “I am 100% sure this value is NOT null or undefined.”
  //   //The authMiddleware is where req.userId comes from.
  //   const userId = req.userId!;

  //   const { refreshToken } = req.body;

  //   await authService.logout(userId, refreshToken);

  //   return this.sendSuccess(res, null, "Logout Successful.");
  // });

  logout = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;

    // Read refresh token from cookie — not from req.body
    const token = req.cookies?.refresh_token;

    await authService.logout(userId, token);

    // Clear both cookies
    clearAuthCookies(res);

    return this.sendSuccess(res, null, "Logout Successful.");
  });

  //-----------------------------GET PROFILE-----------------------------

  //GET /api/v1/auth/me
  getProfile = this.asyncHandler(async (req: Request, res: Response) => {

    const userId = req.userId!;

    const user = await authService.getProfile(userId);

    return this.sendSuccess(res, user);
  });

  //-----------------------------CHANGE PASSWORD-----------------------------

  //POST /api/v1/auth/change-password
  changePassword = this.asyncHandler(async (req: Request, res: Response) => {

    const userId = req.userId!;

    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(userId, currentPassword, newPassword);

    return this.sendSuccess(res, result, "Password Changed Successfully");
  });

  //-----------------------------REQUEST PASSWORD RESET-----------------------------

  // POST /api/v1/auth/forgot-password
  forgotPassword = this.asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await authService.requestPasswordReset(email);

    return this.sendSuccess(res, result, 'Password reset request processed.');
  });

  //-----------------------------RESET PASSWORD-----------------------------

  // POST /api/v1/auth/reset-password
  resetPassword = this.asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    const result = await authService.resetPassword(token, newPassword);

    return this.sendSuccess(res, result, 'Password reset successful.');
  });

  // POST /api/v1/auth/send-verification
  sendVerificationEmail = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const result = await authService.sendVerificationEmail(userId);
    return this.sendSuccess(res, result, 'Verification email sent');
  });

  // GET /api/v1/auth/verify-email?token=...
  verifyEmail = this.asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query as { token: string };
    const result = await authService.verifyEmail(token);
    return this.sendSuccess(res, result, 'Email verified successfully');
  });

}

export default new AuthController();