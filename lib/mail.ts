import nodemailer from "nodemailer";

/**
 * Transactional mail over Gmail SMTP.
 *
 * Gmail requires an App Password (2-Step Verification must be on); an account
 * password will not authenticate. Generate one at
 * myaccount.google.com/apppasswords.
 *
 * This is a bootstrap choice, not a destination. Gmail caps sending at roughly
 * 500/day and its deliverability for transactional mail is poor — messages
 * routinely land in spam because the domain has no SPF/DKIM alignment for this
 * use. Swap in a transactional provider before opening signups to real users;
 * only this file should need to change.
 */

const FROM_NAME = "FUTTRADE";

function transporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set to send mail. See DEPLOY.md.",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/** Whether mail can actually be sent, so callers can fall back rather than throw. */
export function mailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/**
 * Every message carries the raw URL as text beneath the button. Plenty of mail
 * clients strip, rewrite or fail to render the button, and a user who cannot
 * click still has to be able to copy.
 */
function layout({
  heading,
  body,
  action,
  url,
  footnote,
}: {
  heading: string;
  body: string;
  action: string;
  url: string;
  footnote: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#070b14;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#0e1523;border:1px solid #2a3444;">
      <tr><td style="padding:28px;">
        <p style="margin:0 0 20px;font-size:12px;letter-spacing:2px;color:#c8ff2e;text-transform:uppercase;">${FROM_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#eaf0fa;font-weight:700;">${heading}</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#7d8ba3;">${body}</p>
        <a href="${url}" style="display:inline-block;padding:12px 22px;background:#c8ff2e;color:#070b14;font-size:14px;font-weight:700;text-decoration:none;">${action}</a>
        <p style="margin:24px 0 6px;font-size:12px;color:#7d8ba3;">Or paste this into your browser:</p>
        <p style="margin:0 0 24px;font-size:12px;color:#7d8ba3;word-break:break-all;">${url}</p>
        <p style="margin:0;padding-top:18px;border-top:1px solid #2a3444;font-size:12px;color:#7d8ba3;">${footnote}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function send(to: string, subject: string, html: string, text: string) {
  const info = await transporter().sendMail({
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
  return info.messageId;
}

export async function sendVerificationEmail(to: string, url: string) {
  return send(
    to,
    "Verify your FUTTRADE account",
    layout({
      heading: "Verify your email",
      body: "Confirm this address to finish setting up your account. You'll be able to sign in straight afterwards.",
      action: "Verify email",
      url,
      footnote: "This link is good for 24 hours. If you didn't create a FUTTRADE account, ignore this email.",
    }),
    `Verify your email\n\nConfirm this address to finish setting up your account:\n${url}\n\nThis link is good for 24 hours. If you didn't create a FUTTRADE account, ignore this email.`,
  );
}

export async function sendResetPasswordEmail(to: string, url: string) {
  return send(
    to,
    "Reset your FUTTRADE password",
    layout({
      heading: "Reset your password",
      body: "Follow this link to set a new password. Your current password stays active until you do.",
      action: "Set a new password",
      url,
      footnote: "This link is good for one hour and works once. If you didn't ask for it, ignore this email.",
    }),
    `Reset your password\n\nFollow this link to set a new password:\n${url}\n\nThis link is good for one hour and works once. If you didn't ask for it, ignore this email.`,
  );
}
