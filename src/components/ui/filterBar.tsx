import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

function FilterBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="search"
      aria-label="Barra de filtros de búsqueda"
      data-slot="filter-bar"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs",
        className
      )}
      {...props}
    />
  )
}

function FilterItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-item"
      className={cn("flex items-center gap-2 flex-1 min-w-[200px]", className)}
      {...props}
    />
  )
}

interface FilterSearchProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
}

function FilterSearch({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
  className,
  ...props
}: FilterSearchProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pl-8 pr-8 text-xs h-8", className)}
        {...props}
      />
      {value && onClear && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  )
}

export { FilterBar, FilterItem, FilterSearch }
