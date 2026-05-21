// One-shot: list Cloud Run services in the project/region to discover what the
// actual service names are for our Gen 2 functions (function name != service
// name in some Gen 2 deployments).

import { GoogleAuth } from "google-auth-library";

const PROJECT = "bedeveloped-base-layers";
const REGION = "europe-west2";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();

const res = await client.request({
  url: `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services?pageSize=100`,
});
const services = res.data.services || [];
console.log(`Found ${services.length} Cloud Run services in ${REGION}:`);
for (const s of services) {
  const shortName = s.name.split("/").pop();
  const url = s.uri;
  console.log(`  - ${shortName}  (uri: ${url})`);
}
