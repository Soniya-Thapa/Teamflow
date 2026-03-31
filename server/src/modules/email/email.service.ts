/**
 * @file email.service.ts
 * @description Abstraction layer for sending transactional emails via Resend.
 *
 * KEY CONCEPTS:
 * - Single responsibility: this service ONLY sends emails, it does not queue them
 * - All public methods are named sendX (sendInvitation, sendWelcome, sendPasswordReset)
 * - Errors are caught and logged — email failures never crash the app
 * - EmailQueue calls this service; other services call EmailQueue (not this directly)
 *
 * Methods:
 * - sendInvitation(to, inviterName, orgName, role, token)
 * - sendWelcome(to, userName, orgName)
 * - sendPasswordReset(to, userName, resetToken)
 * - sendRaw(to, subject, html) — internal generic sender
 */

// Key Architecture Idea (VERY IMPORTANT)
// Other Services → EmailQueue → EmailService → Resend API

// 👉 Meaning:

// Your controllers/services ❌ should NOT call this directly
// They call EmailQueue
// EmailQueue calls EmailService

// ✔ This keeps your system:

// scalable
// clean
// decoupled

import { Resend } from 'resend';
import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';
import {
  invitationEmail,
  welcomeEmail,
  passwordResetEmail,
} from './email.templates';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─────────────────────────────────────────
// EMAIL SERVICE
// ─────────────────────────────────────────

/**
 * EmailService — Resend-backed transactional email sender.
 * Exported as a singleton instance.
 */
class EmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    this.resend = new Resend(envConfig.email.resendApiKey); // Initializes Resend using API key
    this.from = `${envConfig.email.fromName} <${envConfig.email.from}>`; // Formats sender like: soniyathapa <noreply@company.com>
  }

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Core send method — all public methods funnel through here.
   * Catches all errors so email failures never throw up the call stack.
   */
  private async sendRaw(options: SendEmailOptions): Promise<EmailResult> {
    const { to, subject, html } = options;

    try {
      logger.info('Sending email', { to, subject });

      // Actual email sending happens here
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error('Resend API error', { to, subject, error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Email sent successfully', { to, subject, messageId: data?.id });
      return { success: true, messageId: data?.id };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown email error';
      logger.error('Email send failed (exception)', { to, subject, error: message });

      // CRITICAL DESIGN DECISION
      // return { success: false }
      // instead of
      // throw error ❌

      // 👉 WHY?
      // Because:
      // ❗ Email failure should NOT crash your app
      // Example:
      // User signs up → email fails → app still works

      return { success: false, error: message };
    }
  }

  // ─────────────────────────────────────────
  // PUBLIC SEND METHODS
  // ─────────────────────────────────────────

  /**
   * Sends an invitation email with the accept link.
   * Token is embedded in the frontend URL so the user clicks to accept.
   */

  // What it does:
  // Creates URL: /invite/accept?token=...
  // Generates email template: invitationEmail(...)
  // Sends email via: sendRaw()

  async sendInvitation(
    to: string,
    inviterName: string,
    orgName: string,
    role: string,
    token: string
  ): Promise<EmailResult> {
    const acceptUrl = `${envConfig.email.frontendUrl}/invite/accept?token=${token}`;
    const template = invitationEmail(inviterName, orgName, role, acceptUrl);

    return this.sendRaw({ to, ...template });
  }

  /**
   * Sends a welcome email after successful registration.
   */
  async sendWelcome(
    to: string,
    userName: string,
    orgName: string
  ): Promise<EmailResult> {
    const template = welcomeEmail(userName, orgName);
    return this.sendRaw({ to, ...template });
  }

  /**
   * Sends a password reset email with the reset link.
   * resetToken is the raw token (before hashing) from auth.service.
   */
  async sendPasswordReset(
    to: string,
    userName: string,
    resetToken: string
  ): Promise<EmailResult> {
    const resetUrl = `${envConfig.email.frontendUrl}/reset-password?token=${resetToken}`;
    const template = passwordResetEmail(userName, resetUrl);

    return this.sendRaw({ to, ...template });
  }
}

export default new EmailService();