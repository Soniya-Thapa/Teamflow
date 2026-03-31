/**
 * @file email.templates.ts
 * @description Reusable HTML email templates for TeamFlow transactional emails.
 *
 * KEY CONCEPTS:
 * - All templates return { subject, html } for consistency
 * - Inline CSS only (email clients strip <style> tags)
 * - Mobile-responsive via max-width + padding
 * - Brand colors: #4F46E5 (indigo primary), #F9FAFB (background)
 *
 * Templates:
 * - invitationEmail(inviterName, orgName, role, acceptUrl)
 * - welcomeEmail(userName, orgName)
 * - passwordResetEmail(userName, resetUrl)
 */

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
}

// ─────────────────────────────────────────
// SHARED LAYOUT HELPERS
// ─────────────────────────────────────────

const baseLayout = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TeamFlow</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#4F46E5;border-radius:12px;padding:10px 20px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">
                      Team<span style="color:#A5B4FC;">Flow</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #E5E7EB;padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} TeamFlow. All rights reserved.
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#9CA3AF;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const primaryButton = (url: string, label: string): string => `
<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr>
    <td style="background-color:#4F46E5;border-radius:8px;">
      <a href="${url}"
         style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
        ${label}
      </a>
    </td>
  </tr>
</table>
`;

const fallbackLink = (url: string): string => `
<p style="margin:16px 0 0;font-size:13px;color:#6B7280;">
  Or copy this link into your browser:<br/>
  <a href="${url}" style="color:#4F46E5;word-break:break-all;">${url}</a>
</p>
`;

const divider = (): string => `
<hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
`;

// ─────────────────────────────────────────
// INVITATION EMAIL
// ─────────────────────────────────────────

/**
 * Generates the invitation email template.
 * Sent when an org member invites someone to join TeamFlow.
 */
export const invitationEmail = (
  inviterName: string,
  orgName: string,
  role: string,
  acceptUrl: string
): EmailTemplate => ({
  subject: `${inviterName} invited you to join ${orgName} on TeamFlow`,
  html: baseLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">
      You're invited!
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
      <strong style="color:#374151;">${inviterName}</strong> has invited you to join
      <strong style="color:#374151;">${orgName}</strong> on TeamFlow as a
      <strong style="color:#4F46E5;">${role}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;padding:16px 20px;margin-bottom:8px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#6B7280;">Organization</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111827;">${orgName}</p>
        </td>
        <td align="right">
          <p style="margin:0;font-size:13px;color:#6B7280;">Your role</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#4F46E5;">${role}</p>
        </td>
      </tr>
    </table>

    ${primaryButton(acceptUrl, 'Accept Invitation →')}
    ${fallbackLink(acceptUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
      This invitation expires in <strong>7 days</strong>.
      If you don't have a TeamFlow account yet, you'll be prompted to create one after clicking the button above.
    </p>
  `),
});

// ─────────────────────────────────────────
// WELCOME EMAIL
// ─────────────────────────────────────────

/**
 * Generates the welcome email template.
 * Sent after a user successfully registers.
 */
export const welcomeEmail = (
  userName: string,
  orgName: string
): EmailTemplate => ({
  subject: `Welcome to TeamFlow, ${userName}!`,
  html: baseLayout(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background-color:#EEF2FF;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        🎉
      </div>
    </div>

    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">
      Welcome aboard, ${userName}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
      Your account has been created and you're now part of
      <strong style="color:#374151;">${orgName}</strong>.
      Here's what you can do with TeamFlow:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['📋', 'Manage Projects', 'Create and organize projects with your team'],
        ['✅', 'Track Tasks', 'Assign, prioritize, and complete tasks together'],
        ['👥', 'Collaborate', 'Invite team members and manage roles'],
      ]
        .map(
          ([icon, title, desc]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:20px;padding-right:14px;vertical-align:top;">${icon}</td>
                <td>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${title}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${desc}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
        )
        .join('')}
    </table>

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
      Need help getting started? Reply to this email and we'll get back to you.
    </p>
  `),
});

// ─────────────────────────────────────────
// PASSWORD RESET EMAIL
// ─────────────────────────────────────────

/**
 * Generates the password reset email template.
 * Sent when a user requests a password reset via /forgot-password.
 */
export const passwordResetEmail = (
  userName: string,
  resetUrl: string
): EmailTemplate => ({
  subject: `Reset your TeamFlow password`,
  html: baseLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">
      Reset your password
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
      Hi <strong style="color:#374151;">${userName}</strong>, we received a request to reset
      your TeamFlow password. Click the button below to choose a new one.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#FEF3C7;border-radius:10px;border:1px solid #FDE68A;padding:14px 18px;margin-bottom:8px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;">
            ⚠️ This link expires in <strong>1 hour</strong> and can only be used once.
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>

    ${primaryButton(resetUrl, 'Reset Password →')}
    ${fallbackLink(resetUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
      For security, this request was received from a TeamFlow account associated with
      <strong>${userName}</strong>. If you did not make this request, please
      contact support immediately.
    </p>
  `),
});