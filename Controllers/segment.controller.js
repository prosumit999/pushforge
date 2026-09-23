const segmentService = require("../Services/segment.service");

const createSegment = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const { name, rules } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Segment name is required" });
    }

    const segment = await segmentService.createSegment(req.user.id, websiteId, { name, rules });
    res.status(201).json(segment);
  } catch (error) {
    next(error);
  }
};

const getSegments = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const segments = await segmentService.getWebsiteSegments(req.user.id, websiteId);
    res.status(200).json(segments);
  } catch (error) {
    next(error);
  }
};

const getSegment = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const segment = await segmentService.getSegmentById(req.user.id, websiteId, id);
    res.status(200).json(segment);
  } catch (error) {
    next(error);
  }
};

const estimateAudience = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const { rules } = req.body;
    const result = await segmentService.estimateSegmentAudience(req.user.id, websiteId, rules);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateSegment = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const segment = await segmentService.updateSegment(req.user.id, websiteId, id, req.body);
    res.status(200).json(segment);
  } catch (error) {
    next(error);
  }
};

const deleteSegment = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await segmentService.deleteSegment(req.user.id, websiteId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSegment,
  getSegments,
  getSegment,
  estimateAudience,
  updateSegment,
  deleteSegment
};
