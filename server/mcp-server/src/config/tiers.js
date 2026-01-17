/**
 * Tier Configuration for JobTread Tools Pro
 * Per-company pricing, not per-seat
 */

export const TIER_CONFIG = {
  essential: {
    name: 'Essential',
    price: 10,
    priceLabel: '$10/mo',
    apiAccess: false,
    mcpAccess: false,
    canCreateDocs: false,
    canSharePublic: false,
    aiKnowledgeLookup: false,
    features: [
      'Browser extension',
      'Quick navigation',
      'Keyboard shortcuts',
      'UI enhancements',
      'View community process docs',
      'Save docs to personal library'
    ],
    tagline: 'Enhance your JobTread experience'
  },
  pro: {
    name: 'Pro',
    price: 20,
    priceLabel: '$20/mo',
    apiAccess: true,
    mcpAccess: false,
    canCreateDocs: true,
    canSharePublic: true,
    aiKnowledgeLookup: false,
    features: [
      'Everything in Essential',
      'Bulk operations',
      'Custom reports',
      'Data export',
      'Pre-built automations',
      'Create team process docs',
      'Share docs to community'
    ],
    tagline: 'Automate and document'
  },
  power_user: {
    name: 'Power User',
    price: 30,
    priceLabel: '$30/mo',
    apiAccess: true,
    mcpAccess: true,
    canCreateDocs: true,
    canSharePublic: true,
    aiKnowledgeLookup: true,
    features: [
      'Everything in Pro',
      'MCP server access',
      'Works with Claude, ChatGPT, Gemini, Cursor, Copilot',
      'Natural language queries',
      'AI-assisted workflows',
      'AI queries your team docs',
      'AI queries community docs',
      'AI queries official JobTread docs'
    ],
    tagline: 'AI-powered JobTread mastery'
  }
};

/**
 * Check if tier has MCP access
 */
export function hasMcpAccess(tier) {
  return TIER_CONFIG[tier]?.mcpAccess ?? false;
}

/**
 * Check if tier has API access
 */
export function hasApiAccess(tier) {
  return TIER_CONFIG[tier]?.apiAccess ?? false;
}

/**
 * Check if tier has AI knowledge lookup
 */
export function hasAiKnowledge(tier) {
  return TIER_CONFIG[tier]?.aiKnowledgeLookup ?? false;
}

/**
 * Check if tier can create docs
 */
export function canCreateDocs(tier) {
  return TIER_CONFIG[tier]?.canCreateDocs ?? false;
}

/**
 * Check if tier can share publicly
 */
export function canSharePublic(tier) {
  return TIER_CONFIG[tier]?.canSharePublic ?? false;
}

/**
 * Get tier info by name
 */
export function getTierInfo(tier) {
  return TIER_CONFIG[tier] || null;
}
