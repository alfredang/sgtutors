import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface TutorClaims {
  sub: string;
  role: "tutor";
}
export interface AdminClaims {
  sub: string;
  role: "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tutorId?: string;
      adminId?: string;
    }
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 3600 * 1000,
};

export function setTutorCookie(res: Response, tutorId: string) {
  const token = jwt.sign({ role: "tutor" } satisfies Omit<TutorClaims, "sub">, config.JWT_SECRET, {
    subject: tutorId,
    expiresIn: "7d",
  });
  res.cookie("tutor_token", token, COOKIE_OPTS);
}

export function setAdminCookie(res: Response, adminId: string) {
  const token = jwt.sign({ role: "admin" }, config.ADMIN_JWT_SECRET, {
    subject: adminId,
    expiresIn: "1d",
  });
  res.cookie("admin_token", token, { ...COOKIE_OPTS, maxAge: 24 * 3600 * 1000 });
}

export function clearTutorCookie(res: Response) {
  res.clearCookie("tutor_token", { path: "/" });
}
export function clearAdminCookie(res: Response) {
  res.clearCookie("admin_token", { path: "/" });
}

export function tutorAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.tutor_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const claims = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    if (claims.role !== "tutor" || !claims.sub) throw new Error("bad role");
    req.tutorId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const claims = jwt.verify(token, config.ADMIN_JWT_SECRET) as jwt.JwtPayload;
    if (claims.role !== "admin" || !claims.sub) throw new Error("bad role");
    req.adminId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
