/**
 * @file email.queue.ts
 * @description Bull queue for async email sending.
 *
 * KEY CONCEPTS:
 * - Emails are never sent synchronously from services — always queued
 * - Queue backed by Redis (already running in Docker)
 * - Job types mirror EmailService methods: invitation, welcome, passwordReset
 * - Failed jobs retry 3 times with exponential backoff
 * - Completed jobs removed after 100 kept; failed jobs kept for 500
 *
 * Exports:
 * - emailQueue — the Bull queue instance
 * - EmailJobType — enum of job types
 * - addEmailJob(type, data) — the ONLY way other services add email jobs
 */

//Benefits:
// API response is fast ⚡
// Email runs in background 🧠
// Failures can retry 🔁

import Bull, { Queue, JobOptions } from 'bull';
import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';

// ─────────────────────────────────────────
// JOB TYPES & PAYLOADS
// ─────────────────────────────────────────

export enum EmailJobType {
  INVITATION = 'invitation',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'passwordReset',
  EMAIL_VERIFICATION = 'emailVerification',
}

export interface InvitationJobData {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  token: string;
}

export interface WelcomeJobData {
  to: string;
  userName: string;
  orgName: string;
}

export interface PasswordResetJobData {
  to: string;
  userName: string;
  resetToken: string;
}

export interface EmailVerificationJobData {
  to: string;
  userName: string;
  verificationToken: string;
}

export type EmailJobData =
  | { type: EmailJobType.INVITATION; data: InvitationJobData }
  | { type: EmailJobType.WELCOME; data: WelcomeJobData }
  | { type: EmailJobType.PASSWORD_RESET; data: PasswordResetJobData }
  | { type: EmailJobType.EMAIL_VERIFICATION; data: EmailVerificationJobData }; 

// ─────────────────────────────────────────
// QUEUE CONFIGURATION
// ─────────────────────────────────────────

const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s → 4s → 8s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// ─────────────────────────────────────────
// QUEUE INSTANCE
// ─────────────────────────────────────────

export const emailQueue: Queue<EmailJobData> = new Bull('email', {
  redis: {
    host: envConfig.redisHost,
    port: Number(envConfig.redisPort),
    password: envConfig.redisPassword || undefined,
  },
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

// ─────────────────────────────────────────
// QUEUE EVENT LOGGING
// ─────────────────────────────────────────

emailQueue.on('completed', (job) => {
  logger.info('Email job completed', {
    jobId: job.id,
    type: job.data.type,
  });
});

emailQueue.on('failed', (job, err) => {
  logger.error('Email job failed', {
    jobId: job.id,
    type: job.data.type,
    attempt: job.attemptsMade,
    error: err.message,
  });
});

//Means : Job started but didn’t finish

emailQueue.on('stalled', (job) => {
  logger.warn('Email job stalled', { jobId: job.id, type: job.data.type });
});

emailQueue.on('error', (err) => {
  logger.error('Email queue error', { error: err.message });
});

// ─────────────────────────────────────────
// PUBLIC API — addEmailJob
// ─────────────────────────────────────────

/**
 * Adds an email job to the queue.
 * This is the ONLY function other services should call to send emails.
 *
 * @example
 * await addEmailJob(EmailJobType.WELCOME, { to, userName, orgName });
 */
export const addEmailJob = async (
  type: EmailJobType,
  data: InvitationJobData | WelcomeJobData | PasswordResetJobData | EmailVerificationJobData 
): Promise<void> => {
  try {
    // 👉 Pushes job into Redis
    await emailQueue.add({ type, data } as EmailJobData);
    logger.info('Email job queued', { type, to: (data as { to: string }).to });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown queue error';

    // Log but never throw — email queuing failure should not block API response
    //     Here:
    // NO throw ❌
    // In processor:
    // throw new Error() ✅

    // 👉 Meaning:

    // Queue add failure → ignore (don’t block user)
    // Processing failure → retry

    logger.error('Failed to queue email job', { type, error: message });
  }
};



// User registers:
// auth.service.ts
//    ↓
// addEmailJob(WELCOME)
//    ↓
// email.queue.ts
//    ↓
// Redis
//    ↓
// email.processor.ts
//    ↓
// emailService.sendWelcome()
//    ↓
// Resend API
//    ↓
// Email delivered