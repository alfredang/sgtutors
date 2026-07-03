import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";

export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

export function ipHash(req: Request): string {
  return crypto
    .createHash("sha256")
    .update(clientIp(req) + config.IP_HASH_SALT)
    .digest("hex");
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** Simple in-memory fixed-window rate limiter (single-process deployment). */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${opts.keyPrefix}:${opts.keyFn ? opts.keyFn(req) : clientIp(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests, try again later" });
    }
    // Opportunistic cleanup to bound memory
    if (buckets.size > 10000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    next();
  };
}
