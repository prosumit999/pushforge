const publicService = require("../Services/public.service");
const { getVapidPublicKey } = require("../Config/vapid.config");

const getVapidKey = (req, res) => {
  res.status(200).json({ publicKey: getVapidPublicKey() });
};

const subscribe = async (req, res, next) => {
  try {
    const subscriber = await publicService.registerPublicSubscriber(req.website, req.body);
    res.status(201).json({
      success: true,
      subscriberId: subscriber._id
    });
  } catch (error) {
    next(error);
  }
};

const logEvent = async (req, res, next) => {
  try {
    const event = await publicService.logPublicAnalyticsEvent(req.website, req.body);
    res.status(201).json({
      success: true,
      eventId: event._id
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVapidKey,
  subscribe,
  logEvent
};
