/**
 * @file health-score.algorithm.ts
 * @description Organization Project Health Score Algorithm.
 *
 * THIS IS YOUR UNIQUE FEATURE.
 * No major SaaS platform (Jira, Asana, Notion, Linear) provides
 * a real-time composite health score like this for free.
 *
 * WHAT IS A HEALTH SCORE?
 * A single number (0-100) that tells you how healthy your
 * organization's project work is RIGHT NOW.
 *
 * 100 = everything on track, team balanced, no overdue work
 *   0 = severely overdue, team burned out, projects stalled
 *
 * HOW IT IS CALCULATED:
 * Five signals are measured and combined with weights:
 *
 * SIGNAL 1 — Overdue Rate (25% weight)
 * What % of active tasks are past their due date?
 * 0% overdue  → score 100
 * 50% overdue → score 0
 * Formula: score = max(0, 100 - (overdueRate × 200))
 *
 * SIGNAL 2 — Task Completion Velocity (25% weight)
 * How many tasks were completed in the last 7 days?
 * Compared to how many are currently active.
 * High velocity = healthy team = high score
 * Formula: score = min(100, (completedLast7Days / activeTotal) × 500)
 *
 * SIGNAL 3 — Team Workload Balance (20% weight)
 * Is work distributed evenly or is one person overloaded?
 * Uses coefficient of variation (standard deviation / mean).
 * Low variation = balanced = high score
 * Formula: score = max(0, 100 - (cv × 100))
 *
 * SIGNAL 4 — Project Activity (20% weight)
 * Are projects being actively worked on?
 * Measures % of projects with activity in last 5 days.
 * Formula: score = (activeProjects / totalProjects) × 100
 *
 * SIGNAL 5 — Completion Rate (10% weight)
 * Of all tasks ever created, what % are done?
 * Formula: score = (doneTasks / totalTasks) × 100
 *
 * FINAL SCORE:
 * (signal1 × 0.25) + (signal2 × 0.25) + (signal3 × 0.20)
 * + (signal4 × 0.20) + (signal5 × 0.10)
 *
 * COMPLEXITY: O(n) where n = number of active tasks
 */

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface HealthInput {
  activeTasks: {
    id: string;
    assignedTo: string | null;
    dueDate: Date | null;
    status: string;
    projectId: string;
    updatedAt: Date;
  }[];
  completedLast7Days: number;
  totalTasksEver: number;
  totalProjects: number;
}

export interface MemberRisk {
  userId: string;
  name: string;
  activeTaskCount: number;
  burnoutRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  burnoutScore: number; // 0-100
}

export interface HealthScoreResult {
  // Overall score
  overallScore: number;          // 0-100
  healthLabel: 'EXCELLENT' | 'GOOD' | 'AT_RISK' | 'CRITICAL';

  // Individual signal scores (before weighting)
  signals: {
    overdueRate: number;         // 0-100
    velocity: number;            // 0-100
    workloadBalance: number;     // 0-100
    projectActivity: number;     // 0-100
    completionRate: number;      // 0-100
  };

  // Key metrics
  metrics: {
    totalActiveTasks: number;
    overdueTasks: number;
    overduePercent: number;
    completedLast7Days: number;
    inactiveProjects: number;
  };

  // Per-member burnout risk
  memberRisks: MemberRisk[];

  // Who to assign next task to
  recommendedAssignee: {
    userId: string;
    name: string;
    currentLoad: number;
    reason: string;
  } | null;
}

// ─────────────────────────────────────────
// SIGNAL CALCULATORS
// Each returns 0-100
// ─────────────────────────────────────────

/**
 * SIGNAL 1: Overdue rate score.
 * Higher overdue % = lower score.
 * Penalizes heavily — even 10% overdue drops score by 20 points.
 */
function calcOverdueScore(
  activeTasks: HealthInput['activeTasks'],
): { score: number; overdueCount: number; overduePercent: number } {
  const now = new Date();
  const total = activeTasks.length;

  if (total === 0) return { score: 100, overdueCount: 0, overduePercent: 0 };

  const overdueCount = activeTasks.filter(
    (t) => t.dueDate && t.dueDate < now,
  ).length;

  const overdueRate = overdueCount / total; // 0 to 1
  // Heavy penalty: 50% overdue → score 0
  const score = Math.max(0, 100 - overdueRate * 200);

  return {
    score: Math.round(score * 100) / 100,
    overdueCount,
    overduePercent: Math.round(overdueRate * 100),
  };
}

