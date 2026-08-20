export const CRM_GOAL_BENCHMARKS = {
  closingRate: 20,
  attendanceRate: 75,
} as const;

export type CalculatedGoalTargets = {
  salesTarget: number;
  heldMeetingsTarget: number;
  scheduledMeetingsTarget: number;
};

export function calculateGoalTargets(revenueTarget: number, averageTicket: number): CalculatedGoalTargets | null {
  if (!Number.isFinite(revenueTarget) || !Number.isFinite(averageTicket) || revenueTarget <= 0 || averageTicket <= 0) return null;

  const salesTarget = Math.ceil(revenueTarget / averageTicket);
  const heldMeetingsTarget = Math.ceil(salesTarget / (CRM_GOAL_BENCHMARKS.closingRate / 100));
  const scheduledMeetingsTarget = Math.ceil(heldMeetingsTarget / (CRM_GOAL_BENCHMARKS.attendanceRate / 100));

  return { salesTarget, heldMeetingsTarget, scheduledMeetingsTarget };
}
