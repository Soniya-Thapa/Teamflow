/**
 * @file scheduled.jobs.ts
 * @description Scheduled background jobs using Bull's repeat option.
 *
 * JOBS:
 *   overdue-notifier  → Daily at 9AM — find tasks past due → notify assignees
 *   activity-summary  → Weekly on Monday 8AM — send digest email per org
 *
 * HOW BULL SCHEDULING WORKS:
 * When you add a job with repeat: { cron: '...' }, Bull uses Redis to
 * schedule the next occurrence. The processor picks it up when due.
 *
 * CRON FORMAT:
 *   '0 9 * * *'     → every day at 9:00 AM
 *   '0 8 * * 1'     → every Monday at 8:00 AM
 *
 * IMPORTANT:
 * Call registerScheduledJobs() once at server startup.
 * Import in server.ts after initializeSocket.
 */

import Bull from 'bull';
import prisma from '@/config/database';
import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';
import { addEmailJob, EmailJobType } from '@/modules/email/email.queue';
import { emitToUser } from '@/config/socket';
import aiDigestService from '@/modules/ai/ai-digest.service';
import emailService from '@/modules/email/email.service';
import { notificationService } from '@/modules/notifications/notification.service';

const schedulerQueue = new Bull('scheduler', {
  redis: {
    host: envConfig.redisHost,
    port: Number(envConfig.redisPort),
    password: envConfig.redisPassword || undefined,
  },
});

// ─────────────────────────────────────────
// PROCESSORS
// ─────────────────────────────────────────

schedulerQueue.process('overdue-notifier', async (job) => {
  logger.info('Running overdue-notifier job');

  const now = new Date();

  // Find all tasks that just became overdue (due today, not done)
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: now },
      status: { not: 'DONE' },
      assignedTo: { not: null },
    },
    include: {
      project: { select: { name: true } },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    take: 500, // Process max 500 per run to avoid memory issues
  });

  logger.info(`Overdue notifier found ${overdueTasks.length} overdue tasks`);

  for (const task of overdueTasks) {
    if (!task.assignee || !task.assignedTo) continue;

    // Create notification in DB
    await prisma.notification.create({
      data: {
        userId: task.assignedTo,
        organizationId: task.organizationId,
        type: 'TASK_DUE_SOON' as any,
        title: 'Task overdue',
        message: `"${task.title}" in ${task.project.name} is past its due date.`,
        metadata: { taskId: task.id, projectId: task.projectId },
      },
    });

    // Real-time push if user is online
    emitToUser(task.assignedTo, 'notification:new', {
      title: 'Task overdue',
      message: `"${task.title}" is past its due date.`,
    });
  }

  return { processed: overdueTasks.length };
});

schedulerQueue.process('activity-summary', async (job) => {
  logger.info('Running activity-summary job');

  // Get all active orgs
  const orgs = await prisma.organization.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true },
    take: 100, // Process in batches for large installs
  });

  for (const org of orgs) {
    // Get org owner to send summary to
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id, role: 'OWNER', status: 'ACTIVE' },
      include: {
        user: { select: { email: true, firstName: true } },
      },
    });

    if (!owner?.user.email) continue;

    // Count activity in last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [tasksCompleted, tasksCreated] = await Promise.all([
      prisma.task.count({
        where: {
          organizationId: org.id,
          status: 'DONE',
          updatedAt: { gte: since },
        },
      }),
      prisma.task.count({
        where: {
          organizationId: org.id,
          createdAt: { gte: since },
        },
      }),
    ]);

    // Skip orgs with no activity
    if (tasksCompleted === 0 && tasksCreated === 0) continue;

    // Queue summary email
    await addEmailJob(EmailJobType.WELCOME, {
      to: owner.user.email,
      userName: owner.user.firstName,
      orgName: `${org.name} — Weekly Summary: ${tasksCompleted} tasks completed, ${tasksCreated} created`,
    });
  }

  return { processed: orgs.length };
});

schedulerQueue.process('ai-digest', async (job) => {
  logger.info('Running ai-digest job');

  const orgs = await prisma.organization.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true },
    take: 100,
  });

  let generated = 0;

  for (const org of orgs) {
    const report = await aiDigestService.generateDigestForOrg(org.id, org.name);
    if (!report) continue;

    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id, role: 'OWNER', status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!owner?.user) continue;

    await notificationService.createNotification({
      userId: owner.user.id,
      organizationId: org.id,
      type: 'AI_DIGEST_READY' as any,
      title: 'Weekly digest ready',
      message: report.summaryText.slice(0, 120),
      metadata: { reportId: report.id },
    });

    await emailService.sendAiDigest(owner.user.email, org.name, report.summaryText);
    generated++;
  }

  return { processed: orgs.length, generated };
});

// ─────────────────────────────────────────
// REGISTER SCHEDULED JOBS
// ─────────────────────────────────────────

export async function registerScheduledJobs() {
  // Remove existing repeat jobs to avoid duplicates on restart
  const existingJobs = await schedulerQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await schedulerQueue.removeRepeatableByKey(job.key);
  }

  // Daily at 9AM — overdue task notifications
  await schedulerQueue.add(
    'overdue-notifier',
    {},
    {
      repeat: { cron: '0 9 * * *' },
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  );

  // Weekly on Monday at 8AM — activity summary emails
  await schedulerQueue.add(
    'activity-summary',
    {},
    {
      repeat: { cron: '0 8 * * 1' },
      removeOnComplete: 5,
      removeOnFail: 3,
    },
  );
  
  await schedulerQueue.add(
    'ai-digest',
    {},
    {
      repeat: { cron: '*/2 * * * *' }, // TEMP for testing — change to '0 19 * * *' once confirmed
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  );

  logger.info('Scheduled jobs registered (overdue-notifier, activity-summary)');
}