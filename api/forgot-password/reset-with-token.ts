import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../lib/db";
import { User } from "../lib/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Reset token and new password are required." });
  }

  try {
    await connectDB();

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "This password reset token is invalid or has expired.",
      });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
      username: user.username,
    });
  } catch (err: any) {
    console.error("Reset With Token Error:", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
}
