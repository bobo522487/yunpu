import {
  AcceptInviteSchema,
  ChangePasswordSchema,
  CreateInviteSchema,
  CreateOrganizationSchema,
  CreatePersonSchema,
  CreateProjectSchema,
  CreateRelationSchema,
  ListProjectsQuerySchema,
  MEMBER_ROLES,
  ORGANIZATION_STATUSES,
  PageQuerySchema,
  PERSON_SEXES,
  PROJECT_COLOR_THEMES,
  PROJECT_STATUSES,
  SignInSchema,
  SignUpSchema,
  SubgraphQuerySchema,
  TransferOwnerSchema,
  UpdateAccountSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
  UpdatePersonSchema,
  UpdateProjectSchema,
} from "@yunpu/shared";
import { z } from "zod";

export type OpenApiOperation = {
  method: "get" | "post" | "patch" | "put" | "delete";
  route: string;
  path: string;
  source: string;
  summary: string;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  successStatus: number;
  successContentType?: string;
  success: z.ZodType;
  errors?: z.ZodType;
};

const id = z.uuid();
const timestamp = z.iso.datetime();
const nullableText = z.string().nullable();

export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

const okOnly = z.object({ ok: z.literal(true) });
const okData = <T extends z.ZodType>(data: T) =>
  z.object({ ok: z.literal(true), data });

const AccountSchema = z.object({
  id,
  email: z.email(),
  name: z.string(),
});

const OrganizationSummarySchema = z.object({
  id,
  name: z.string(),
  role: z.enum(MEMBER_ROLES),
  isOwner: z.boolean(),
  lastUsedAt: timestamp.nullable().optional(),
});

const OrganizationDetailSchema = OrganizationSummarySchema.omit({
  role: true,
  lastUsedAt: true,
}).extend({
  status: z.enum(ORGANIZATION_STATUSES),
  ownerUserId: id,
  myRole: z.enum(MEMBER_ROLES),
  memberCount: z.number().int().nonnegative(),
  pendingInviteCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
});

const MemberSchema = z.object({
  userId: id,
  name: z.string(),
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  isOwner: z.boolean(),
  joinedAt: timestamp,
});

const InviteSchema = z.object({
  id,
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  status: z.string(),
  expiresAt: timestamp,
  createdAt: timestamp,
});

