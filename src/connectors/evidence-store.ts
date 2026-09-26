/**
 * Evidence object storage seam (A5, f-aws-02).
 *
 * Failing CI logs are pulled from CloudWatch, written to S3, and referenced from
 * an attempt's evidence so the file can be opened later (R4). The upload is
 * behind this interface: an in-memory impl for offline runs/tests, and an
 * S3 adapter (createS3EvidenceStore) that uses @aws-sdk/client-s3 in production.
 */

export interface EvidenceStore {
  /** Store a log/artifact blob; returns the storage key. */
  put(key: string, body: string, contentType?: string): Promise<string>;
  /** Resolve a storage key to an openable URL (R4). */
  url(key: string): string;
}

/** Offline evidence store: keeps blobs in memory, returns a synthetic URL. */
export class InMemoryEvidenceStore implements EvidenceStore {
  blobs = new Map<string, { body: string; contentType: string }>();
  constructor(private baseUrl = "memory://evidence") {}

  async put(key: string, body: string, contentType = "text/plain"): Promise<string> {
    this.blobs.set(key, { body, contentType });
    return key;
  }

  url(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
