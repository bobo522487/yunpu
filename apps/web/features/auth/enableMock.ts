/**
 * Mock 后端显式开关。
 *
 * Mock（features/auth/mockAuth + features/dashboard/mockConsole）只在
 * 开发模式且显式设置 VITE_ENABLE_MOCK=1 时注册。生产构建中 import.meta.env.DEV
 * 为 false，动态 import 的整条 mock 链会被打包器静态消除，不会进入产物。
 */
export function shouldEnableMock(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK === '1';
}

/** 开发期按需加载并注册 mock 后端；返回是否实际启用。 */
export async function maybeEnableMock(): Promise<boolean> {
  if (!shouldEnableMock()) return false;
  const { registerMockHandler } = await import('../../lib/api');
  const { handleMockRequest } = await import('./mockAuth');
  registerMockHandler(handleMockRequest);
  return true;
}
