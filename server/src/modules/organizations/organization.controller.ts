
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

  //-----------------------------GET ALL ORGANIZATION AS PER USER-----------------------------

  // GET /api/v1/organizations
  // Returns all organizations the logged-in user belongs to (paginated)

  getUserOrganizations = this.asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { page, limit } = this.getPagination(req);

      const result = await organizationService.getUserOrganizations(
        userId,
        page,
        limit,
      );

      return this.sendSuccess(res, result, 'Organizations retrieved successfully');
    },
  );

  //-----------------------------CREATE ORGANIZATION-----------------------------

  // POST / api / v1 / organizations
  // Creates a new organization.Authenticated user becomes OWNER.

  createOrganization = this.asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { name, slug, logo } = req.body;

      const organization = await organizationService.createOrganization(
        userId,
        { name, slug, logo },
      );

      return this.sendCreated(res, organization, 'Organization created successfully');
    },
  );

  //-----------------------------GET ORGANIZATION BY ID (SINGLE)-----------------------------

  // GET / api / v1 / organizations /: id
  // Returns a specific organization.User must be an active member.

  getOrganization = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params; // this line of code means the id is sent through the url in the postman.
      const userId = req.userId!;

      const organization = await organizationService.getOrganizationById(
        id as string,
        userId,
      );

      return this.sendSuccess(res, organization, 'Organization retrieved successfully');
    },
  );

  //-----------------------------UPDATE ORGANIZATION-----------------------------

  // PATCH / api / v1 / organizations /: id
  // Updates organization name or logo.OWNER or ADMIN only.

  updateOrganization = this.asyncHandler(
    async (req: Request, res: Response) => {
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
    },
  );

  //-----------------------------DELETE ORGANIZATION-----------------------------

  // DELETE / api / v1 / organizations /: id
  // Soft deletes organization.OWNER only.

  deleteOrganization = this.asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.userId!;

      const result = await organizationService.deleteOrganization(
        id as string,
        userId
      );

      return this.sendSuccess(res, result, 'Organization deleted successfully');
    },
  );
}

export default new OrganizationController();
