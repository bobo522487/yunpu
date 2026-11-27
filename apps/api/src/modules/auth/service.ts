import type { SignInInput, SignUpInput } from "@yunpu/shared";
import { AppError, tryMapDatabaseError } from "../../lib/errors";
import { logEvent } from "../../lib/logger";
import type { SessionUser } from "../../types";
import {
  type OrganizationSummary,
  resolveDefaultOrganization,
} from "../organization/service";
import { auth } from "./better-auth";
import { mapSignInError, mapSignUpError } from "./errors";
import {
  deleteAuthUser,
  provisionDefaultOrganization,
  provisionWithInvite,
} from "./provisioning";

export type InviteResult = {
  accepted: boolean;
  reason?: "email_mismatch" | "expired" | "revoked" | "already_used";
};

export type AuthView = {
  user: SessionUser;
  defaultOrganization: OrganizationSummary | null;
  onboarding: boolean;
  invite?: InviteResult;
};

export type AuthResponse = AuthView & { headers: Headers };

type BetterAuthUser = {
  id: string;
  email: string;
  name: string;
};

function toSessionUser(user: BetterAuthUser): SessionUser {
  return {
    id: user.id,
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
  };
}

export async function register(
  input: SignUpInput,
  requestId?: string,
): Promise<AuthResponse> {
  let created: { headers: Headers; response: { user: BetterAuthUser } };
  try {
    created = (await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.email.split("@")[0] || "用户",
      },
      returnHeaders: true,
    })) as unknown as { headers: Headers; response: { user: BetterAuthUser } };
  } catch (error) {
    throw mapSignUpError(error);
  }

  const user = created.response?.user;
  if (!user) throw new AppError("INTERNAL", "注册失败");

  try {
    if (input.inviteToken) {
      const outcome = await provisionWithInvite(
        user.id,
        input.email,
        input.inviteToken,
      );
      logEvent({
        event: "auth.registered",
        request_id: requestId,
        user_id: user.id,
        organization_id: outcome.organization.id,
        result: "ok",
        reason: outcome.accepted ? "invite_accepted" : outcome.reason,
      });
      return {
        user: toSessionUser(user),
        defaultOrganization: outcome.organization,
        onboarding: false,
        invite: { accepted: outcome.accepted, reason: outcome.reason },
        headers: created.headers,
      };
    }

    const organization = await provisionDefaultOrganization(
      user.id,
      input.email,
    );
    logEvent({
      event: "auth.registered",
      request_id: requestId,
      user_id: user.id,
      organization_id: organization.id,
      result: "ok",
    });
    return {
      user: toSessionUser(user),
      defaultOrganization: organization,
      onboarding: false,
      invite: { accepted: false },
      headers: created.headers,
    };
  } catch (error) {
    try {
      await deleteAuthUser(user.id);
    } catch (cleanupError) {
      logEvent({
        event: "auth.register.compensation_failed",
        request_id: requestId,
        user_id: user.id,
        result: "failed",
        reason:
          cleanupError instanceof Error ? cleanupError.message : "unknown",
      });
    }
    const mapped =
      error instanceof AppError ? error : tryMapDatabaseError(error);
    logEvent({
      event: "auth.registered",
      request_id: requestId,
      user_id: user.id,
      result: "failed",
      reason: mapped ? mapped.code : "unknown",
    });
    if (mapped) throw mapped;
    throw error;
  }
}

export async function signIn(
  input: SignInInput,
  requestId?: string,
): Promise<AuthResponse> {
  let result: { headers: Headers; response: { user: BetterAuthUser } };
  try {
    result = (await auth.api.signInEmail({
      body: { email: input.email, password: input.password },
      returnHeaders: true,
    })) as unknown as { headers: Headers; response: { user: BetterAuthUser } };
  } catch (error) {
    logEvent({
      event: "auth.signed_in",
      request_id: requestId,
      result: "failed",
      reason: error instanceof Error ? error.message : "unknown",
    });
    const mapped = mapSignInError(error);
    if (mapped) throw mapped;
    throw error;
  }

  const user = result.response?.user;
  if (!user) throw new AppError("UNAUTHORIZED", "邮箱或密码错误");

  const defaultOrganization = await resolveDefaultOrganization(user.id);
  logEvent({
    event: "auth.signed_in",
    request_id: requestId,
    user_id: user.id,
    organization_id: defaultOrganization?.id,
    result: "ok",
  });

  return {
    user: toSessionUser(user),
    defaultOrganization,
    onboarding: defaultOrganization === null,
    headers: result.headers,
  };
}

export type SignOutMeta = { requestId?: string; userId?: string };

export async function signOut(
  headers: Headers,
  meta?: SignOutMeta,
): Promise<Headers> {
  try {
    const result = (await auth.api.signOut({
      headers,
      returnHeaders: true,
    })) as unknown as { headers: Headers };
    logEvent({
      event: "auth.signed_out",
      request_id: meta?.requestId,
      user_id: meta?.userId,
      result: "ok",
    });
    return result.headers;
  } catch (error) {
    logEvent({
      event: "auth.signed_out",
      request_id: meta?.requestId,
      user_id: meta?.userId,
      result: "failed",
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

export async function getSessionView(
  user: SessionUser | null,
): Promise<AuthView | null> {
  if (!user) return null;

  const defaultOrganization = await resolveDefaultOrganization(user.id);
  return {
    user,
    defaultOrganization,
    onboarding: defaultOrganization === null,
  };
}
