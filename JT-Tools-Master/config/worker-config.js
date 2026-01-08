/**
 * Cloudflare Worker Configuration
 * Update WORKER_URL with your deployed worker URL
 */

const WORKER_CONFIG = {
  // Replace with your actual Cloudflare Worker URL
  WORKER_URL: 'https://jobtread-tools-pro.YOUR_SUBDOMAIN.workers.dev',

  // Enable to use Worker API, disable to use direct API (for testing)
  USE_WORKER: true
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.WORKER_CONFIG = WORKER_CONFIG;
}
