/**
 * EventBridge scheduling + AWS infra definition (A8, f-aws-02).
 *
 * Declarative description of the worker deployment and the nightly reflection
 * schedule. Kept as data so it can be validated without deploying (f-aws-02
 * verification: "Validate the AWS infrastructure definition without deploying").
 * A real IaC step (CDK/Terraform/SAM) consumes this shape.
 */

export interface ScheduleRule {
  name: string;
  /** EventBridge schedule expression. */
  expression: string;
  target: "worker" | "reflection";
  jobType: "capture" | "backfill" | "reflection";
  enabled: boolean;
}

export interface WorkerDeployment {
  /** Compute target for the worker. */
  runtime: "app_runner" | "lambda";
  cpu?: string;
  memory?: string;
  /** SQS queue the worker consumes. */
  queueName: string;
  /** S3 bucket for evidence objects (A5). */
  evidenceBucket: string;
  schedules: ScheduleRule[];
}

export const workerDeployment: WorkerDeployment = {
  runtime: "app_runner",
  cpu: "0.5 vCPU",
  memory: "1 GB",
  queueName: "projectbrain-jobs",
  evidenceBucket: "projectbrain-evidence",
  schedules: [
    {
      name: "nightly-reflection",
      // 03:00 UTC daily. Reflection promotion rules live in Person 2's feature.
      expression: "cron(0 3 * * ? *)",
      target: "reflection",
      jobType: "reflection",
      enabled: true,
    },
    {
      name: "hourly-backfill-sweep",
      expression: "rate(1 hour)",
      target: "worker",
      jobType: "backfill",
      enabled: false,
    },
  ],
};

/** Validate the deployment definition without touching AWS (f-aws-02). */
export function validateDeployment(dep: WorkerDeployment): string[] {
  const errors: string[] = [];
  if (dep.runtime !== "app_runner" && dep.runtime !== "lambda") {
    errors.push(`unknown runtime: ${dep.runtime}`);
  }
  if (!dep.queueName) errors.push("queueName is required");
  if (!dep.evidenceBucket) errors.push("evidenceBucket is required");
  const names = new Set<string>();
  for (const rule of dep.schedules) {
    if (names.has(rule.name)) errors.push(`duplicate schedule name: ${rule.name}`);
    names.add(rule.name);
    const okExpr =
      /^cron\(.+\)$/.test(rule.expression) || /^rate\(.+\)$/.test(rule.expression);
    if (!okExpr) errors.push(`invalid schedule expression: ${rule.expression}`);
  }
  return errors;
}
