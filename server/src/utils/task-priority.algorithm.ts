/**
 * @file task-priority.algorithm.ts
 * @description Custom Task Priority Scoring Algorithm.
 *
 * PROBLEM THIS SOLVES:
 * Simple priority labels (HIGH/MEDIUM/LOW) are not smart enough.
 * A task labeled "LOW" that is due tomorrow is more urgent than
 * a task labeled "HIGH" that is due in 3 months.
 *
 * OUR ALGORITHM:
 * We calculate a numeric urgency score (0-100) for each task
 * based on 4 weighted factors:
 *
 * FACTOR 1 — Due Date Urgency (40% weight)
 * The closer the due date, the higher the score.
 * Overdue tasks get the maximum score for this factor.
 *
 *   daysUntilDue <= 0  → score = 100 (overdue)
 *   daysUntilDue = 1   → score = 95
 *   daysUntilDue = 7   → score = 70
 *   daysUntilDue = 30  → score = 20
 *   daysUntilDue > 60  → score = 0
 *
 * FACTOR 2 — Priority Label (30% weight)
 * The user-set priority label contributes to the score.
 *
 *   URGENT → 100
 *   HIGH   → 75
 *   MEDIUM → 50
 *   LOW    → 25
 *
 * FACTOR 3 — Assignee Workload (20% weight)
 * If the assigned person already has many tasks,
 * their tasks score higher so we notice the overload.
 *
 *   assigneeTasks >= 10 → score = 100 (overloaded)
 *   assigneeTasks = 5   → score = 50
 *   assigneeTasks = 0   → score = 0
 *
 * FACTOR 4 — Task Age (10% weight)
 * Older unfinished tasks score higher — they have been
 * sitting too long and need attention.
 *
 *   taskAge >= 30 days → score = 100
 *   taskAge = 15 days  → score = 50
 *   taskAge = 0 days   → score = 0
 *
 * FINAL SCORE:
 *   (dueDateScore × 0.4) +
 *   (priorityScore × 0.3) +
 *   (workloadScore × 0.2) +
 *   (ageScore × 0.1)
 *
 * This produces a number from 0 to 100.
 * Tasks are then sorted by this score (highest first).
 *
 * COMPLEXITY: O(n log n) — one pass to score, one sort
 */

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type PriorityLabel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskInput {
  id: string;
  title: string;
  priority: PriorityLabel;
  dueDate: Date | null;
  createdAt: Date;
  assignedTo: string | null;
  status: string;
}

