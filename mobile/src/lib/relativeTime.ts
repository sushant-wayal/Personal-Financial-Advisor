/**
 * Formats a transaction timestamp into human-readable relative time ending with "before":
 * - "x secs before"
 * - "x min before"
 * - "x hour before" / "x hours before"
 * - "x days before"
 * - "x months before"
 * - "x years before"
 */
export function formatRelativeTime(
  value?: string | Date | null,
  referenceDate: Date = new Date()
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";

  const diffMs = referenceDate.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    const s = Math.max(0, diffSec);
    return `${s} ${s === 1 ? "sec" : "secs"} before`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} min before`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} before`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} before`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} before`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} ${diffYears === 1 ? "year" : "years"} before`;
}