const ProjectSchema = z.object({
  id,
  organizationId: id,
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  surname: nullableText,
  hallName: nullableText,
  originText: nullableText,
  description: nullableText,
  colorTheme: z.enum(PROJECT_COLOR_THEMES),
  projectLevel: z.number().int(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const PersonSchema = z.object({
  id,
  projectId: id,
  displayName: z.string(),
  sex: z.enum(PERSON_SEXES),
  surname: nullableText,
  birthYear: z.number().int().nullable(),
  deathYear: z.number().int().nullable(),
  isLiving: z.boolean(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const RelationSchema = z.object({
  id,
  projectId: id,
  fromPersonId: id,
  toPersonId: id,
  kind: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const pageOf = <T extends z.ZodType>(item: T, key = "items") =>
  z.object({
    [key]: z.array(item),
    nextCursor: z.string().nullable(),
  });

const AuthDataSchema = z.object({
  user: AccountSchema,
  defaultOrganization: OrganizationSummarySchema.nullable(),
  invite: z.unknown().optional(),
  onboarding: z.boolean().optional(),
});

const SessionDataSchema = z.object({
  user: AccountSchema.nullable(),
  defaultOrganization: OrganizationSummarySchema.nullable(),
  onboarding: z.boolean(),
});

const OrgParams = z.object({ organizationId: id });
const ProjectParams = z.object({ projectId: id });
const PersonParams = z.object({
  projectId: id,
  personId: id,
});
const RelationParams = z.object({
  projectId: id,
  relationId: id,
});
const MemberParams = z.object({
  organizationId: id,
  userId: id,
});
const InviteParams = z.object({
  organizationId: id,
  inviteId: id,
});

const auth = "apps/api/src/modules/auth/router.ts";
const account = "apps/api/src/modules/account/router.ts";
const organization = "apps/api/src/modules/organization/router.ts";
const project = "apps/api/src/modules/project/router.ts";
const person = "apps/api/src/modules/person/router.ts";
const media = "apps/api/src/media.ts";

export const OPENAPI_OPERATIONS: OpenApiOperation[] = [
  {
    method: "get",
    route: "/api/health",
    path: "/api/health",
    source: "apps/api/src/app.ts",
    summary: "进程存活探测",
    successStatus: 200,
    success: z.object({
      ok: z.boolean(),
      checks: z.object({
        process: z.literal("up"),
        database: z.enum(["up", "down"]),
      }),
    }),
  },
  {
    method: "get",
    route: "/api/ready",
    path: "/api/ready",
    source: "apps/api/src/app.ts",
    summary: "依赖就绪探测",
    successStatus: 200,
    success: z.object({
      ok: z.boolean(),
      checks: z.record(z.string(), z.enum(["up", "down"])),
      version: z.string().optional(),
      reason: z.string().optional(),
    }),
  },
  {
    method: "post",
    route: "/sign-up",
    path: "/api/v1/auth/sign-up",
    source: auth,
    summary: "注册账号",
    body: SignUpSchema,
    successStatus: 201,
    success: okData(AuthDataSchema),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/sign-in",
    path: "/api/v1/auth/sign-in",
    source: auth,
    summary: "登录账号",
    body: SignInSchema,
    successStatus: 200,
    success: okData(AuthDataSchema),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/sign-out",
    path: "/api/v1/auth/sign-out",
    source: auth,
    summary: "退出登录",
    successStatus: 200,
    success: okData(z.object({ signedOut: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/session",
    path: "/api/v1/auth/session",
    source: auth,
    summary: "读取当前会话",
    successStatus: 200,
    success: okData(SessionDataSchema),
  },
  {
    method: "get",
    route: "/account",
    path: "/api/v1/account",
    source: account,
    summary: "读取当前账号",
    successStatus: 200,
    success: okData(AccountSchema),
    errors: ErrorResponseSchema,
  },
  {
    method: "patch",
    route: "/account",
    path: "/api/v1/account",
    source: account,
    summary: "更新当前账号显示名",
    body: UpdateAccountSchema,
    successStatus: 200,
    success: okData(AccountSchema),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/account/password",
    path: "/api/v1/account/password",
    source: account,
    summary: "修改密码",
    body: ChangePasswordSchema,
    successStatus: 200,
    success: okData(z.object({ changed: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/organizations",
    path: "/api/v1/organizations",
    source: organization,
    summary: "列出可见组织",
    successStatus: 200,
    success: okData(
      z.object({
        organizations: z.array(OrganizationSummarySchema),
        defaultOrganizationId: id.nullable(),
      }),
    ),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/organizations",
    path: "/api/v1/organizations",
    source: organization,
    summary: "创建组织",
    body: CreateOrganizationSchema,
    successStatus: 201,
    success: okData(z.object({ organization: OrganizationSummarySchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/organizations/:organizationId",
    path: "/api/v1/organizations/{organizationId}",
    source: organization,
    summary: "读取组织详情",
    params: OrgParams,
    successStatus: 200,
    success: okData(z.object({ organization: OrganizationDetailSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "patch",
    route: "/organizations/:organizationId",
    path: "/api/v1/organizations/{organizationId}",
    source: organization,
    summary: "更新组织",
    params: OrgParams,
    body: UpdateOrganizationSchema,
    successStatus: 200,
    success: okData(z.object({ organization: OrganizationDetailSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/organizations/:organizationId/leave",
    path: "/api/v1/organizations/{organizationId}/leave",
    source: organization,
    summary: "离开组织",
    params: OrgParams,
    successStatus: 200,
    success: okData(z.object({ left: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "put",
    route: "/organizations/:organizationId/owner",
    path: "/api/v1/organizations/{organizationId}/owner",
    source: organization,
    summary: "转让组织所有权",
    params: OrgParams,
    body: TransferOwnerSchema,
    successStatus: 200,
    success: okData(z.object({ ownerUserId: id })),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/organizations/:organizationId/activate",
    path: "/api/v1/organizations/{organizationId}/activate",
    source: organization,
    summary: "激活组织",
    params: OrgParams,
    successStatus: 200,
    success: okData(z.object({ organization: OrganizationSummarySchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/invites/accept",
    path: "/api/v1/invites/accept",
    source: organization,
    summary: "接受邀请",
    body: AcceptInviteSchema,
    successStatus: 200,
    success: okData(
      z.object({
        organization: OrganizationSummarySchema,
        defaultOrganizationChanged: z.literal(true),
      }),
    ),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/organizations/:organizationId/members",
    path: "/api/v1/organizations/{organizationId}/members",
    source: organization,
    summary: "分页列出成员",
    params: OrgParams,
    query: PageQuerySchema,
    successStatus: 200,
    success: okData(pageOf(MemberSchema)),
    errors: ErrorResponseSchema,
  },
  {
    method: "patch",
    route: "/organizations/:organizationId/members/:userId",
    path: "/api/v1/organizations/{organizationId}/members/{userId}",
    source: organization,
    summary: "更新成员角色",
    params: MemberParams,
    body: UpdateMemberRoleSchema,
    successStatus: 200,
    success: okData(z.object({ member: MemberSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "delete",
    route: "/organizations/:organizationId/members/:userId",
    path: "/api/v1/organizations/{organizationId}/members/{userId}",
    source: organization,
    summary: "移除成员",
    params: MemberParams,
    successStatus: 200,
    success: okData(z.object({ removed: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/organizations/:organizationId/invites",
    path: "/api/v1/organizations/{organizationId}/invites",
    source: organization,
    summary: "分页列出邀请",
    params: OrgParams,
    query: PageQuerySchema,
    successStatus: 200,
    success: okData(pageOf(InviteSchema)),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/organizations/:organizationId/invites",
    path: "/api/v1/organizations/{organizationId}/invites",
    source: organization,
    summary: "创建邀请",
    params: OrgParams,
    body: CreateInviteSchema,
    successStatus: 201,
    success: okData(
      z.object({
        invite: InviteSchema,
        inviteUrl: z.string(),
      }),
    ),
    errors: ErrorResponseSchema,
  },
  {
    method: "delete",
    route: "/organizations/:organizationId/invites/:inviteId",
    path: "/api/v1/organizations/{organizationId}/invites/{inviteId}",
    source: organization,
    summary: "撤销邀请",
    params: InviteParams,
    successStatus: 200,
    success: okData(z.object({ revoked: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/organizations/:organizationId/projects",
    path: "/api/v1/organizations/{organizationId}/projects",
    source: project,
    summary: "分页列出项目",
    params: OrgParams,
    query: ListProjectsQuerySchema,
    successStatus: 200,
    success: okData(pageOf(ProjectSchema)),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/organizations/:organizationId/projects",
    path: "/api/v1/organizations/{organizationId}/projects",
    source: project,
    summary: "创建项目",
    params: OrgParams,
    body: CreateProjectSchema,
    successStatus: 201,
    success: okData(z.object({ project: ProjectSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/projects/:projectId",
    path: "/api/v1/projects/{projectId}",
    source: project,
    summary: "读取项目",
    params: ProjectParams,
    successStatus: 200,
    success: okData(z.object({ project: ProjectSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "patch",
    route: "/projects/:projectId",
    path: "/api/v1/projects/{projectId}",
    source: project,
    summary: "按版本号更新项目",
    params: ProjectParams,
    body: UpdateProjectSchema,
    successStatus: 200,
    success: okData(z.object({ project: ProjectSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "delete",
    route: "/projects/:projectId",
    path: "/api/v1/projects/{projectId}",
    source: project,
    summary: "删除项目",
    params: ProjectParams,
    successStatus: 200,
    success: okData(z.object({ deleted: z.literal(true) })),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/projects/:projectId/persons",
    path: "/api/v1/projects/{projectId}/persons",
    source: person,
    summary: "创建人物",
    params: ProjectParams,
    body: CreatePersonSchema,
    successStatus: 201,
    success: okData(z.object({ person: PersonSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/projects/:projectId/persons",
    path: "/api/v1/projects/{projectId}/persons",
    source: person,
    summary: "分页列出人物",
    params: ProjectParams,
    query: PageQuerySchema,
    successStatus: 200,
    success: okData(pageOf(PersonSchema, "persons")),
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/projects/:projectId/persons/:personId",
    path: "/api/v1/projects/{projectId}/persons/{personId}",
    source: person,
    summary: "读取人物",
    params: PersonParams,
    successStatus: 200,
    success: okData(z.object({ person: PersonSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "patch",
    route: "/projects/:projectId/persons/:personId",
    path: "/api/v1/projects/{projectId}/persons/{personId}",
    source: person,
    summary: "按版本号更新人物",
    params: PersonParams,
    body: UpdatePersonSchema,
    successStatus: 200,
    success: okData(z.object({ person: PersonSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "delete",
    route: "/projects/:projectId/persons/:personId",
    path: "/api/v1/projects/{projectId}/persons/{personId}",
    source: person,
    summary: "删除人物",
    params: PersonParams,
    successStatus: 200,
    success: okOnly,
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/projects/:projectId/relations",
    path: "/api/v1/projects/{projectId}/relations",
    source: person,
    summary: "创建人物关系",
    params: ProjectParams,
    body: CreateRelationSchema,
    successStatus: 201,
    success: okData(z.object({ relation: RelationSchema })),
    errors: ErrorResponseSchema,
  },
  {
    method: "delete",
    route: "/projects/:projectId/relations/:relationId",
    path: "/api/v1/projects/{projectId}/relations/{relationId}",
    source: person,
    summary: "删除人物关系",
    params: RelationParams,
    successStatus: 200,
    success: okOnly,
    errors: ErrorResponseSchema,
  },
  {
    method: "get",
    route: "/projects/:projectId/subgraph",
    path: "/api/v1/projects/{projectId}/subgraph",
    source: person,
    summary: "读取人物关系子图",
    params: ProjectParams,
    query: SubgraphQuerySchema,
    successStatus: 200,
    success: okData(
      z.object({
        rootPersonId: id,
        persons: z.array(PersonSchema),
        relations: z.array(RelationSchema),
        hasMoreAncestors: z.boolean(),
        hasMoreDescendants: z.boolean(),
      }),
    ),
    errors: ErrorResponseSchema,
  },
  {
    method: "post",
    route: "/api/media",
    path: "/api/media",
    source: media,
    summary: "上传媒体对象",
    successStatus: 201,
    success: z.object({ ok: z.literal(true), key: z.string() }),
    errors: z.object({ ok: z.literal(false), reason: z.string() }),
  },
  {
    method: "get",
    route: "/api/media/*",
    path: "/api/media/{path}",
    source: media,
    summary: "读取媒体对象",
    params: z.object({ path: z.string() }),
    successStatus: 200,
    successContentType: "application/octet-stream",
    success: z.string().describe("binary media bytes"),
    errors: z.object({ ok: z.literal(false), reason: z.string() }),
  },
];

export const OPENAPI_SCHEMAS: Record<string, z.ZodType> = {
  Account: AccountSchema,
  OrganizationSummary: OrganizationSummarySchema,
  OrganizationDetail: OrganizationDetailSchema,
  Member: MemberSchema,
  Invite: InviteSchema,
  Project: ProjectSchema,
  Person: PersonSchema,
  Relation: RelationSchema,
  ErrorResponse: ErrorResponseSchema,
  OrgParams,
  ProjectParams,
  PersonParams,
  RelationParams,
  MemberParams,
  InviteParams,
};
