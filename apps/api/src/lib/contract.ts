import type { Context, Env, Hono } from "hono";
import type { z } from "zod";
import {
  CONTRACT_OPERATIONS,
  type ContractOperation,
  type OpenApiOperation,
} from "../openapi/operations";
import type { ApiEnv, SessionUser } from "../types";
import { parseJson, parseParams, parseQuery, requireUser } from "./http";

type OperationForSource<S extends ContractOperation["source"]> = Extract<
  ContractOperation,
  { source: S }
>;

type MatchingOperation<
  S extends ContractOperation["source"],
  M extends string,
  R extends string,
> = Extract<ContractOperation, { source: S; method: M; route: R }>;

type InferSchemaOutput<T> = T extends z.ZodType ? z.output<T> : never;

type ParsedField<Op, K extends "params" | "query" | "body"> = Op extends Record<
  K,
  infer S
>
  ? InferSchemaOutput<S>
  : undefined;

export type ContractParsedInput<Op> = {
  params: ParsedField<Op, "params">;
  query: ParsedField<Op, "query">;
  body: ParsedField<Op, "body">;
};

export type AuthenticatedContractInput<Op> = ContractParsedInput<Op> & {
  user: SessionUser;
};

type RouteRegisterMethod = (
  path: string,
  handler: (c: Context<never>) => Response | Promise<Response>,
) => unknown;

type BindOptions = {
  /** 通配路由（如 /api/media/*）可跳过运行期命名参数校验，改由处理函数自解析。 */
  parseParams?: boolean;
  parseQuery?: boolean;
  parseBody?: boolean;
};

const OPERATION_BY_KEY = new Map<string, OpenApiOperation>();
for (const operation of CONTRACT_OPERATIONS) {
  const key = `${operation.source}::${operation.method}::${operation.route}`;
  if (OPERATION_BY_KEY.has(key)) {
    throw new Error(`Duplicate contract operation: ${key}`);
  }
  OPERATION_BY_KEY.set(key, operation);
}

const BOUND_OPERATIONS = new Set<OpenApiOperation>();

/** 返回运行期已完成契约绑定的操作集合，用于契约一致性检查。 */
export function getBoundContractOperations(): ReadonlySet<OpenApiOperation> {
  return BOUND_OPERATIONS;
}

/** 根据 `(source, method, route)` 获取唯一契约定义，缺失时立即失败。 */
export function resolveContractOperation(
  source: string,
  method: OpenApiOperation["method"],
  route: string,
): OpenApiOperation {
  const key = `${source}::${method}::${route}`;
  const operation = OPERATION_BY_KEY.get(key);
  if (!operation) {
    throw new Error(`Missing OpenAPI contract operation for ${key}`);
  }
  return operation;
}

async function parseOperationInput<E extends Env>(
  c: Context<E>,
  operation: OpenApiOperation,
  options?: BindOptions,
): Promise<{ params: unknown; query: unknown; body: unknown }> {
  const shouldParseParams =
    (options?.parseParams ?? true) && Boolean(operation.params);
  const shouldParseQuery =
    (options?.parseQuery ?? true) && Boolean(operation.query);
  const shouldParseBody =
    (options?.parseBody ?? true) && Boolean(operation.body);

  const apiCtx = c as unknown as Context<ApiEnv>;
  const params =
    shouldParseParams && operation.params
      ? parseParams(apiCtx, operation.params)
      : undefined;
  const query =
    shouldParseQuery && operation.query
      ? parseQuery(apiCtx, operation.query)
      : undefined;
  const body =
    shouldParseBody && operation.body
      ? await parseJson(apiCtx, operation.body)
      : undefined;

  return { params, query, body };
}

/**
 * 为 Hono 路由器创建同源契约绑定器：
 * - `route(method, path, handler)` 默认先执行 `requireUser(c)` 再解析契约参数；
 * - `route.public(method, path, handler)` 适用于匿名或自定义能力令牌端点。
 * 路由路径、params、query 与 body 均直接消费 `CONTRACT_OPERATIONS` 中的同一定义实例。
 */
export function createContractBinder<
  E extends Env,
  S extends ContractOperation["source"],
>(router: Hono<E>, source: S) {
  function bindAuth<
    M extends OperationForSource<S>["method"],
    R extends Extract<OperationForSource<S>, { method: M }>["route"] & string,
  >(
    method: M,
    route: R,
    handler: (
      c: Context<E>,
      input: AuthenticatedContractInput<MatchingOperation<S, M, R>>,
    ) => Response | Promise<Response>,
    options?: BindOptions,
  ): void {
    const operation = resolveContractOperation(source, method, route);
    BOUND_OPERATIONS.add(operation);

    const register = router[method] as unknown as RouteRegisterMethod;
    register.call(router, operation.route, async (rawContext) => {
      const c = rawContext as unknown as Context<E>;
      const user = requireUser(c as unknown as Context<ApiEnv>);
      const parsed = await parseOperationInput(c, operation, options);
      return handler(c, {
        user,
        ...parsed,
      } as AuthenticatedContractInput<MatchingOperation<S, M, R>>);
    });
  }

  function bindPublic<
    M extends OperationForSource<S>["method"],
    R extends Extract<OperationForSource<S>, { method: M }>["route"] & string,
  >(
    method: M,
    route: R,
    handler: (
      c: Context<E>,
      input: ContractParsedInput<MatchingOperation<S, M, R>>,
    ) => Response | Promise<Response>,
    options?: BindOptions,
  ): void {
    const operation = resolveContractOperation(source, method, route);
    BOUND_OPERATIONS.add(operation);

    const register = router[method] as unknown as RouteRegisterMethod;
    register.call(router, operation.route, async (rawContext) => {
      const c = rawContext as unknown as Context<E>;
      const parsed = await parseOperationInput(c, operation, options);
      return handler(
        c,
        parsed as ContractParsedInput<MatchingOperation<S, M, R>>,
      );
    });
  }

  return Object.assign(bindAuth, { public: bindPublic });
}
