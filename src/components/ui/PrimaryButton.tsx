"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";

type PrimaryButtonProps = ComponentPropsWithoutRef<typeof Button>;

/** @deprecated Use Button diretamente. Mantido como alias sem implementação visual própria. */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ variant = "primary", ...props }, ref) => (
    <Button ref={ref} variant={variant} {...props} />
  ),
);

PrimaryButton.displayName = "PrimaryButton";
