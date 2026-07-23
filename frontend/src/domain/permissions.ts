import type { UserRole } from "../auth/contracts";

export function canApprove(roles: UserRole[] | undefined): boolean {
  return Boolean(roles?.some((role) => role === "reviewer" || role === "admin"));
}
