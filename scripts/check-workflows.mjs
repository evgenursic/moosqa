import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const endpointWorkflows = [
  {
    file: ".github/workflows/sync.yml",
    workflowName: "sync",
    callOutput: "steps.sync_call.outputs.details",
    detailKeys: [
      "scanned",
      "matched",
      "created",
      "updated",
      "removed",
      "sanitized",
      "enriched",
      "qualityChecked",
      "qualityImproved",
      "syncedAt",
    ],
  },
  {
    file: ".github/workflows/quality-sync.yml",
    workflowName: "quality",
    callOutput: "steps.quality_call.outputs.details",
    detailKeys: ["mode", "queued", "checked", "improved", "syncedAt"],
  },
  {
    file: ".github/workflows/repair-queue.yml",
    workflowName: "repair",
    callOutput: "steps.repair_call.outputs.details",
    detailKeys: ["mode", "queued", "checked", "improved", "syncedAt"],
  },
];

const failures = [];

function readWorkflow(file) {
  return readFileSync(resolve(root, file), "utf8");
}

function expectIncludes(text, needle, context) {
  if (!text.includes(needle)) {
    failures.push(`${context}: missing ${JSON.stringify(needle)}`);
  }
}

for (const workflow of endpointWorkflows) {
  const text = readWorkflow(workflow.file);
  const context = workflow.file;

  expectIncludes(text, "workflow_dispatch:", context);
  expectIncludes(text, 'RESPONSE_FILE="$(mktemp)"', context);
  expectIncludes(text, '--output "${RESPONSE_FILE}"', context);
  expectIncludes(text, 'cat "${RESPONSE_FILE}"', context);
  expectIncludes(text, `workflowName": "${workflow.workflowName}"`, context);
  expectIncludes(text, `DETAILS: \${{ ${workflow.callOutput} }}`, context);
  expectIncludes(text, '"details": os.environ.get("DETAILS") or "endpoint call failed"', context);
  expectIncludes(text, "--data @workflow-status.json", context);
  expectIncludes(text, "${STATUS_URL}", context);

  for (const key of workflow.detailKeys) {
    expectIncludes(text, `"${key}"`, `${context} details`);
  }
}

const smoke = readWorkflow(".github/workflows/production-smoke.yml");
expectIncludes(smoke, "push:", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "branches:", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "schedule:", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "workflow_dispatch:", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "base_url:", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "statuses: read", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "Resolve smoke target", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "Wait for Vercel deployment", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "Vercel – moosqa-ci4e", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "Wait for public health endpoint", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "/api/health", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "npm run smoke:prod", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "MOOSQA_SMOKE_BASE_URL", ".github/workflows/production-smoke.yml");
expectIncludes(smoke, "steps.target.outputs.base_url", ".github/workflows/production-smoke.yml");

if (failures.length > 0) {
  console.error("Workflow checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Workflow checks passed.");
