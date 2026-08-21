// Email helper. Uses Resend when RESEND_API_KEY is set, otherwise logs (dev stub).
export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL ?? "invite@superbuyluxe.com";

  if (!key) {
    console.log(`[mail:stub] to=${to} subject="${subject}"\n${text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!res.ok) {
    console.error("Email send failed:", await res.text());
  }
}
