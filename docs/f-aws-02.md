# f-aws-02 — Workers, Nightly Reflection, and Evidence Storage

## Goal

Run capture and reflection outside the web request, store evidence files, and allow reflection on a schedule.

## User-visible behavior

Evidence files can be opened from a dead-end record. A scheduled reflection run can promote a harness version without someone clicking the button.

## Scope / out of scope

In scope:

- Object storage for uploaded logs and other evidence files.
- Evidence links on attempts that open the stored object.
- A worker entrypoint for capture processing on AWS.
- A scheduled reflection invocation using the same promotion rules as manual reflection.
- Infrastructure definitions for the worker, schedule, and bucket, validated without a production deploy.
- A failed scheduled run must not promote a harness version.

Out of scope:

- Voice transcription.
- GitHub pull-request automation.
- Replacing MongoDB with a worker-local store.
- Hosting the application outside AWS.

## Acceptance criteria

- An uploaded evidence file is addressable from the attempt and is not committed to the repository.
- The worker can process a capture job independently of the web request that accepted it.
- The scheduled job calls the same reflection promotion rules as `POST /api/harness/reflect`.
- A failed or lower-scoring scheduled run leaves the active harness version unchanged.
- Development and production resource names are isolated.

## Verification steps

1. Upload a fixture log to object storage and verify the attempt evidence URL resolves.
2. Run the worker entrypoint that processes a capture job outside the web request.
3. Invoke the reflection job the way the schedule would and verify it uses the same promotion rules.
4. Validate the AWS infrastructure definition without deploying production resources.
5. Verify a failed scheduled run does not promote a harness version.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-be-01` Capture and Extraction Pipeline.
- `f-be-06` Self-Improving Harness.

## Open questions

- Should the first worker be App Runner or Lambda?
- How long should evidence objects be retained?
