import type { SignInInput, SignUpInput } from "@yunpu/shared";
import { mapDatabaseError } from "../../lib/errors.ts";
import { AppError } from "../../lib/errors.ts";
import { logEvent } from "../../lib/logger.ts";
import type { SessionUser } from "../../types.ts";
import { mapSignInError, mapSignUpError } from "./auth-errors.ts";

export type DefaultOrganization = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export type InviteResult = {
  accepted: boolean;
  reason?: "email_mismatch" | "expired" | "revoked" | "already_used";
};

export type SessionView = {
  user: SessionUser;
  defaultOrganization: DefaultOrganization | null;
  onboarding: boolean;
  invite?: InviteResult;
};

export type SessionResult = SessionView & { headers: Headers };

type AuthUser = { id: string; email: string; name: string };

type AuthCallResult = {
  headers: Headers;
  response?: { user?: AuthUser } | null;
};

/** Everything this module needs from Better Auth, injected at construction. */
export type SessionAuthClient = {
  api: {
    signUpEmail(input: {
      body: { email: string; password: string; name: string };
      returnHeaders: true;
    }): Promise<AuthCallResult>;
    signInEmail(input: {
      body: SignInInput;
      returnHeaders: true;
    }): Promise<AuthCallResult>;
    signOut(input: { headers: Headers; returnHeaders: true }): Promise<{
      headers: Headers;
    }>;
    getSession(input: { headers: Headers }): Promise<{
      user?: AuthUser;
      session?: { id: string };
    } | null>;
  };
};

export type ProvisionInput = {
  userId: string;
  email: string;
  inviteToken?: string;
};

export type ProvisionOutcome = {
  organization: DefaultOrganization;
  accepted: boolean;
  reason?: InviteResult["reason"];
};

export type SessionContextDependencies = {
  auth: SessionAuthClient;
  provisionUser(input: ProvisionInput): Promise<ProvisionOutcome>;
  resolveDefaultOrganization(userId: string): Promise<DefaultOrganization | null>;
  deleteAuthUser(userId: string): Promise<void>;
  revokeAuthSession(sessionId: string): Promise<void>;
};

export type SessionContextMeta = { requestId?: string };

/** Sign-out happens before the session row is gone, so the caller passes the user. */
export type SignOutMeta = SessionContextMeta & { userId?: string };

export type SessionContext = {
  register(input: SignUpInput, meta?: SessionContextMeta): Promise<SessionResult>;
  signIn(input: SignInInput, meta?: SessionContextMeta): Promise<SessionResult>;
  signOut(headers: Headers, meta?: SignOutMeta): Promise<Headers>;
  resolve(headers: Headers, user?: SessionUser | null): Promise<SessionView | null>;
};

function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
  };
}

function asAppError(error: unknown, fallback: string): AppError {
  return error instanceof AppError ? error : mapDatabaseError(error) ?? new AppError("INTERNAL", fallback, 500);
}

export function createSessionContext(
  deps: SessionContextDependencies,
): SessionContext {
  async function resolveOrganization(userId: string): Promise<DefaultOrganization | null> {
    try {
      return await deps.resolveDefaultOrganization(userId);
    } catch (error) {
      throw asAppError(error, "解析组织失败");
    }
  }

  async function compensate(
    userId: string,
    action: () => Promise<void>,
    meta: SessionContextMeta | undefined,
    event: string,
  ): Promise<void> {
    try {
      await action();
    } catch (cleanupError) {
      logEvent({
        event,
        request_id: meta?.requestId,
        user_id: userId,
        result: "failed",
        reason: cleanupError instanceof Error ? cleanupError.message : "unknown",
      });
    }
  }

  async function register(
    input: SignUpInput,
    meta?: SessionContextMeta,
  ): Promise<SessionResult> {
    let created: AuthCallResult;
    try {
      created = await deps.auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.email.split("@")[0] || "用户",
        },
        returnHeaders: true,
      });
    } catch (error) {
      throw mapSignUpError(error);
    }

    const user = created.response?.user;
    if (!user) throw new AppError("INTERNAL", "注册失败", 500);

    try {
      const outcome = await deps.provisionUser({
        userId: user.id,
        email: input.email,
        inviteToken: input.inviteToken,
      });
      logEvent({
        event: "auth.registered",
        request_id: meta?.requestId,
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
    } catch (error) {
      await compensate(
        user.id,
        () => deps.deleteAuthUser(user.id),
        meta,
        "auth.register.compensation_failed",
      );
      logEvent({
        event: "auth.registered",
        request_id: meta?.requestId,
        user_id: user.id,
        result: "failed",
        reason: error instanceof AppError ? error.code : "unknown",
      });
      throw asAppError(error, "注册失败");
    }
  }

  async function signIn(
    input: SignInInput,
    meta?: SessionContextMeta,
  ): Promise<SessionResult> {
    let result: AuthCallResult;
    try {
      result = await deps.auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        returnHeaders: true,
      });
    } catch (error) {
      logEvent({
        event: "auth.signed_in",
        request_id: meta?.requestId,
        result: "failed",
        reason: error instanceof Error ? error.message : "unknown",
      });
      const mapped = mapSignInError(error);
      if (mapped) throw mapped;
      throw error;
    }

    const user = result.response?.user;
    if (!user) throw new AppError("UNAUTHORIZED", "邮箱或密码错误", 401);

    try {
      const defaultOrganization = await resolveOrganization(user.id);
      logEvent({
        event: "auth.signed_in",
        request_id: meta?.requestId,
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
    } catch (error) {
      let sessionId: string | undefined;
      try {
        const established = await deps.auth.api.getSession({ headers: result.headers });
        sessionId = established?.session?.id;
      } catch {
        // The original resolution failure is the useful error; do not mask it.
      }
      if (sessionId) {
        await compensate(
          sessionId,
          () => deps.revokeAuthSession(sessionId),
          meta,
          "auth.sign_in.compensation_failed",
        );
      }
      logEvent({
        event: "auth.signed_in",
        request_id: meta?.requestId,
        user_id: user.id,
        result: "failed",
        reason: error instanceof AppError ? error.code : "unknown",
      });
      throw error;
    }
  }

  async function signOut(headers: Headers, meta?: SignOutMeta): Promise<Headers> {
    try {
      const result = await deps.auth.api.signOut({ headers, returnHeaders: true });
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

  async function resolve(
    headers: Headers,
    user?: SessionUser | null,
  ): Promise<SessionView | null> {
    let sessionUser = user;
    if (sessionUser === undefined) {
      const session = await deps.auth.api.getSession({ headers });
      sessionUser = session?.user ? toSessionUser(session.user) : null;
    }
    if (!sessionUser) return null;

    const defaultOrganization = await resolveOrganization(sessionUser.id);
    return {
      user: sessionUser,
      defaultOrganization,
      onboarding: defaultOrganization === null,
    };
  }

  return { register, signIn, signOut, resolve };
}
