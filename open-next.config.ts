import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Prerendered pages are served straight from Workers Static Assets instead of
// being rendered again on every request: far less CPU per visit, which is what
// the Worker's per-request CPU limit (error 1102) counts. Read-only: pages are
// rebuilt at deploy time, which is how this site already works.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
