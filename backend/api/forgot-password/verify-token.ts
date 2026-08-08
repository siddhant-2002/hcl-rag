import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../lib/db";
import { User } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Reset token is required." });
  }

  try {
    await connectDB();

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "This password reset link is invalid or has expired. Please request a new link.",
      });
    }

    return res.json({ success: true, username: user.username, email: user.email });
  } catch (err: any) {
    console.error("Verify Token Error:", err);
    return res.status(500).json({ error: "Failed to verify reset token." });
  }
}
