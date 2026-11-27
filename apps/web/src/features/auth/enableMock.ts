import { registerMockHandler } from '../../lib/api';
import { resolveApiMode } from '../../lib/apiMode';

/** 无代理时启用 direct mock，供 AI Studio 单独运行。有代理时不注册 mock。 */
export function shouldEnableMock(): boolean {
  return resolveApiMode(import.meta.env) === 'direct-mock';
}

export async function maybeEnableMock(): Promise<boolean> {
  if (!shouldEnableMock()) return false;
  const { handleMockRequest } = await import('./mockAuth');
  registerMockHandler(handleMockRequest, { direct: true });
  return true;
}