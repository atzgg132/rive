import * as React from "react";
import { cn } from "@/lib/utils";

const avatarSizes = {
  sm: "h-7 w-7 text-[.6rem]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof avatarSizes;
  color?: string;
}

export function Avatar({ size = "md", color, className, style, children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/[0.12] font-extrabold uppercase text-primary",
        avatarSizes[size],
        className,
      )}
      style={color ? { ...style, backgroundColor: color } : style}
      {...props}
    >
      {children}
    </div>
  );
}
