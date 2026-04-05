/**
 * @file email.processor.ts
 * @description Bull queue processor — consumes jobs from the email queue
 *              and delegates to EmailService for actual sending.
 *
 * KEY CONCEPTS:
 * - This file MUST be imported once at app startup (in app.ts or server.ts)
 * - It registers the queue processor with Bull via emailQueue.process()
 * - Each job type maps to a corresponding EmailService method
 * - Throwing inside the processor triggers Bull's retry logic automatically
 *
 * Flow:
 *   addEmailJob() → emailQueue (Redis) → processor picks up → emailService.sendX()
 */

// If email.service.ts is the “sender”, then this is the “worker” that actually processes queued jobs.
// 1. What this file does (big picture)
// 👉 This file connects your queue to your email service using Bull.

// Flow:
// Controller/Service
//    ↓
// addEmailJob()
//    ↓
// Redis Queue (emailQueue)
//    ↓
// 📌 email.processor.ts (THIS FILE)
//    ↓
// emailService.sendX()
//    ↓
// Email sent

// 👉 So this file is:
// A background worker that listens to jobs and executes them

//Without this file:
// ❌ Jobs will be added to queue
// ❌ BUT nothing will process them

import { Job } from 'bull';
import logger from '@/utils/logger';
import emailService from './email.service';
import {
  emailQueue,
  EmailJobData,
  EmailJobType,
  InvitationJobData,
  WelcomeJobData,
  PasswordResetJobData,
  EmailVerificationJobData,
} from './email.queue';

// ─────────────────────────────────────────
// PROCESSOR REGISTRATION
// ─────────────────────────────────────────

// What this means:
// ✅ process:  Registers a worker
// ✅ 5 : 👉 Concurrency = 5
// Meaning : Up to 5 emails can be processed at the same time

emailQueue.process(5, async (job: Job<EmailJobData>) => {
  const { type, data } = job.data;

  logger.info('Processing email job', { jobId: job.id, type });

  switch (type) {

    // ─────────────────────────────────────────
    // INVITATION
    // ─────────────────────────────────────────
    case EmailJobType.INVITATION: {
      const { to, inviterName, orgName, role, token } = data as InvitationJobData;
      const result = await emailService.sendInvitation(to, inviterName, orgName, role, token);

      if (!result.success) {
        // Throwing causes Bull to retry the job
        throw new Error(`Invitation email failed: ${result.error}`);
      }
      break;
    }

    // ─────────────────────────────────────────
    // WELCOME
    // ─────────────────────────────────────────
    case EmailJobType.WELCOME: {
      const { to, userName, orgName } = data as WelcomeJobData;
      const result = await emailService.sendWelcome(to, userName, orgName);

      if (!result.success) {
        throw new Error(`Welcome email failed: ${result.error}`);
      }
      break;
    }

    // ─────────────────────────────────────────
    // PASSWORD RESET
    // ─────────────────────────────────────────
    case EmailJobType.PASSWORD_RESET: {
      const { to, userName, resetToken } = data as PasswordResetJobData;
      const result = await emailService.sendPasswordReset(to, userName, resetToken);

      if (!result.success) {
        throw new Error(`Password reset email failed: ${result.error}`);
      }
      break;
    }

    case EmailJobType.EMAIL_VERIFICATION: {
      const { to, userName, verificationToken } = data as EmailVerificationJobData;
      const result = await emailService.sendEmailVerification(to, userName, verificationToken);
      if (!result.success) {
        throw new Error(`Verification email failed: ${result.error}`);
      }
      break;
    }

    // ─────────────────────────────────────────
    // UNKNOWN TYPE
    // ─────────────────────────────────────────
    default: {
      logger.warn('Unknown email job type received', { type, jobId: job.id });
      break;
    }
  }
});

logger.info('Email queue processor registered (concurrency: 5)');