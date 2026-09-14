import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache store: the site's pages are client-rendered or dynamic,
// and the API routes are not cached.
export default defineCloudflareConfig({});