/**
 * SIGNAL 2: Task completion velocity score.
 * More completions recently = healthier team = higher score.
 */
function calcVelocityScore(
  completedLast7Days: number,
  activeTotal: number,
): number {
  if (activeTotal === 0) return 100;

  // Velocity ratio: completions vs current backlog
  // If you complete 20% of your backlog per week = very healthy
  const ratio = completedLast7Days / activeTotal;
  const score = Math.min(100, ratio * 500);

  return Math.round(score * 100) / 100;
}

/**
 * SIGNAL 3: Workload balance score.
 * Uses Coefficient of Variation (CV = stdDev / mean).
 * CV close to 0 = everyone has similar load = balanced.
 * CV > 1 = one person has way more work = unbalanced.
 *
 * WHY CV?
 * Simple max/min comparison does not account for team size.
 * CV normalizes by the mean so it works for any team size.
 */
function calcWorkloadBalanceScore(
  activeTasks: HealthInput['activeTasks'],
): { score: number; taskCounts: Map<string, number> } {
  const taskCounts = new Map<string, number>();

  for (const task of activeTasks) {
    if (task.assignedTo) {
      taskCounts.set(
        task.assignedTo,
        (taskCounts.get(task.assignedTo) ?? 0) + 1,
      );
    }
  }

  const counts = Array.from(taskCounts.values());

  if (counts.length === 0) return { score: 100, taskCounts };
  if (counts.length === 1) return { score: 80, taskCounts }; // Only 1 person — assume ok

  // Mean
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;

  if (mean === 0) return { score: 100, taskCounts };

  // Standard deviation
  const variance =
    counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (0 = perfectly balanced, 1+ = very unbalanced)
  const cv = stdDev / mean;

  // Score: lower CV = higher score
  const score = Math.max(0, 100 - cv * 100);

  return { score: Math.round(score * 100) / 100, taskCounts };
}

/**
 * SIGNAL 4: Project activity score.
 * What % of projects had activity in the last 5 days?
 */
function calcProjectActivityScore(
  activeTasks: HealthInput['activeTasks'],
  totalProjects: number,
): { score: number; inactiveCount: number } {
  if (totalProjects === 0) return { score: 100, inactiveCount: 0 };

  const INACTIVE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
  const now = new Date();

  // Find latest activity per project
  const lastActivity = new Map<string, Date>();
  for (const task of activeTasks) {
    const current = lastActivity.get(task.projectId);
    if (!current || task.updatedAt > current) {
      lastActivity.set(task.projectId, task.updatedAt);
    }
  }

  const inactiveCount = Array.from(lastActivity.values()).filter(
    (d) => now.getTime() - d.getTime() > INACTIVE_THRESHOLD_MS,
  ).length;

  const activeProjects = totalProjects - inactiveCount;
  const score = (activeProjects / totalProjects) * 100;

  return {
    score: Math.round(score * 100) / 100,
    inactiveCount,
  };
}

/**
 * SIGNAL 5: Overall completion rate score.
 */
function calcCompletionRateScore(
  activeTasks: HealthInput['activeTasks'],
  totalTasksEver: number,
): number {
  if (totalTasksEver === 0) return 100;

  const doneTasks = totalTasksEver - activeTasks.length;
  const rate = doneTasks / totalTasksEver;

  return Math.round(rate * 10000) / 100; // percentage
}

/**
 * Convert numeric score to label.
 */
function getHealthLabel(
  score: number,
): HealthScoreResult['healthLabel'] {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'AT_RISK';
  return 'CRITICAL';
}

// ─────────────────────────────────────────
// BURNOUT RISK
// ─────────────────────────────────────────

