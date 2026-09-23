const { Segment, Website, Subscriber } = require("../Models");

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const buildSegmentQuery = (rules, websiteId) => {
  const query = { website: websiteId, isActive: true };

  if (!Array.isArray(rules) || rules.length === 0) {
    return query;
  }

  rules.forEach((rule) => {
    const { field, operator, value } = rule;
    if (!field || !operator) return;

    if (operator === "equals") {
      query[field] = value;
    } else if (operator === "not_equals") {
      query[field] = { $ne: value };
    } else if (operator === "contains") {
      query[field] = new RegExp(value, "i");
    } else if (operator === "in" && Array.isArray(value)) {
      query[field] = { $in: value };
    } else if (operator === "greater_than") {
      query[field] = { $gt: value };
    } else if (operator === "less_than") {
      query[field] = { $lt: value };
    }
  });

  return query;
};

const createSegment = async (userId, websiteId, { name, rules }) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const query = buildSegmentQuery(rules, websiteId);
  const estimatedCount = await Subscriber.countDocuments(query);

  const segment = await Segment.create({
    website: websiteId,
    name,
    rules: rules || [],
    estimatedCount
  });

  return segment;
};

const getWebsiteSegments = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  return await Segment.find({ website: websiteId }).sort({ createdAt: -1 });
};

const getSegmentById = async (userId, websiteId, segmentId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const segment = await Segment.findOne({ _id: segmentId, website: websiteId });
  if (!segment) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }
  return segment;
};

const estimateSegmentAudience = async (userId, websiteId, rules) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const query = buildSegmentQuery(rules, websiteId);
  const estimatedCount = await Subscriber.countDocuments(query);
  return { estimatedCount };
};

const updateSegment = async (userId, websiteId, segmentId, { name, rules }) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const segment = await Segment.findOne({ _id: segmentId, website: websiteId });
  if (!segment) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }

  if (name) segment.name = name;
  if (rules) {
    segment.rules = rules;
    const query = buildSegmentQuery(rules, websiteId);
    segment.estimatedCount = await Subscriber.countDocuments(query);
  }

  await segment.save();
  return segment;
};

const deleteSegment = async (userId, websiteId, segmentId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const segment = await Segment.findOneAndDelete({ _id: segmentId, website: websiteId });
  if (!segment) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Segment deleted successfully" };
};

module.exports = {
  createSegment,
  getWebsiteSegments,
  getSegmentById,
  estimateSegmentAudience,
  updateSegment,
  deleteSegment
};
