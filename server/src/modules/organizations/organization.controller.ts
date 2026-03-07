
// @file organization.controller.ts
// @description HTTP request handlers for Organization endpoints

// Controllers are intentionally thin:
//   1. Extract data from request (body, params, query)
//   2. Call the service
//   3. Send the response

// All business logic and access control lives in organization.service.ts

import { Request, Response } from 'express';
import { BaseController } from "@/common/BaseController";
import organizationService from './organization.service';

class OrganizationController extends BaseController {

  //-----------------------------GET ALL ORGANIZATION AS PER USER---------------------------------------------------------------------------------------

  // GET /api/v1/organizations
  // Returns all organizations the logged-in user belongs to (paginated)

  getUserOrganizations = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { page, limit } = this.getPagination(req);

    const result = await organizationService.getUserOrganizations(
      userId,
      page,
      limit,
    );

    return this.sendSuccess(res, result, 'Organizations retrieved successfully');
  });

  //-----------------------------CREATE ORGANIZATION---------------------------------------------------------------------------------------

  // POST / api / v1 / organizations
  // Creates a new organization.Authenticated user becomes OWNER.

  createOrganization = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { name, slug, logo } = req.body;

    const organization = await organizationService.createOrganization(
      userId,
      { name, slug, logo },
    );

    return this.sendCreated(res, organization, 'Organization created successfully');
  });

  //-----------------------------GET ORGANIZATION BY ID (SINGLE)---------------------------------------------------------------------------------------

  // GET / api / v1 / organizations /: id
  // Returns a specific organization.User must be an active member.

  getOrganization = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // this line of code means the id is sent through the url in the postman.
    const userId = req.userId!;

    const organization = await organizationService.getOrganizationById(
      id as string,
      userId,
    );

    return this.sendSuccess(res, organization, 'Organization retrieved successfully');
  });

  //-----------------------------UPDATE ORGANIZATION---------------------------------------------------------------------------------------

  // PATCH / api / v1 / organizations /: id
  // Updates organization name or logo.OWNER or ADMIN only.

  updateOrganization = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    // Why no destructuring like { name, logo }?
    // Because user may only send name or logo or both.
    // You don’t know in advance which fields they will send.
    // If you destructure like { name, logo } = req.body:
    // And user sends only { logo: "new.png" }
    // name will be undefined → but if you do { name, logo } and pass { name, logo } directly to Prisma update, Prisma might try to update name to undefined (sometimes causing issues).
    // By just passing req.body as data, you let Prisma update only the fields actually present

    const data = req.body;

    const organization = await organizationService.updateOrganization(
      id as string,
      userId,
      data,
    );

    return this.sendSuccess(res, organization, 'Organization updated successfully');
  });

  //-----------------------------DELETE ORGANIZATION---------------------------------------------------------------------------------------

  // DELETE / api / v1 / organizations /: id
  // Soft deletes organization.OWNER only.

  deleteOrganization = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const result = await organizationService.deleteOrganization(
      id as string,
      userId
    );

    return this.sendSuccess(res, result, 'Organization deleted successfully');
  });

  //----------------------------- GET SETTINGS ---------------------------------------------------------------------------------------

  // GET /api/v1/organizations/:id/settings
  // Get organization branding and feature settings

  getSettings = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const settings = await organizationService.getOrganizationSettings(id as string, userId);

    return this.sendSuccess(res, settings, 'Settings retrieved successfully');
  });

  //----------------------------- UPDATE SETTINGS ---------------------------------------------------------------------------------------

  // PATCH /api/v1/organizations/:id/settings
  // Update organization branding and feature settings

  updateSettings = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;
    const data = req.body;

    const settings = await organizationService.updateOrganizationSettings(id as string, userId, data);

    return this.sendSuccess(res, settings, 'Settings updated successfully');
  });

  //----------------------------- GET USAGE ---------------------------------------------------------------------------------------

  // GET /api/v1/organizations/:id/usage
  // Get current usage vs plan limits

  getUsage = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const usage = await organizationService.getOrganizationUsage(id as string, userId);

    return this.sendSuccess(res, usage, 'Usage retrieved successfully');
  });

  //----------------------------- UPDATE STATUS (owner action) ---------------------------------------------------------------------------------------

  // PATCH / api / v1 / organizations /: id / status
  // Owner suspends or reactivates their organization

  updateStatus = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;
    const { status } = req.body;

    const result = await organizationService.updateOrganizationStatus(id as string, userId, status);

    return this.sendSuccess(res, result, `Organization ${status.toLowerCase()} successfully`);
  });

  //----------------------------- UPDATE ONBOARDING ---------------------------------------------------------------------------------------

  // PATCH / api / v1 / organizations /: id / onboarding
  // Update onboarding progress(called by frontend after each step)

  updateOnboarding = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;
    const { onboardingStep } = req.body;

    const settings = await organizationService.updateOnboarding(id as string, userId, onboardingStep);

    return this.sendSuccess(res, settings, 'Onboarding progress updated');
  });
}

export default new OrganizationController();
