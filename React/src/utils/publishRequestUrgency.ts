// Shared aging/urgency logic for "publish my book" requests.
// Used by both the editor's PublishRequestsBell and the admin oversight panel
// so a stale request looks the same everywhere it's shown.

export type UrgencyLevel = "fresh" | "aging" | "overdue";

const AGING_THRESHOLD_HOURS = 24;   // amber after 1 day
const OVERDUE_THRESHOLD_HOURS = 72; // red after 3 days

export function getUrgencyLevel(createdAt: string): UrgencyLevel {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours >= OVERDUE_THRESHOLD_HOURS) return "overdue";
  if (hours >= AGING_THRESHOLD_HOURS) return "aging";
  return "fresh";
}

export function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}