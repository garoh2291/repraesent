import { uploadMediaFile, type MediaUploadStage } from "./upload";
import type { MediaAsset } from "~/lib/api/media";

/**
 * Concurrency-limited upload pool for the media library.
 *
 * Bulk-selecting 100 files must not fire 100 thumbnail canvases and 200
 * direct-to-bucket PUTs at once — that stalls the browser, not the backend
 * (bytes never pass through Nest). So every file is accepted immediately
 * (its card renders as "queued") and at most CONCURRENCY pipelines run at a
 * time; the rest start as slots free up.
 *
 * Module-level singleton: the /media page and the picker dialog share one
 * pool, so uploading from both places still respects the global limit.
 */

export type QueuedUploadStage = "queued" | MediaUploadStage;

const CONCURRENCY = 3;

interface QueueJob {
  file: File;
  onStage: (stage: QueuedUploadStage) => void;
  onDone: (asset: MediaAsset) => void;
  onError: (error: unknown) => void;
}

const pending: QueueJob[] = [];
let active = 0;

function pump(): void {
  while (active < CONCURRENCY && pending.length > 0) {
    const job = pending.shift()!;
    active++;
    void uploadMediaFile(job.file, job.onStage)
      .then(job.onDone, job.onError)
      .finally(() => {
        active--;
        pump();
      });
  }
}

/** Accepts the file immediately; the pipeline starts when a slot frees up. */
export function enqueueMediaUpload(job: QueueJob): void {
  job.onStage("queued");
  pending.push(job);
  pump();
}

/** Files currently queued or in flight (drives the "12 / 100" counter). */
export function uploadQueueBusyCount(): number {
  return pending.length + active;
}
