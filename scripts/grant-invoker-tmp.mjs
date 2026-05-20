// One-shot: grant allUsers + roles/run.invoker on the named Cloud Run service.
// Uses ADC (gcloud auth application-default login). Throwaway helper for the
// Phase 6/7 deploy unstick — gcloud is Python-broken on this machine so the
// equivalent `gcloud run services add-iam-policy-binding` is unavailable.
//
// Usage: node scripts/grant-invoker-tmp.mjs <serviceName> [serviceName...]
// Service names must be lowercase (Cloud Run normalises function names to
// lowercase for DNS-safety).

import { GoogleAuth } from "google-auth-library";

const PROJECT = "bedeveloped-base-layers";
const REGION = "europe-west2";

const services = process.argv.slice(2);
if (!services.length) {
  console.error("Usage: node grant-invoker-tmp.mjs <serviceName> [serviceName...]");
  process.exit(1);
}

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();

// Resolve project number once (Cloud Run IAM API uses the project-number form
// of the resource name when looked up via list, but accepts project-ID too).
// Look up by listing services and reading the canonical name field.
const listRes = await client.request({
  url: `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services?pageSize=100`,
});
const allServices = listRes.data.services || [];
const byShortName = new Map();
for (const s of allServices) {
  const shortName = s.name.split("/").pop();
  byShortName.set(shortName, s.name);
}

for (const svc of services) {
  const fullName = byShortName.get(svc);
  if (!fullName) {
    console.error(`[${svc}] NOT FOUND in ${REGION}. Available: ${[...byShortName.keys()].join(", ")}`);
    continue;
  }
  try {
    // Cloud Run v1 API surface for IAM (v2 doesn't expose setIamPolicy/getIamPolicy
    // through the path we tried). v1 uses the namespaces/project form OR
    // projects/.../locations/.../services/... — accepts both.
    const v1Resource = `projects/${PROJECT}/locations/${REGION}/services/${svc}`;
    const getRes = await client.request({
      url: `https://run.googleapis.com/v1/${v1Resource}:getIamPolicy`,
      method: "GET",
    });
    const policy = getRes.data || {};
    policy.bindings = policy.bindings || [];
    let binding = policy.bindings.find((b) => b.role === "roles/run.invoker");
    if (!binding) {
      binding = { role: "roles/run.invoker", members: [] };
      policy.bindings.push(binding);
    }
    if (binding.members.includes("allUsers")) {
      console.log(`[${svc}] allUsers already has run.invoker — skipping`);
      continue;
    }
    binding.members.push("allUsers");
    const setRes = await client.request({
      url: `https://run.googleapis.com/v1/${v1Resource}:setIamPolicy`,
      method: "POST",
      data: { policy },
    });
    console.log(`[${svc}] OK — status ${setRes.status}`);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = typeof data === "object" ? JSON.stringify(data).slice(0, 400) : String(data).slice(0, 400);
    console.error(`[${svc}] FAILED${status ? ` (${status})` : ""}: ${msg}`);
  }
}
