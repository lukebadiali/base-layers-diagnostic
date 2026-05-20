import { GoogleAuth } from "google-auth-library";

const PROJECT = "bedeveloped-base-layers";
const api = process.argv[2];
if (!api) { console.error("Usage: enable-api-tmp.mjs <serviceName>"); process.exit(1); }

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();

try {
  const res = await client.request({
    url: `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${api}:enable`,
    method: "POST",
  });
  console.log(`Enabled ${api}:`, JSON.stringify(res.data).slice(0, 200));
} catch (err) {
  console.error(`Failed: ${err.response?.status ?? "ERR"}: ${JSON.stringify(err.response?.data).slice(0, 400)}`);
}
