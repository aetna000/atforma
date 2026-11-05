// A schedule of the diagram's intent, not discovered cloud inventory.
import { roleOf } from "./review.mjs";

const SERVICES = [
  [/\bs3\b/i, "Amazon S3", ["aws_s3_bucket", "aws_s3_bucket_public_access_block", "aws_s3_bucket_server_side_encryption_configuration", "aws_s3_bucket_versioning"], "Storage, requests, retrieval and transfer"],
  [/bedrock.*guard|guard.*bedrock/i, "Amazon Bedrock Guardrails", ["aws_bedrock_guardrail"], "Enabled policy checks and text units; confirm each policy's charge"],
  [/bedrock.*knowledge|knowledge.*bedrock/i, "Amazon Bedrock Knowledge Bases", ["aws_bedrockagent_knowledge_base", "aws_iam_role"], "Embeddings, ingestion, vector store and retrieval; select the backing store"],
  [/\bbedrock\b/i, "Amazon Bedrock", [], "Model-specific input/output tokens; guardrails, embeddings and knowledge bases separately"],
  [/\blambda\b/i, "AWS Lambda", ["aws_lambda_function", "aws_iam_role"], "Requests, duration, memory and logs"],
  [/\bopensearch\b/i, "Amazon OpenSearch", ["aws_opensearchserverless_collection"], "Indexing/search capacity and storage"],
  [/\bdynamodb\b/i, "Amazon DynamoDB", ["aws_dynamodb_table"], "Read/write requests, storage and backup"],
  [/\bsqs\b/i, "Amazon SQS", ["aws_sqs_queue"], "Requests, payload size and transfer"],
  [/\bsagemaker\b/i, "Amazon SageMaker AI", [], "Training, serving instances, processing and storage"],
  [/\b(iot|kinesis)\b/i, "AWS ingestion service", [], "Messages, connections, processing and retention"],
  [/\bcloudwatch\b/i, "Amazon CloudWatch", ["aws_cloudwatch_log_group"], "Logs, metrics, alarms and retention"],
  [/\biam\b/i, "AWS IAM", ["aws_iam_policy"], "Review associated services; IAM policy alone is not an application guardrail"],
];
const CANDIDATES = { data: "Storage or existing data connector", ingest: "Ingestion / processing service", index: "Search / vector index", llm: "Model API and model selection", guard: "Guardrails and access policies", human: "Approval workflow", app: "Application runtime and API", output: "User interface / delivery integration", model: "Model training or serving", monitor: "Monitoring and alerting" };

export function resourcePlan(project) {
  const nodes = project.nodes.filter((n) => n.data.kind !== "note");
  const ids = new Set(nodes.map((n) => n.id));
  const rows = nodes.map((n) => {
    const match = n.data.provider === "aws" && SERVICES.find(([re]) => re.test(`${n.data.label} ${n.data.service || ""}`));
    const existing = n.data.origin === "existing";
    const foundation = !existing && n.data.provider === "aws" && match?.[1] === "Amazon S3";
    // Encode the complete ID: stable on reorder/rename, valid Terraform identifier, no collisions.
    const address = `block_${Array.from(new TextEncoder().encode(n.id), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    return { id: n.id, address, label: n.data.label, provider: n.data.provider,
      service: match?.[1] || n.data.service || CANDIDATES[roleOf(n)] || "Service to be selected",
      selection: match ? "Named in diagram" : "Needs service confirmation", existing,
      region: n.data.config?.region || "To be selected", resources: match?.[2] || [],
      costDrivers: match?.[3] || "Confirm service, capacity and billable dimensions",
      dependencies: project.edges.filter((e) => e.target === n.id && ids.has(e.source)).map((e) => e.source),
      terraform: existing ? "Existing — reference/import plan needed" : foundation ? "S3 foundation generated" : "Implementation needed",
      foundation,
    };
  });
  const connections = project.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.label || "data", status: "Application integration and permissions not implemented" }));
  const gaps = [
    ...rows.filter((r) => !r.foundation).map((r) => `${r.label}: ${r.terraform}.`),
    ...connections.map((e) => `Wire ${e.source} → ${e.target}: implement data flow, access policy and acceptance test.`),
    ...(!rows.length ? ["No resources in the design yet."] : []),
  ];
  return { revision: project.revision, rows, connections, gaps, scope: "Diagram-derived resource schedule; service choices and resource types require engineering review.", sources: [
    "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket",
    "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrock_guardrail",
    "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagent_knowledge_base",
    "https://aws.amazon.com/bedrock/pricing/",
  ] };
}

export function resourceMarkdown(project) {
  const plan = resourcePlan(project);
  const c = (v) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
  return `## Cloud resource schedule\n\n${plan.scope}\n\n| Block ID | Component | Provider | Service | Region | Ownership | Terraform coverage |\n|---|---|---|---|---|---|---|\n${plan.rows.map((r) => `| ${c(r.id)} | ${c(r.label)} | ${r.provider} | ${c(r.service)} | ${c(r.region)} | ${r.existing ? "Existing" : "Proposed"} | ${r.terraform} |`).join("\n")}\n\n### Resources and cost dimensions\n\n${plan.rows.map((r) => `- **${c(r.label)}** (${c(r.id)}): ${r.resources.join(", ") || "Resource types to confirm"}. ${r.costDrivers}. Depends on: ${r.dependencies.join(", ") || "none drawn"}.`).join("\n")}\n\n### Engineering work remaining\n\n${plan.gaps.map((g) => `- ${g}`).join("\n") || "S3 foundation only. Validate the plan, account, region, cost and security before applying."}\n\nReferences (resource semantics; not retrieved prices):\n${plan.sources.map((s) => `- ${s}`).join("\n")}\n`;
}
