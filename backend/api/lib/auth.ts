import type { VercelRequest, VercelResponse } from "@vercel/node";
import { User } from "./models";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "password";

/**
 * Validates the Authorization header and returns the userId string.
 * Returns null and sends a 401 response if authentication fails.
 */
export async function authenticate(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    // Try MongoDB user lookup first
    try {
      const user = await User.findOne({ username });
      if (user && user.password === password) {
        return (user as any)._id.toString();
      }
    } catch (_dbErr) {
      // Fall through to env-based admin fallback
    }

    // Env-based admin fallback
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      return `admin:${AUTH_USERNAME}`;
    }

    res.status(401).json({ error: "Unauthorized" });
    return null;
  } catch (_e) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}
