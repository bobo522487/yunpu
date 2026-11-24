import { businessPool } from "./with-tenant-transaction";

export { businessPool as pool, businessPool };

export async function closePools(): Promise<void> {
  const { authPool } = await import("../auth/index.ts");
  await Promise.allSettled([businessPool.end(), authPool.end()]);
}
