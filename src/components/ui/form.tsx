import * as React from "react"
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"
import { Slot } from "radix-ui"
import { cn } from "cn"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<"label">) {
  const { name } = React.useContext(FormFieldContext)
  const { id } = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  const fieldState = getFieldState(name, formState)

  return (
    <label
      data-slot="form-label"
      data-error={!!fieldState.error}
      htmlFor={id}
      className={cn(
        "text-xs font-medium text-foreground select-none data-[error=true]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { name } = React.useContext(FormFieldContext)
  const { id } = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  const fieldState = getFieldState(name, formState)

  return (
    <Slot.Root
      data-slot="form-control"
      id={id}
      aria-invalid={!!fieldState.error}
      aria-describedby={fieldState.error ? `${id}-form-item-message` : undefined}
      {...props}
    />
  )
}

function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { name } = React.useContext(FormFieldContext)
  const { id } = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  const fieldState = getFieldState(name, formState)
  const body = fieldState.error ? String(fieldState.error?.message ?? "") : children

  if (!body) return null

  return (
    <p
      data-slot="form-message"
      id={`${id}-form-item-message`}
      className={cn("text-[11px] font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export { Form, FormItem, FormLabel, FormControl, FormMessage, FormField }
