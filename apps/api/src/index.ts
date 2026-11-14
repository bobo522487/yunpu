import app from "./app";
import { parseEnv } from "./env";

const config = parseEnv();

export default {
  port: config.PORT,
  fetch: app.fetch,
};
