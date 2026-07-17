import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  name: string;
  size?: number; // px
  className?: string;
}

export function Avatar({ src, name, size = 32, className }: Props) {
  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary", className)}
    >
      <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
    </div>
  );
}