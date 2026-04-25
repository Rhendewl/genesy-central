"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn("lc-btn", className)} {...props} />
  )
);

PrimaryButton.displayName = "PrimaryButton";
