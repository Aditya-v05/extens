// Wordings compared by rank-eval.mjs. Keep RANK_LEVELS and the shipped wording in sync with src/lib/questions.ts.
export const RANK_LEVELS = [
  'Unlikely to be involved in buying what the seller sells.',
  'Might influence the purchase but is unlikely to own the problem.',
  'Likely a key stakeholder in the problem the seller solves.',
  'Most likely owns the problem the seller solves and the budget for it.',
];
// B_level_aware ships (src/lib/questions.ts): 13/14 on 2026-09-29, A: 10/14.
export const RANK_VARIANTS = {
  A_current: (i) => `How likely is the person \`people[${i}]\` at \`company\` to own the problem the seller solves (\`seller.sells\`)? The seller's usual buyers are \`seller.typical_buyers\`; \`best_persona\` is the role judged most likely to own it here.`,
  B_level_aware: (i) => `How likely is the person \`people[${i}]\` at \`company\` to own the problem the seller solves (\`seller.sells\`) and decide on buying for it? The seller's usual buyers are \`seller.typical_buyers\`. Someone who leads or manages the relevant team (a head, director, lead, leader or manager) outranks people who work in it; a title that names only a function with no level, like "Customer Experience", usually means an individual contributor.`,
};
