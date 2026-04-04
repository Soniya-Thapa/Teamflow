/**
 * @file email.service.ts
 * @description Email sending via Nodemailer + Gmail SMTP.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';
import {
  invitationEmail,
  welcomeEmail,
  passwordResetEmail,
} from './email.templates';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: Transporter;
  private from: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: envConfig.email.smtpHost,
      port: envConfig.email.smtpPort,
      secure: false,
      auth: {
        user: envConfig.email.smtpUser,
        pass: envConfig.email.smtpPass,
      },
    });

    this.from = `${envConfig.email.fromName} <${envConfig.email.from}>`;

    logger.info('Email service (Gmail SMTP) initialized');
  }

  private async sendRaw(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<EmailResult> {
    const { to, subject, html } = options;

    try {
      logger.info('Sending email', { to, subject });

      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
      });

      return { success: true, messageId: info.messageId };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Email send failed', { to, subject, error: message });
      return { success: false, error: message };
    }
  }

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

  async sendWelcome(
    to: string,
    userName: string,
    orgName: string
  ): Promise<EmailResult> {
    const template = welcomeEmail(userName, orgName);
    return this.sendRaw({ to, ...template });
  }

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