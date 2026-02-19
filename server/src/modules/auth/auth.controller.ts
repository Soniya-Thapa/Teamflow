
import { Request, Response } from 'express';
import { BaseController } from "@/common/BaseController";
import authService from './auth.service';

//-----------------------------AUTHENTICATION CONTROLLER-----------------------------

class AuthController extends BaseController {

  //----------------------REGISTER NEW USER-----------------------------

  //POST /api/v1/auth/register
  //register is: a controller method / a function / used as a route handler
  register = this.asyncHandler(async (req: Request, res: Response) => {

    const { firstName, lastName, email, password } = req.body;

    const result = await authService.register({
      firstName,
      lastName,
      email,
      password
    });

    return this.sendCreated(res, result, "Registration Successful");
  });

  //-----------------------------LOGIN USER-----------------------------

  // POST /api/v1/auth/login
  login = this.asyncHandler(async (req: Request, res: Response) => {

    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return this.sendSuccess(res, result, "Login Successful.");
  });

  //-----------------------------REFRESH ACCESS TOKEN-----------------------------

  //POST /api/v1/auth/refresh
  refreshToken = this.asyncHandler(async (req: Request, res: Response) => {

    const { refreshToken } = req.body;

    const tokens = await authService.refreshToken(refreshToken);

    return this.sendSuccess(res, tokens, "Token Refreshed Successfully.");
  })

  //-----------------------------LOGOUT USER-----------------------------

  //POST /api/v1/auth/logout
  logout = this.asyncHandler(async (req: Request, res: Response) => {

    //The ! is called the Non-Null Assertion Operator. It means: “I am 100% sure this value is NOT null or undefined.”
    //The authMiddleware is where req.userId comes from.
    const userId = req.userId!;

    const { refreshToken } = req.body;

    await authService.logout(userId, refreshToken);

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
}

export default new AuthController();