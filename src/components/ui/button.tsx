"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Children, isValidElement, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "genesy-button group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "[background:linear-gradient(90deg,#0b0c20_0%,#404549_55%,#404549_100%)] !border-transparent text-white hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95",
        primary: "[background:linear-gradient(90deg,#0b0c20_0%,#404549_55%,#404549_100%)] !border-transparent text-white hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        success: "bg-emerald-600 text-white hover:bg-emerald-500",
        danger: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        warning: "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "genesy-button--md h-8 gap-1.5 px-2.5",
        medium: "genesy-button--md h-8 gap-1.5 px-2.5",
        xs: "genesy-button--xs h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "genesy-button--sm h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        small: "genesy-button--sm h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "genesy-button--lg h-9 gap-1.5 px-2.5",
        large: "genesy-button--lg h-9 gap-1.5 px-2.5",
        icon: "genesy-button--icon genesy-button--md size-8",
        "icon-xs": "genesy-button--icon genesy-button--xs size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "genesy-button--icon genesy-button--sm size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "genesy-button--icon genesy-button--lg size-9",
      },
      fullWidth: { true: "genesy-button--full w-full" },
      signature: { true: "genesy-button--signature" },
    },
    defaultVariants: { variant: "default", size: "default", signature: false },
  },
)

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    icon?: ReactNode
    loading?: boolean
    loadingLabel?: ReactNode
  }

function separateIcon(children: ReactNode, explicitIcon?: ReactNode, forceIcon = false) {
  if (explicitIcon !== undefined) return { icon: explicitIcon, label: children, a11yLabel: null }
  const items = Children.toArray(children)
  if (forceIcon && items.length > 0 && isValidElement(items[0])) {
    return { icon: items[0], label: null, a11yLabel: items.slice(1) }
  }
  if (items.length > 1 && isValidElement(items[0])) {
    return { icon: items[0], label: items.slice(1), a11yLabel: null }
  }
  return { icon: null, label: children, a11yLabel: null }
}

function Button({
  className,
  variant = "default",
  size = "default",
  fullWidth,
  signature = false,
  icon: explicitIcon,
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const forceIcon = String(size).startsWith("icon")
  const content = separateIcon(children, explicitIcon, forceIcon)
  const icon = loading ? <Loader2 className="genesy-button__spinner" /> : content.icon
  const label = loading ? (loadingLabel ?? content.label) : content.label
  const iconOnly = !label

  return (
    <ButtonPrimitive
      data-slot="button"
      data-signature={signature || undefined}
      data-loading={loading || undefined}
      data-icon-only={iconOnly || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, fullWidth, signature, className }))}
      {...props}
    >
      {signature ? (
        <>
          <span className="genesy-button__disc" aria-hidden="true">
            <span className="genesy-button__icon">{icon}</span>
          </span>
          <span className="genesy-button__capsule" aria-hidden="true" />
          <span className="genesy-button__label">{label}</span>
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
      {content.a11yLabel && <span className="sr-only">{content.a11yLabel}</span>}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
