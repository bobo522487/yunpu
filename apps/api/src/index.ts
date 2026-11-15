import app from "./app";
import { initStorage } from "./storage";
import { config } from "./config";

const env = config();

await initStorage({
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
