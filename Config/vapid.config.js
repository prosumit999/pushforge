const webpush = require("web-push");

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  const generated = webpush.generateVAPIDKeys();
  vapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey
  };
  console.log("Generated default VAPID Keys for Web Push");
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
