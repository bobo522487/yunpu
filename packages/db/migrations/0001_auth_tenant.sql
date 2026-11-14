CREATE SCHEMA IF NOT EXISTS "auth";

CREATE TABLE "auth"."user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "ck_auth_user_name_not_blank" CHECK (btrim("name") <> ''),
	CONSTRAINT "ck_auth_user_email_normalized" CHECK ("email" = lower(btrim("email")))
);

CREATE TABLE "auth"."session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "auth"."account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auth"."verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "organization_member" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);

CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" bytea NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "auth"."account" ADD CONSTRAINT "fk_auth_account_user" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;

ALTER TABLE "auth"."session" ADD CONSTRAINT "fk_auth_session_user" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;

ALTER TABLE "invite" ADD CONSTRAINT "fk_invite_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;

ALTER TABLE "invite" ADD CONSTRAINT "fk_invite_invited_by" FOREIGN KEY ("invited_by") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;

ALTER TABLE "organization_member" ADD CONSTRAINT "fk_organization_member_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;

ALTER TABLE "organization_member" ADD CONSTRAINT "fk_organization_member_user" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT;

ALTER TABLE "organization" ADD CONSTRAINT "fk_organization_owner" FOREIGN KEY ("id", "owner_user_id") REFERENCES "organization_member" ("organization_id", "user_id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization" ADD CONSTRAINT "ck_organization_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "organization" ADD CONSTRAINT "ck_organization_status" CHECK ("status" IN ('active', 'suspended', 'archived'));

ALTER TABLE "organization_member" ADD CONSTRAINT "ck_organization_member_role" CHECK ("role" IN ('admin', 'editor', 'viewer'));

ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_email" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_role" CHECK ("role" IN ('admin', 'editor', 'viewer'));
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_status" CHECK ("status" IN ('pending', 'accepted', 'revoked'));
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_token_hash_len" CHECK (octet_length("token_hash") = 32);
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_expires_after_created" CHECK ("expires_at" > "created_at");
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_accepted_at" CHECK (("status" = 'accepted') = ("accepted_at" IS NOT NULL));
ALTER TABLE "invite" ADD CONSTRAINT "ck_invite_revoked_at" CHECK (("status" = 'revoked') = ("revoked_at" IS NOT NULL));

ALTER TABLE "audit_log" ADD CONSTRAINT "ck_audit_log_action_not_blank" CHECK (btrim("action") <> '');
ALTER TABLE "audit_log" ADD CONSTRAINT "ck_audit_log_entity_type" CHECK ("entity_type" IN ('organization', 'organization_member', 'invite', 'audit_log'));

CREATE INDEX "idx_auth_account_user" ON "auth"."account" USING btree ("user_id");
CREATE INDEX "idx_auth_session_user" ON "auth"."session" USING btree ("user_id");
CREATE INDEX "idx_auth_user_email" ON "auth"."user" USING btree ("email");
CREATE INDEX "idx_auth_verification_identifier" ON "auth"."verification" USING btree ("identifier");
CREATE INDEX "idx_audit_log_org_created" ON "audit_log" USING btree ("organization_id", "created_at");
CREATE INDEX "idx_audit_log_project_created" ON "audit_log" USING btree ("project_id", "created_at");
CREATE INDEX "idx_audit_log_entity" ON "audit_log" USING btree ("organization_id", "entity_type", "entity_id");
CREATE UNIQUE INDEX "uk_invite_token_hash" ON "invite" USING btree ("token_hash");
CREATE UNIQUE INDEX "uq_invite_pending_email" ON "invite" USING btree ("organization_id", "email") WHERE status = 'pending';
CREATE INDEX "idx_invite_org_status" ON "invite" USING btree ("organization_id", "status");
CREATE INDEX "idx_invite_invited_by" ON "invite" USING btree ("invited_by");
CREATE INDEX "idx_organization_owner" ON "organization" USING btree ("owner_user_id");
CREATE INDEX "idx_organization_member_user" ON "organization_member" USING btree ("user_id");
