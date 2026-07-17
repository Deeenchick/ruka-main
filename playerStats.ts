import * as React from "react";
import { cn } from "@/lib/utils";
 
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base (16px) below the sm breakpoint, text-sm (14px) at sm+ —
        // iOS Safari auto-zooms on focus into any input with font-size < 16px
        // and doesn't zoom back out on blur. Keeping it at 16px on mobile
        // avoids that entirely without affecting the desktop look.
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";