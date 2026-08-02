import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  ...props
}: FormFieldProps) {
  const generatedId = React.useId();
  const descriptionId = `${generatedId}-description`;
  const isDirectControl = React.isValidElement(children) && (
    typeof children.type !== "string" || ["input", "select", "textarea"].includes(children.type)
  );
  const childProps = isDirectControl
    ? (children.props as {
        id?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean | "true" | "false";
        "aria-required"?: boolean | "true" | "false";
      })
    : null;
  const controlId = childProps?.id || htmlFor || generatedId;
  const describedBy = [childProps?.["aria-describedby"], error || hint ? descriptionId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const control = isDirectControl
    ? React.cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : childProps?.["aria-invalid"],
        "aria-required": required ? true : childProps?.["aria-required"],
      } as React.HTMLAttributes<HTMLElement>)
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <label htmlFor={isDirectControl ? controlId : htmlFor} className="text-xs font-bold text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={descriptionId} className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
