import { Hono } from "hono";
import app from "./app";
import media from "./media";
import { initStorage } from "./storage";
import { config } from "./config";

const env = config();

await initStorage({
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
});

const routes = new Hono();
routes.route("/", app);
routes.route("/", media);

export default {
  port: env.PORT,
  fetch: routes.fetch,
};