/**
 * Calculate burnout risk per team member.
 *
 * BURNOUT SCORE formula:
 * score = min(100, taskCount × 10)
 * 1-3 tasks  → LOW risk
 * 4-6 tasks  → MEDIUM risk
 * 7+ tasks   → HIGH risk
 *
 * This is a simplified model. In production you would also
 * factor in hours logged, task complexity, and consecutive
 * overdue tasks. For a college project, task count is sufficient.
 */
function calcBurnoutRisks(
  taskCounts: Map<string, number>,
  nameMap: Map<string, string>,
): MemberRisk[] {
  const risks: MemberRisk[] = [];

  for (const [userId, count] of taskCounts.entries()) {
    const burnoutScore = Math.min(100, count * 10);
    let burnoutRisk: MemberRisk['burnoutRisk'];

    if (count >= 7) burnoutRisk = 'HIGH';
    else if (count >= 4) burnoutRisk = 'MEDIUM';
    else burnoutRisk = 'LOW';

    risks.push({
      userId,
      name: nameMap.get(userId) ?? 'Unknown',
      activeTaskCount: count,
      burnoutRisk,
      burnoutScore,
    });
  }

  // Sort by burnout score descending
  return risks.sort((a, b) => b.burnoutScore - a.burnoutScore);
}

// ─────────────────────────────────────────
// RECOMMENDED ASSIGNEE
// ─────────────────────────────────────────

/**
 * Find the best person to assign the next task to.
 * Simple rule: pick the active member with the fewest current tasks.
 * This promotes workload balance automatically.
 */
function findRecommendedAssignee(
  taskCounts: Map<string, number>,
  nameMap: Map<string, string>,
): HealthScoreResult['recommendedAssignee'] {
  if (taskCounts.size === 0) return null;

  let minCount = Infinity;
  let minUserId = '';

  for (const [userId, count] of taskCounts.entries()) {
    if (count < minCount) {
      minCount = count;
      minUserId = userId;
    }
  }

  if (!minUserId) return null;

  return {
    userId: minUserId,
    name: nameMap.get(minUserId) ?? 'Unknown',
    currentLoad: minCount,
    reason: `Lowest current workload (${minCount} active task${minCount !== 1 ? 's' : ''})`,
  };
}

// ─────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────

/**
 * Calculate the full health score for an organization.
 *
 * @param input  - Pre-fetched task data from the database
 * @param nameMap - Map of userId → full name for display
 * @returns Complete health score result with all signals and recommendations
 */
export function calculateHealthScore(
  input: HealthInput,
  nameMap: Map<string, string>,
): HealthScoreResult {
  const { activeTasks, completedLast7Days, totalTasksEver, totalProjects } = input;

  // ── CALCULATE ALL SIGNALS ────────────────────────────────

  const { score: s1, overdueCount, overduePercent } =
    calcOverdueScore(activeTasks);

  const s2 = calcVelocityScore(completedLast7Days, activeTasks.length);

  const { score: s3, taskCounts } = calcWorkloadBalanceScore(activeTasks);

  const { score: s4, inactiveCount } =
    calcProjectActivityScore(activeTasks, totalProjects);

  const s5 = calcCompletionRateScore(activeTasks, totalTasksEver);

  // ── WEIGHTED FINAL SCORE ─────────────────────────────────

  const overallScore =
    s1 * 0.25 +
    s2 * 0.25 +
    s3 * 0.20 +
    s4 * 0.20 +
    s5 * 0.10;

  const finalScore = Math.round(overallScore * 100) / 100;

  // ── BURNOUT RISKS ────────────────────────────────────────

  const memberRisks = calcBurnoutRisks(taskCounts, nameMap);

  // ── RECOMMENDED ASSIGNEE ─────────────────────────────────

  const recommendedAssignee = findRecommendedAssignee(taskCounts, nameMap);

  return {
    overallScore: finalScore,
    healthLabel: getHealthLabel(finalScore),
    signals: {
      overdueRate: s1,
      velocity: s2,
      workloadBalance: s3,
      projectActivity: s4,
      completionRate: s5,
    },
    metrics: {
      totalActiveTasks: activeTasks.length,
      overdueTasks: overdueCount,
      overduePercent,
      completedLast7Days,
      inactiveProjects: inactiveCount,
    },
    memberRisks,
    recommendedAssignee,
  };
}