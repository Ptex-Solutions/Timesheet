import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

const ROLE_VARIANTS: Record<Role, NonNullable<BadgeProps["variant"]>> = {
  EMPLOYEE: "info",
  MANAGER: "brand",
  ADMIN: "warning",
  SUPER_ADMIN: "danger",
};

// No hooks, so usable from both server and client components.
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge variant={ROLE_VARIANTS[role]} className={className}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}
