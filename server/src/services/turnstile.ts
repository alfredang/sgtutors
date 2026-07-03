import { config } from "../config.js";

/** Verify a Cloudflare Turnstile token server-side. */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string
): Promise<boolean> {
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: config.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: remoteIp,
        }),
      }
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}
