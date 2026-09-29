const { Segment, Website, Subscriber } = require("../Models");
const { buildSubscriberQuery } = require("./audience.service");

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

// Segment rules go through the audience allowlist, so an unknown or dangerous
// field name is rejected instead of being interpolated straight into a query.
const buildSegmentQuery = (rules, websiteId) => buildSubscriberQuery(websiteId, rules);

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
