/**
 * Play Store ve App Store üzerinden abonelik doğrulama.
 * Google Play: Android Publisher API
 * App Store: verifyReceipt API
 */

const config = require("../config");
const { query } = require("../db");

const ANDROID_PACKAGE = config.googlePlayPackageName || "com.flywork.aimusicapp";
const CREDIT_MAP = {
  "com.fw.aimusic.weekly": 50,
  "com.fw.aimusic.monthly": 300,
  "com.fw.aimusic.yearly": 999,
};

/**
 * Kullanıcının son abonelik kaydını alır.
 */
async function getLatestSubscription(userId) {
  const rows = await query(
    `SELECT id, user_id, product_id, platform, purchase_token, transaction_id
     FROM subscriptions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Google Play'den abonelik durumunu doğrular.
 */
async function verifyGooglePlay(packageName, productId, purchaseToken) {
  const credPath = config.googlePlayCredentialsPath;
  if (!credPath) {
    console.warn("[SubscriptionVerifier] Google Play credentials not configured");
    return null;
  }

  try {
    const path = await import("path");
    const keyFilePath = path.join(__dirname, "..", "..", credPath);
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });

    const result = await androidPublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const data = result.data;
    const expiryTime = parseInt(data.expiryTimeMillis || "0", 10);
    const isActive = expiryTime > Date.now();

    return {
      active: isActive,
      expiryTimeMillis: expiryTime,
      autoRenewing: data.autoRenewing === true,
    };
  } catch (err) {
    console.error("[SubscriptionVerifier] Google Play error:", err.message);
    return null;
  }
}

/**
 * App Store'dan receipt doğrular.
 */
async function verifyAppStore(receiptData, productId) {
  if (!config.appleSharedSecret) {
    console.warn("[SubscriptionVerifier] Apple shared secret not configured");
    return null;
  }

  const payload = JSON.stringify({
    "receipt-data": receiptData,
    password: config.appleSharedSecret,
    "exclude-old-transactions": true,
  });

  const urls = [
    "https://buy.itunes.apple.com/verifyReceipt",
    "https://sandbox.itunes.apple.com/verifyReceipt",
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const json = await resp.json();

      if (json.status === 0) {
        const allReceipts = [
          ...(json.latest_receipt_info || []),
          ...(json.receipt?.in_app || []),
        ];
        const matching = productId
          ? allReceipts.find((r) => r.product_id === productId)
          : allReceipts[0];
        const latestReceipt = matching || allReceipts[allReceipts.length - 1];
        if (!latestReceipt) return { active: false };

        const expiresMs = parseInt(
          latestReceipt.expires_date_ms || latestReceipt.expires_date || "0",
          10
        );
        const isActive = expiresMs > Date.now();

        return {
          active: isActive,
          expiryTimeMillis: expiresMs,
        };
      }
      if (json.status === 21007) continue; // Sandbox receipt sent to prod, try sandbox
      if (json.status === 21008) continue; // Prod receipt sent to sandbox
    } catch (err) {
      console.error("[SubscriptionVerifier] App Store error:", err.message);
    }
  }
  return null;
}

/**
 * Kullanıcı aboneliğini store'dan doğrular.
 * @returns { active: boolean, credits?: number } veya null (doğrulama yapılamadı)
 */
async function verifyUserSubscription(userId) {
  const sub = await getLatestSubscription(userId);
  if (!sub || !sub.purchase_token) {
    return { active: false };
  }

  let result = null;

  if (sub.platform === "android") {
    result = await verifyGooglePlay(
      ANDROID_PACKAGE,
      sub.product_id,
      sub.purchase_token
    );
  } else if (sub.platform === "ios") {
    result = await verifyAppStore(sub.purchase_token, sub.product_id);
  }

  if (result === null) {
    return null;
  }

  if (result.active) {
    const credits = CREDIT_MAP[sub.product_id] ?? 50;
    return {
      active: true,
      credits,
      expiryTimeMillis: result.expiryTimeMillis,
    };
  }

  return { active: false };
}

module.exports = {
  verifyUserSubscription,
  getLatestSubscription,
};
