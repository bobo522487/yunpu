import { AppError, mapDatabaseError } from "../../lib/errors";
import { withUser } from "../../db/with-user";
import { organizationNotFound } from "./errors";
import {
  acceptInviteWithFunction,
  activateOrganization,
  createOrganizationWithFunction,
  findDefaultOrganization,
  getOrganizationSummary,
  listOrganizations,
  type OrganizationListItem,
  type OrganizationSummary,
} from "./queries";

function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return mapDatabaseError(error);
}

export async function createOrganization(
  userId: string,
  name: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const organizationId = await createOrganizationWithFunction(db, name);
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function listMyOrganizations(userId: string): Promise<OrganizationListItem[]> {
  try {
    return await withUser(userId, (db) => listOrganizations(db, userId));
  } catch (error) {
    throw asAppError(error);
  }
}

export async function resolveDefaultOrganization(
  userId: string,
): Promise<OrganizationSummary | null> {
  try {
    return await withUser(userId, (db) => findDefaultOrganization(db, userId));
  } catch (error) {
    throw asAppError(error);
  }
}

export async function activateOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const activated = await activateOrganization(db, organizationId, userId);
      if (!activated) throw organizationNotFound();
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function acceptInvite(
  userId: string,
  token: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const organizationId = await acceptInviteWithFunction(db, token);
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}
