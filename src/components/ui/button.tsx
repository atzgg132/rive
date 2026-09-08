"use client";

import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold leading-none tracking-[-0.01em] transition-[transform,background-color,color,border-color] duration-150 ease-rive-out hover:-translate-y-px active:translate-y-0 disabled:translate-y-0 disabled:opacity-55 disabled:pointer-events-none data-[disabled]:translate-y-0 data-[disabled]:opacity-55 data-[disabled]:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        unstyled: "",
        default:
          "border border-primary bg-primary text-primary-foreground hover:border-primary-strong hover:bg-primary-strong",
        inverse:
          "inverse-block border border-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        secondary:
          "border border-border bg-card text-foreground hover:bg-muted",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        ghost: "text-foreground hover:bg-foreground/[.06] hover:translate-y-0",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground hover:opacity-90",
        link: "h-auto p-0 text-primary underline-offset-4 hover:translate-y-0 hover:underline",
      },
      size: {
        unstyled: "",
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "unstyled",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof BaseButton>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    // Legacy surfaces often provide their complete visual treatment via
    // className. Bare buttons, however, should behave like real primary
    // actions instead of falling back to the browser's inset button chrome.
    const resolvedVariant = variant ?? (className ? "unstyled" : "default");
    const resolvedSize = size ?? (className && variant === undefined ? "unstyled" : "default");
    return (
      <BaseButton
        ref={ref}
        className={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
