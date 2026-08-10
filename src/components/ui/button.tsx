"use client";

import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold leading-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        unstyled: "",
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-px",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        outline:
          "border border-border bg-background/80 text-foreground shadow-sm hover:border-primary/30 hover:bg-accent hover:text-accent-foreground",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        unstyled: "",
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-5 text-sm",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 rounded-lg p-0",
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
