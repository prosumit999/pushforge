const publicService = require("../Services/public.service");
const { getVapidPublicKey } = require("../Config/vapid.config");

const getVapidKey = (req, res) => {
  res.status(200).json({ publicKey: getVapidPublicKey() });
};

const getConfig = (req, res) => {
  res.status(200).json({
    publicKey: getVapidPublicKey(),
    promptConfig: req.website?.promptConfig || {
      promptMode: "push-only",
      promptStyle: "glass-modal",
      cardPosition: "bottom-center",
      headline: "Get Instant Updates & Flash Alerts",
      description: "Subscribe to get real-time price drop alerts, news, and exclusive offers directly in your browser.",
      allowText: "Allow Notifications",
      dismissText: "Later",
      autoPrompt: true,
      delaySeconds: 1
    }
  });
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

const trackClick = async (req, res, next) => {
  try {
    const result = await publicService.handlePublicClick(req.website, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const handleSubscriptionChange = async (req, res, next) => {
  try {
    const result = await publicService.renewPublicSubscription(req.website, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVapidKey,
  getConfig,
  subscribe,
  logEvent,
  trackClick,
  handleSubscriptionChange
};
