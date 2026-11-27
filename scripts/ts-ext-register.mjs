import { registerHooks } from "node:module";

/**
 * Resolve extensionless relative imports to `.ts` (or `index.ts`) for Node's
 * type-stripping loader. Package exports that already name `*.ts` are unchanged.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        typeof specifier !== "string" ||
        !(specifier.startsWith("./") || specifier.startsWith("../")) ||
        /\.[cm]?[jt]sx?$/.test(specifier)
      ) {
        throw error;
      }

      if (
        error?.code === "ERR_MODULE_NOT_FOUND" ||
        error?.code === "ERR_UNSUPPORTED_DIR_IMPORT"
      ) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});
