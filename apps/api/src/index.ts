import { Hono } from "hono";
import app from "./app";
import media from "./media";
import { initStorage } from "./storage";
import { parseEnv } from "./env";

const config = parseEnv();

await initStorage({
  endpoint: config.S3_ENDPOINT,
  bucket: config.S3_BUCKET,
  accessKeyId: config.S3_ACCESS_KEY_ID,
  secretAccessKey: config.S3_SECRET_ACCESS_KEY,
});

const routes = new Hono();
routes.route("/", app);
routes.route("/", media);

export default {
  port: config.PORT,
  fetch: routes.fetch,
};
