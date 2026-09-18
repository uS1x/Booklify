import { READING_STATUS_META, type ReadingStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function StatusBadge({
  status,
  className,
  withEmoji = true,
  short,
}: {
  status: ReadingStatus;
  className?: string;
  withEmoji?: boolean;
  short?: boolean;
}) {
  const meta = READING_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={cn(className)}>
      {withEmoji ? <span aria-hidden>{meta.emoji}</span> : <span className={cn("size-1.5 rounded-full", meta.dot)} />}
      {short ? meta.short : meta.label}
    </Badge>
  );
}
