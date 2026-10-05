const webpush = require("web-push");

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL VAPID BOOT ERROR: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are missing in production! Silent key generation invalidates existing subscriber push tokens."
    );
  } else {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey
    };
    console.warn("⚠️ [DEV WARNING] Generated ephemeral VAPID keys for local development. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env for persistence.");
  }
}

const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@pushforge.com";

webpush.setVapidDetails(
  vapidSubject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

module.exports = {
  webpush,
  getVapidPublicKey: () => vapidKeys.publicKey,
  getVapidPrivateKey: () => vapidKeys.privateKey
};
