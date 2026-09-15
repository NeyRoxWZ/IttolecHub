import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Work the player doesn't wait for, finished after the response is sent.
 *
 * Only for writes that change nothing about the answer: the public tape, the
 * season board, the shared goal, cleanups. Anything that decides an outcome,
 * moves coins or closes a round stays awaited by its caller.
 *
 * On Cloudflare the request is kept alive until the task settles (waitUntil).
 * Outside the worker (next dev, build) there is no such context: the task
 * simply runs on without being awaited.
 */
export function runInBackground(task: PromiseLike<unknown> | null | undefined): void {
  if (!task) return;
  const settled = Promise.resolve(task).catch((err) => {
    console.error('Tâche en arrière-plan:', err);
  });
  try {
    getCloudflareContext().ctx.waitUntil(settled);
  } catch {
    // Not running inside the worker.
  }
}
