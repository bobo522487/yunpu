# Import boundary fixtures (Biome `noRestrictedImports`)

These paths document three violation classes that CI Biome must reject. Do not
commit real copies under `apps/api/src/modules/`; the patterns exist only so
reviewers can paste them into a scratch file and confirm `biome check` fails.

## 1. Bare pool from a business module

```ts
// BAD — apps/api/src/modules/person/service.ts
import { businessPool } from "../../db/pool";
```

Biome rule: pattern group `**/db/pool` / `**/db/pool.ts` (FR-016).

## 2. Shared package reaching into API modules

```ts
// BAD — packages/shared/src/schemas.ts
import type { PersonView } from "../../../apps/api/src/modules/person/queries";
```

Biome rule: `packages/shared/**` override forbidding `**/apps/**` and `**/modules/**`.

## 3. Cross-module reach into another module's queries / repo / route

```ts
// BAD — apps/api/src/modules/project/service.ts
import { getPerson } from "../person/queries";
```

Biome rule: patterns for `../**/queries`, `**/*.repo.ts`, `**/*.route.ts`.

Expected: `pnpm exec biome check .` reports `lint/style/noRestrictedImports` for each.
