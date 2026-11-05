// Pure draft generator. The separate validation service can initialize providers and validate; no cloud execution.
import { resourcePlan } from "./resources.mjs";
import { blockers, review } from "./review.mjs";

export function terraformSketch(project, environment = "staging") {
  const plan = resourcePlan(project);
  const env = environment === "production" ? "production" : "staging";
  const resources = { terraform_data: { review_gate: {
    input: { design_revision: project.revision, environment: env },
    lifecycle: { precondition: [{ condition: "${var.review_approved && length(local.unfinished_work) == 0}", error_message: "Review this sketch and finish the work listed in resource-schedule.json before a deployment plan can succeed." }] },
  } } };
  const add = (type, name, body) => { (resources[type] ||= {})[name] = { ...body, depends_on: ["terraform_data.review_gate"] }; };
  for (const r of plan.rows.filter((r) => r.foundation)) {
    const name = r.address;
    const bucket = `\${aws_s3_bucket.${name}.id}`;
    add("aws_s3_bucket", name, { bucket_prefix: `atforma-${name.slice(0, 24).replaceAll("_", "-")}-`, force_destroy: false, lifecycle: { prevent_destroy: true }, tags: { ManagedBy: "AtMem AI Architect", Environment: env } });
    add("aws_s3_bucket_public_access_block", name, { bucket, block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true });
    add("aws_s3_bucket_server_side_encryption_configuration", name, { bucket, rule: { apply_server_side_encryption_by_default: { sse_algorithm: "AES256" } } });
    add("aws_s3_bucket_versioning", name, { bucket, versioning_configuration: { status: "Enabled" } });
  }
  // Untrusted diagram text is never interpolated into Terraform expressions or resource names.
  const unfinished = [...plan.gaps.map((_, i) => `resource-schedule gap ${i + 1}`), ...blockers(review(project)).map((_, i) => `architecture review blocker ${i + 1}`)];
  const config = {
    terraform: { required_version: ">= 1.5.0, < 2.0.0", required_providers: { aws: { source: "hashicorp/aws", version: "~> 6.0" } } },
    variable: {
      aws_region: { type: "string", description: "Explicitly choose the reviewed deployment region; no region is assumed." },
      aws_account_id: { type: "string", description: "Expected AWS account ID; provider refuses a different account.", validation: { condition: '${can(regex("^[0-9]{12}$", var.aws_account_id))}', error_message: "Use a twelve digit AWS account ID." } },
      review_approved: { type: "bool", default: false, description: "Set only after reviewing the design, cost, security and generated Terraform." },
    },
    provider: { aws: { region: "${var.aws_region}", allowed_account_ids: ["${var.aws_account_id}"] } },
    locals: { unfinished_work: unfinished }, resource: resources,
    output: { design_revision: { value: project.revision }, environment: { value: env }, implemented_foundations: { value: plan.rows.filter((r) => r.foundation).length } },
  };
  return {
    "main.tf.json": JSON.stringify(config, null, 2),
    "resource-schedule.json": JSON.stringify(plan, null, 2),
    "README.md": `# AtMem AI Architect Terraform sketch\n\nRevision r${project.revision}; ${env}.\n\nOnly explicit, proposed AWS S3 blocks get native resources: a bucket, public-access block, encryption and versioning. Buckets prevent destruction. IAM, model access, application code, network policy, other services, existing-resource references and every drawn wire require engineering work. This is not a complete deployable application.\n\nDefault review gate prevents a successful plan; unresolved work also blocks it. Review resource-schedule.json and the architecture document, implement missing resources/integrations and update the gate's unfinished_work only when those tasks are done.\n\nOn your own machine: install Terraform, review provider version constraints, then run terraform init -backend=false and terraform validate. Retain the generated provider lock file. Configure the standard AWS credential chain separately; never put credentials in project files. Supply aws_region and aws_account_id to terraform plan. Review the actual account, region, changes, costs and permissions before approving any apply. This export carries no validation evidence. Use AtMem AI Architect’s Terraform → Test Terraform view to run local schema checks. No cloud plan or deployment has been validated.\n\nReview AES256 versus customer-managed keys, retention, version-storage cost, access policies and state storage against your requirements. The diagram's region is documented but not silently used; aws_region must be deliberately supplied.\n\nReferences:\n- https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket\n- https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_public_access_block\n- https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_server_side_encryption_configuration\n- https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_versioning\n- https://developer.hashicorp.com/terraform/language/resources/terraform-data\n`,
  };
}
