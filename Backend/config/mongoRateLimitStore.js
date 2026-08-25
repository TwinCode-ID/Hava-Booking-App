const crypto = require("crypto");
const RateLimitCounter = require("../models/Security/RateLimitCounter");

const NAMESPACE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

class MongoRateLimitStore {
  constructor(namespace) {
    if (
      typeof namespace !== "string" ||
      !NAMESPACE_PATTERN.test(namespace)
    ) {
      throw new TypeError("Rate-limit store namespace is invalid.");
    }

    this.namespace = namespace;
    // express-rate-limit uses this public property to distinguish database
    // stores which share the same class but intentionally use separate keys.
    this.prefix = `${namespace}:`;
    this.windowMs = 60_000;
    this.localKeys = false;
  }

  init(options) {
    if (!Number.isSafeInteger(options?.windowMs) || options.windowMs < 1) {
      throw new TypeError("Rate-limit windowMs must be a positive integer.");
    }
    this.windowMs = options.windowMs;
  }

  getId(key) {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("Rate-limit key must be a non-empty string.");
    }

    const digest = crypto
      .createHash("sha256")
      .update(`${this.prefix}${key}`)
      .digest("hex");
    return `${this.namespace}:${digest}`;
  }

  async get(key) {
    const counter = await RateLimitCounter.findById(this.getId(key)).lean();
    if (!counter || counter.resetAt <= new Date()) return undefined;
    return { totalHits: counter.totalHits, resetTime: counter.resetAt };
  }

  async increment(key) {
    const hasActiveWindow = {
      $gt: [{ $ifNull: ["$resetAt", new Date(0)] }, "$$NOW"],
    };
    const counter = await RateLimitCounter.findOneAndUpdate(
      { _id: this.getId(key) },
      [
        {
          $set: {
            totalHits: {
              $cond: [
                hasActiveWindow,
                { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
                1,
              ],
            },
            resetAt: {
              $cond: [
                hasActiveWindow,
                "$resetAt",
                { $add: ["$$NOW", this.windowMs] },
              ],
            },
          },
        },
      ],
      { new: true, upsert: true, updatePipeline: true },
    ).lean();

    if (!counter) {
      throw new Error("Rate-limit counter update returned no result.");
    }

    return { totalHits: counter.totalHits, resetTime: counter.resetAt };
  }

  async decrement(key) {
    await RateLimitCounter.updateOne(
      { _id: this.getId(key), totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } },
    );
  }

  async resetKey(key) {
    await RateLimitCounter.deleteOne({ _id: this.getId(key) });
  }
}

module.exports = MongoRateLimitStore;
