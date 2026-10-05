/**
 * Fail-fast Environment Variable Validation for Production Security
 */
const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const requiredVars = [
      "JWT_SECRET",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY"
    ];

    const insecureDefaults = [
      "supersecretkey_change_me_in_production",
      "PushForgeSecret2026Key",
      "rzp_test_PushForge2026"
    ];

    const missingOrInsecure = requiredVars.filter((key) => {
      const val = process.env[key];
      return !val || insecureDefaults.some((def) => val.includes(def));
    });

    if (missingOrInsecure.length > 0) {
      throw new Error(
        `CRITICAL SECURITY BOOT FAILURE: The following environment variables are missing or set to insecure defaults in production: ${missingOrInsecure.join(
          ", "
        )}. Application boot halted.`
      );
    }
  }
};

module.exports = { validateEnvironment };
