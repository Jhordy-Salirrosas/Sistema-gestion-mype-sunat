import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  Alert,
  Badge,
  Button,
  FilterBar,
  FilterSearch,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui"

afterEach(cleanup)

describe("Alert", () => {
  it.each([
    ["default", "bg-card"],
    ["info", "bg-blue-50"],
    ["success", "bg-emerald-50"],
    ["warning", "bg-amber-50"],
    ["destructive", "bg-destructive/10"],
  ] as const)(
    "renders the %s variant with alert semantics",
    (variant, variantClass) => {
      render(<Alert variant={variant}>Estado fiscal</Alert>)
      const alert = screen.getByRole("alert")
      expect(alert).toHaveTextContent("Estado fiscal")
      expect(alert).toHaveClass(variantClass)
    },
  )
})

describe("Pagination", () => {
  it("exposes named navigation and accessible previous/next buttons", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem><PaginationPrevious /></PaginationItem>
          <PaginationItem><PaginationLink isActive>2</PaginationLink></PaginationItem>
          <PaginationItem><PaginationNext /></PaginationItem>
        </PaginationContent>
      </Pagination>,
    )

    const navigation = screen.getByRole("navigation", { name: "paginación" })
    expect(within(navigation).getByRole("button", { name: "Ir a página anterior" })).toBeInTheDocument()
    expect(within(navigation).getByRole("button", { name: "Ir a página siguiente" })).toBeInTheDocument()
    expect(within(navigation).getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
  })
})

describe("FilterBar", () => {
  it("has search semantics and calls onClear for a non-empty query", () => {
    const onClear = vi.fn()
    render(
      <FilterBar>
        <FilterSearch value="F001" onChange={vi.fn()} onClear={onClear} aria-label="Buscar comprobantes" />
      </FilterBar>,
    )

    expect(screen.getByRole("search", { name: "Barra de filtros de búsqueda" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Buscar comprobantes" })).toHaveValue("F001")
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})

describe("Button and Badge", () => {
  it("provides normal, hover, focus, disabled and error button states", () => {
    render(<Button disabled aria-invalid="true">Guardar</Button>)
    const button = screen.getByRole("button", { name: "Guardar" })

    expect(button).toBeDisabled()
    expect(button).toHaveClass(
      "bg-primary",
      "hover:bg-primary/80",
      "focus-visible:ring-3",
      "disabled:pointer-events-none",
      "aria-invalid:ring-3",
    )
  })

  it.each([
    ["default", "bg-primary"],
    ["secondary", "bg-secondary"],
    ["destructive", "bg-destructive/10"],
    ["outline", "border-border"],
    ["ghost", "hover:bg-muted"],
    ["link", "underline-offset-4"],
  ] as const)(
    "renders the %s button variant and state styles",
    (variant, variantClass) => {
      render(<Button variant={variant} disabled aria-invalid="true">Guardar</Button>)
      const button = screen.getByRole("button", { name: "Guardar" })

      expect(button).toHaveAttribute("data-variant", variant)
      expect(button).toBeDisabled()
      expect(button).toHaveClass(
        variantClass,
        "disabled:pointer-events-none",
        "focus-visible:ring-3",
        "aria-invalid:border-destructive",
      )
    },
  )

  it.each([
    ["default", "bg-primary"],
    ["secondary", "bg-secondary"],
    ["destructive", "bg-destructive/10"],
    ["outline", "border-border"],
    ["ghost", "hover:bg-muted"],
    ["link", "underline-offset-4"],
  ] as const)(
    "renders the %s badge variant",
    (variant, variantClass) => {
      render(<Badge variant={variant}>Aceptado</Badge>)
      const badge = screen.getByText("Aceptado")
      expect(badge).toHaveAttribute("data-variant", variant)
      expect(badge).toHaveClass(variantClass)
    },
  )
})
