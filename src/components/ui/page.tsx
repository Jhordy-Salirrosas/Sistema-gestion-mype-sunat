import * as React from "react"
import { cn } from "cn"

type PageProps = React.ComponentProps<"div">

function Page({ className, ...props }: PageProps) {
  return <div data-slot="page" className={cn("space-y-6", className)} {...props} />
}

type PageGridProps = React.ComponentProps<"div"> & {
  columns?: 2 | 3 | 4
}

function PageGrid({ className, columns = 2, ...props }: PageGridProps) {
  const columnClasses = {
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  }

  return (
    <div
      data-slot="page-grid"
      className={cn("grid gap-4", columnClasses[columns], className)}
      {...props}
    />
  )
}

type PageGridItemProps = React.ComponentProps<"div"> & {
  span?: 2
}

function PageGridItem({ className, span, ...props }: PageGridItemProps) {
  const spanClass = span === 2 ? "md:col-span-2" : undefined

  return (
    <div
      data-slot="page-grid-item"
      className={cn(spanClass, className)}
      {...props}
    />
  )
}

type PageTextProps = React.ComponentProps<"p"> & {
  as?: "p" | "span"
  variant?:
    | "body"
    | "muted"
    | "caption"
    | "label"
    | "metric"
    | "metric-destructive"
    | "error"
}

function PageText({
  as: Component = "p",
  className,
  variant = "body",
  ...props
}: PageTextProps) {
  const variantClasses = {
    body: "text-sm",
    muted: "text-sm text-muted-foreground",
    caption: "text-xs text-muted-foreground",
    label: "text-xs font-medium text-foreground",
    metric: "block text-xl font-bold text-foreground",
    "metric-destructive": "block text-xl font-bold text-destructive",
    error: "text-xs text-destructive",
  }

  return (
    <Component
      data-slot="page-text"
      data-variant={variant}
      className={cn(variantClasses[variant], className)}
      {...props}
    />
  )
}

type PageFormProps = React.ComponentProps<"form">

function PageForm({ className, ...props }: PageFormProps) {
  return (
    <form
      data-slot="page-form"
      className={cn("space-y-4", className)}
      {...props}
    />
  )
}

type PageLabelProps = React.ComponentProps<"label">

function PageLabel({ className, ...props }: PageLabelProps) {
  return (
    <label
      data-slot="page-label"
      className={cn("block text-xs font-medium text-foreground", className)}
      {...props}
    />
  )
}

interface PageFieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
}

function PageField({ label, htmlFor, children }: PageFieldProps) {
  return (
    <div data-slot="page-field" className="grid gap-1.5">
      <PageLabel htmlFor={htmlFor}>{label}</PageLabel>
      {children}
    </div>
  )
}

type PageCenterProps = React.ComponentProps<"main">

function PageCenter({ className, ...props }: PageCenterProps) {
  return (
    <main
      data-slot="page-center"
      className={cn(
        "flex min-h-screen items-center justify-center bg-muted/40 p-4 [&>[data-slot=card]]:w-full [&>[data-slot=card]]:max-w-sm",
        className
      )}
      {...props}
    />
  )
}

type PageTitleProps = React.ComponentProps<"h1">

function PageTitle({ className, ...props }: PageTitleProps) {
  return (
    <h1
      data-slot="page-title"
      className={cn("text-xl font-bold tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  badge?: React.ReactNode
  children?: React.ReactNode
}
function PageHeader({ title, description, badge, children }: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}

export {
  Page,
  PageGrid,
  PageGridItem,
  PageText,
  PageForm,
  PageLabel,
  PageField,
  PageCenter,
  PageTitle,
  PageHeader,
}
