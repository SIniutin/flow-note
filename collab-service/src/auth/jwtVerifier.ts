/**
 * JWT verification for collab-service WebSocket connections.
 *
 * Tokens are RS256-signed by auth-service. The public key is provided via
 * JWT_PUBLIC_KEY_PEM env variable (PEM text or path to a PEM file).
 */

import fs from "node:fs";
import jwt from "jsonwebtoken";
import { config } from "../config";

/** Resolved PEM string (loaded once at startup). */
const publicKey = resolvePublicKey(config.jwtPublicKeyPem);

function resolvePublicKey(pemOrPath: string): string {
  if (!pemOrPath) return "";
  // If it looks like a file path (no newlines) try to read it.
  if (!pemOrPath.includes("\n")) {
    try {
      return fs.readFileSync(pemOrPath, "utf8");
    } catch {
      // Fall through — treat the value as a raw PEM string.
    }
  }
  return pemOrPath;
}

export interface JwtPayload {
  userId: string;
}

/**
 * Verifies a JWT access token issued by auth-service.
 * Throws if the token is invalid, expired, or the key is not configured.
 */
export function verifyToken(token: string): JwtPayload {
  if (!publicKey) {
    throw new Error("JWT_PUBLIC_KEY_PEM is not configured");
  }
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer:     config.jwtIssuer,
    audience:   config.jwtAudience,
  });
  const sub = typeof decoded === "object" && decoded !== null
    ? (decoded as jwt.JwtPayload).sub ?? ""
    : "";
  return { userId: sub };
}
