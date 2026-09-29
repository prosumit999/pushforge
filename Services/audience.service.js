const { Subscriber } = require("../Models");

// Only these subscriber paths may be targeted. Rules arrive from the client,
// so an allowlist is what stops a crafted "field" from injecting Mongo
// operators (for example $where) or walking outside the subscriber document.
const FILTERABLE_FIELDS = {
  "device.browser": { type: "string" },
  "device.os": { type: "string" },
  "device.deviceType": { type: "string" },
  "location.country": { type: "string" },
  "location.city": { type: "string" },
  "location.ip": { type: "string" },
  "referrer": { type: "string" },
  "firstSeenPage": { type: "string" },
  "tags": { type: "tags" },
  "createdAt": { type: "date" },
  "isActive": { type: "boolean" }
};

const SUPPORTED_OPERATORS = ["equals", "not_equals", "contains", "greater_than", "less_than", "in"];

class FilterValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

const coerceValue = (field, rawValue) => {
  const spec = FILTERABLE_FIELDS[field];

  if (spec.type === "date") {
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      throw new FilterValidationError(`Rule value for "${field}" must be a valid date`);
    }
    return parsed;
  }

  if (spec.type === "boolean") {
    if (typeof rawValue === "boolean") return rawValue;
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
    throw new FilterValidationError(`Rule value for "${field}" must be true or false`);
  }

  if (spec.type === "tags") {
    if (Array.isArray(rawValue)) {
      return rawValue.map((v) => String(v).trim()).filter(Boolean);
    }
    return [String(rawValue).trim()].filter(Boolean);
  }

  if (rawValue === null || rawValue === undefined || typeof rawValue === "object") {
    throw new FilterValidationError(`Rule value for "${field}" must be a text value`);
  }

  return String(rawValue).trim();
};

// Escapes user input before it reaches a RegExp so a "contains" rule cannot
// inject regex metacharacters or cause catastrophic backtracking.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRuleCondition = (rule, index) => {
  if (!rule || typeof rule !== "object") {
    throw new FilterValidationError(`Rule ${index + 1} must be an object`);
  }

  const { field, operator } = rule;

  if (!field || !FILTERABLE_FIELDS[field]) {
    throw new FilterValidationError(
      `Rule ${index + 1} targets unsupported field "${field}". Allowed: ${Object.keys(FILTERABLE_FIELDS).join(", ")}`
    );
  }
  if (!operator || !SUPPORTED_OPERATORS.includes(operator)) {
    throw new FilterValidationError(
      `Rule ${index + 1} uses unsupported operator "${operator}". Allowed: ${SUPPORTED_OPERATORS.join(", ")}`
    );
  }

  const value = coerceValue(field, rule.value);

  if (operator === "in") {
    const list = Array.isArray(value) ? value : [value];
    if (list.length === 0) {
      throw new FilterValidationError(`Rule ${index + 1} needs at least one value for the "in" operator`);
    }
    return { [field]: { $in: list } };
  }

  if (operator === "equals") {
    return { [field]: value };
  }
  if (operator === "not_equals") {
    return { [field]: { $ne: value } };
  }
  if (operator === "contains") {
    if (FILTERABLE_FIELDS[field].type === "date" || FILTERABLE_FIELDS[field].type === "boolean") {
      throw new FilterValidationError(`Operator "contains" cannot be used with "${field}"`);
    }
    const pattern = new RegExp(escapeRegExp(String(value)), "i");
    // tags is an array, so a substring match has to be tested element-wise.
    return FILTERABLE_FIELDS[field].type === "tags" ? { tags: pattern } : { [field]: pattern };
  }
  if (operator === "greater_than") {
    return { [field]: { $gt: value } };
  }
  return { [field]: { $lt: value } };
};

const validateRules = (rules) => {
  if (rules === undefined || rules === null) {
    return [];
  }
  if (!Array.isArray(rules)) {
    throw new FilterValidationError("Rules must be an array");
  }
  if (rules.length > 25) {
    throw new FilterValidationError("A maximum of 25 rules is allowed per audience filter");
  }
  return rules;
};

// Combines the supplied rules (AND) into a single subscriber query scoped to
// one website. Empty rules mean "every active subscriber".
const buildSubscriberQuery = (websiteId, rules) => {
  const safeRules = validateRules(rules);
  const query = { website: websiteId, isActive: true };

  if (safeRules.length === 0) {
    return query;
  }

  const conditions = safeRules.map((rule, index) => buildRuleCondition(rule, index));
  query.$and = conditions;

  return query;
};

const resolveAudienceQuery = async (notification) => {
  const { Segment } = require("../Models");

  if (notification.targetType === "segment") {
    if (!notification.segment) {
      throw new FilterValidationError("This notification targets a segment but no segment is attached");
    }
    const segment = await Segment.findOne({ _id: notification.segment, website: notification.website });
    if (!segment) {
      const error = new Error("Target segment no longer exists");
      error.statusCode = 409;
      throw error;
    }
    return buildSubscriberQuery(notification.website, segment.rules);
  }

  if (notification.targetType === "filter") {
    return buildSubscriberQuery(notification.website, notification.filterRules);
  }

  return buildSubscriberQuery(notification.website, []);
};

const estimateAudienceSize = async (websiteId, rules) =>
  Subscriber.countDocuments(buildSubscriberQuery(websiteId, rules));

module.exports = {
  FILTERABLE_FIELDS,
  SUPPORTED_OPERATORS,
  FilterValidationError,
  buildSubscriberQuery,
  resolveAudienceQuery,
  estimateAudienceSize
};
