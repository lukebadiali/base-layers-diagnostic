// One-shot: list effective org-policy constraints on the project that
// could be blocking allUsers IAM bindings.

import { GoogleAuth } from "google-auth-library";

const PROJECT = "bedeveloped-base-layers";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();

const constraints = [
  "iam.allowedPolicyMemberDomains",
  "iam.managed.allowedPolicyMembers",
  "iam.disableServiceAccountKeyCreation",
];

for (const c of constraints) {
  try {
    const res = await client.request({
      url: `https://orgpolicy.googleapis.com/v2/projects/${PROJECT}/policies/${c}`,
    });
    console.log(`\n=== ${c} ===`);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.log(`\n=== ${c} ===`);
    console.log(`  ${status ?? "ERR"}: ${typeof data === "object" ? data?.error?.message ?? JSON.stringify(data) : data ?? err.message}`);
  }
}
