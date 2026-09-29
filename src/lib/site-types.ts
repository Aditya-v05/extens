// The fixed library of website signals. Imported by the extension and by eval/site-signals-eval.mjs
// (Node strips the types), so keep this file free of imports.

/** What Jev picks between for each snippet (criteria of a Choice question). */
export const SITE_SIGNAL_TYPES = {
  enterprise_push: 'Selling to larger customers: an enterprise plan, SSO/SAML/SCIM, custom contracts, or a sales-led offer.',
  security_compliance: 'Security or compliance credentials or programs: SOC 2, ISO 27001, HIPAA, GDPR, a bug bounty.',
  ai_launch: 'Launched or expanded AI features, AI agents, or an AI product.',
  product_launch: 'Launched a new product, major feature, or integration (not AI-specific).',
  pricing_change: 'Changed or introduced pricing, plans, or packaging.',
  expansion: 'Expanding into new regions, markets, or offices.',
  funding: 'Announced a funding round or investment.',
  acquisition: 'Acquired a company, was acquired, or announced a merger.',
  leadership: 'A new executive, leadership hire, or board appointment.',
  partnership: 'A new strategic partnership.',
  customer_milestone: 'A customer, usage, or growth milestone.',
  none: 'None of these: generic marketing copy, how-to or thought-leadership content, or an engineering write-up.',
} as const;

export type SiteSignalType = Exclude<keyof typeof SITE_SIGNAL_TYPES, 'none'>;

/** Display labels, written by us, never by the model. */
export const SITE_SIGNAL_LABELS: Record<SiteSignalType, string> = {
  enterprise_push: 'Moving upmarket',
  security_compliance: 'Security & compliance',
  ai_launch: 'Shipping AI',
  product_launch: 'Product launch',
  pricing_change: 'Pricing change',
  expansion: 'Expanding',
  funding: 'Funding news',
  acquisition: 'M&A news',
  leadership: 'Leadership change',
  partnership: 'New partnership',
  customer_milestone: 'Growth milestone',
};