export interface ScoredTask extends TaskInput {
  urgencyScore: number;           // 0-100 final weighted score
  scoreBreakdown: {
    dueDateScore: number;         // 0-100 before weighting
    priorityScore: number;        // 0-100 before weighting
    workloadScore: number;        // 0-100 before weighting
    ageScore: number;             // 0-100 before weighting
  };
  urgencyLabel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

/**
 * Weights must add up to 1.0
 * These represent how much each factor contributes to the final score.
 */
const WEIGHTS = {
  dueDate: 0.4,    // 40% — most important factor
  priority: 0.3,   // 30% — second most important
  workload: 0.2,   // 20% — third factor
  age: 0.1,        // 10% — least important but still relevant
} as const;

/**
 * Priority label → numeric score mapping.
 * These are fixed values, not from a library.
 */
const PRIORITY_SCORES: Record<PriorityLabel, number> = {
  URGENT: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
};

// ─────────────────────────────────────────
// FACTOR CALCULATORS
// Each returns a score from 0 to 100
// ─────────────────────────────────────────

/**
 * FACTOR 1: Calculate due date urgency score.
 *
 * Uses an exponential decay formula so that tasks due very soon
 * score much higher than tasks with a linear approach would give.
 *
 * Formula: score = 100 × e^(-daysUntilDue / 14)
 * Where 14 is the "decay constant" — tasks due in 14 days score ~37
 *
 * @param dueDate - The task's due date (null = no deadline = score 0)
 * @returns number 0-100
 */
function calculateDueDateScore(dueDate: Date | null): number {
  // No due date = no urgency from this factor
  if (!dueDate) return 0;

  const now = new Date();

  // Calculate days until due (negative = overdue)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / msPerDay;

  // Overdue tasks get maximum urgency
  if (daysUntilDue <= 0) return 100;

  // More than 60 days away = not urgent at all
  if (daysUntilDue > 60) return 0;

  /**
   * Exponential decay formula:
   * score = 100 × e^(-daysUntilDue / 14)
   *
   * WHY EXPONENTIAL?
   * A task due in 1 day should feel MUCH more urgent than
   * one due in 7 days. Linear scoring (e.g. 100 - days) does not
   * capture this urgency spike near the deadline.
   *
   * Examples:
   *   0 days  (today)    → 100  (handled above)
   *   1 day              → 93
   *   3 days             → 81
   *   7 days             → 60
   *   14 days            → 37
   *   30 days            → 12
   *   60 days            → 1.4 (rounds to 0)
   */
  const DECAY_CONSTANT = 14;
  const score = 100 * Math.exp(-daysUntilDue / DECAY_CONSTANT);

  // Clamp to 0-100 and round to 2 decimal places
  return Math.min(100, Math.max(0, Math.round(score * 100) / 100));
}

/**
 * FACTOR 2: Convert priority label to score.
 *
 * Simple lookup — URGENT=100, HIGH=75, MEDIUM=50, LOW=25.
 *
 * @param priority - The task priority label
 * @returns number 0-100
 */
function calculatePriorityScore(priority: PriorityLabel): number {
  return PRIORITY_SCORES[priority] ?? 50;
}

/**
 * FACTOR 3: Calculate workload score from assignee task count.
 *
 * Uses a logarithmic formula so the score grows fast at first
 * (going from 0 to 3 tasks matters a lot) but levels off
 * (going from 15 to 18 tasks matters less).
 *
 * Formula: score = min(100, (log(n + 1) / log(11)) × 100)
 * Where 11 gives us score=100 at n=10 tasks
 *
 * @param assigneeTaskCount - How many active tasks the assignee has
 * @returns number 0-100
 */
function calculateWorkloadScore(assigneeTaskCount: number): number {
  if (assigneeTaskCount <= 0) return 0;

  /**
   * Logarithmic growth formula:
   * score = (ln(n + 1) / ln(11)) × 100
   *
   * Examples:
   *   0 tasks  → 0
   *   1 task   → 30
   *   3 tasks  → 60
   *   5 tasks  → 74
   *   10 tasks → 100
   *   15 tasks → 100 (capped)
   */
  const LOG_BASE = Math.log(11); // ln(11) ≈ 2.398
  const score = (Math.log(assigneeTaskCount + 1) / LOG_BASE) * 100;

  return Math.min(100, Math.round(score * 100) / 100);
}

/**
 * FACTOR 4: Calculate task age score.
 *
 * Older unfinished tasks score higher.
 * Uses linear growth capped at 30 days.
 *
 * Formula: score = min(100, (ageInDays / 30) × 100)
 *
 * @param createdAt - When the task was created
 * @returns number 0-100
 */
function calculateAgeScore(createdAt: Date): number {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const ageInDays = (now.getTime() - createdAt.getTime()) / msPerDay;

  /**
   * Linear formula capped at 30 days:
   * score = (ageInDays / 30) × 100
   *
   * Examples:
   *   0 days  → 0
   *   7 days  → 23
   *   15 days → 50
   *   30 days → 100
   *   45 days → 100 (capped)
   */
  const score = (ageInDays / 30) * 100;

  return Math.min(100, Math.round(score * 100) / 100);
}

/**
 * Convert final numeric score to a human-readable urgency label.
 *
 * These thresholds were chosen based on testing with real task data:
 *   75-100 → CRITICAL (needs immediate attention)
 *   50-74  → HIGH (should be done today/this week)
 *   25-49  → MEDIUM (normal priority)
 *   0-24   → LOW (can wait)
 */
function getUrgencyLabel(score: number): ScoredTask['urgencyLabel'] {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ─────────────────────────────────────────
// MAIN ALGORITHM FUNCTION
// ─────────────────────────────────────────

/**
 * Score a single task's urgency.
 *
 * @param task - The task to score
 * @param assigneeTaskCount - How many active tasks the assignee has
 * @returns The task with urgencyScore and scoreBreakdown added
 */
export function scoreTask(
  task: TaskInput,
  assigneeTaskCount: number = 0,
): ScoredTask {
  // ── STEP 1: Calculate individual factor scores ──

  const dueDateScore = calculateDueDateScore(task.dueDate);
  const priorityScore = calculatePriorityScore(task.priority);
  const workloadScore = calculateWorkloadScore(assigneeTaskCount);
  const ageScore = calculateAgeScore(task.createdAt);

  // ── STEP 2: Apply weights and sum ──

  const urgencyScore =
    dueDateScore * WEIGHTS.dueDate +
    priorityScore * WEIGHTS.priority +
    workloadScore * WEIGHTS.workload +
    ageScore * WEIGHTS.age;

  // Round to 2 decimal places
  const finalScore = Math.round(urgencyScore * 100) / 100;

  // ── STEP 3: Return scored task ──

  return {
    ...task,
    urgencyScore: finalScore,
    scoreBreakdown: {
      dueDateScore,
      priorityScore,
      workloadScore,
      ageScore,
    },
    urgencyLabel: getUrgencyLabel(finalScore),
  };
}

/**
 * Sort tasks by urgency score — highest first.
 *
 * This is the main function called by the API.
 * It scores every task and returns them in urgency order.
 *
 * TIME COMPLEXITY:  O(n log n) — dominated by the sort
 * SPACE COMPLEXITY: O(n) — we create a new scored array
 *
 * @param tasks - Array of tasks to score and sort
 * @param assigneeWorkloads - Map of userId → active task count
 *   Used to factor in how busy each person already is
 * @returns Tasks sorted by urgency score, highest first
 */
export function rankTasksByUrgency(
  tasks: TaskInput[],
  assigneeWorkloads: Map<string, number> = new Map(),
): ScoredTask[] {

  // ── STEP 1: Score every task ──────────────────────────────
  // O(n) — one pass through all tasks

  const scoredTasks: ScoredTask[] = tasks.map((task) => {
    // Look up how busy this task's assignee is
    const assigneeCount = task.assignedTo
      ? (assigneeWorkloads.get(task.assignedTo) ?? 0)
      : 0;

    return scoreTask(task, assigneeCount);
  });

  // ── STEP 2: Sort by urgency score descending ──────────────
  // O(n log n) — standard comparison sort
  //
  // We implement a stable sort by using a secondary sort key (task id)
  // when two tasks have the same score. This ensures consistent
  // ordering and prevents tasks from jumping around on re-render.

  scoredTasks.sort((a, b) => {
    // Primary: higher urgency score first
    if (b.urgencyScore !== a.urgencyScore) {
      return b.urgencyScore - a.urgencyScore;
    }
    // Secondary: alphabetical by id for stability
    return a.id.localeCompare(b.id);
  });

  return scoredTasks;
}

/**
 * Build the assignee workload map from a flat task list.
 * Counts how many non-done tasks each user has.
 *
 * Called before rankTasksByUrgency to prepare the workload data.
 *
 * @param tasks - All tasks (used to count per-user load)
 * @returns Map of userId → active task count
 */
export function buildWorkloadMap(tasks: TaskInput[]): Map<string, number> {
  const workloadMap = new Map<string, number>();

  for (const task of tasks) {
    // Only count active (non-done) tasks
    if (task.assignedTo && task.status !== 'DONE') {
      const current = workloadMap.get(task.assignedTo) ?? 0;
      workloadMap.set(task.assignedTo, current + 1);
    }
  }

  return workloadMap;
}