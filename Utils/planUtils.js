/**
 * Utility function to normalize plan names across checkout, affiliate, and user profile operations.
 */
const normalizePlanName = (plan) => {
  if (!plan) return "Starter";
  const str = String(plan).trim();
  if (/starter/i.test(str)) return "Starter";
  if (/pro|business/i.test(str)) return "Business Pro";
  if (/agency/i.test(str)) return "Agency";
  if (/enterprise|self-hosted|self hosted/i.test(str)) return "Self-Hosted";
  return str;
};

module.exports = {
  normalizePlanName
};
