import * as React from "react"
import { Input } from "@portfolio/ui/components/input"
import { cleanNumber, groupNumber } from "@portfolio/ui/lib/number"

/**
 * Props for any <input> that edits a number as text with thousands separators.
 * The value stays a plain numeric string ("20000.5"); only the display is grouped, and the caret keeps its place among the digits.
 */
export function useNumberInput(value: string | number, onValueChange: (raw: string) => void) {
  const ref = React.useRef<HTMLInputElement>(null)
  const caret = React.useRef<number | null>(null)
  React.useLayoutEffect(() => {
    const input = ref.current
    if (caret.current === null || !input || document.activeElement !== input) return
    let left = caret.current, index = 0
    while (index < input.value.length && left > 0) { if (input.value[index] !== ",") left--; index++ }
    input.setSelectionRange(index, index)
    caret.current = null
  })
  return {
    ref,
    type: "text",
    inputMode: "decimal" as const,
    autoComplete: "off",
    value: groupNumber(String(value)),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value
      caret.current = cleanNumber(typed.slice(0, event.target.selectionStart ?? typed.length)).length
      onValueChange(cleanNumber(typed))
    },
  }
}

/** shadcn Input for numbers, shown with thousands separators. */
export function NumberInput({ value, onValueChange, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & { value: string | number; onValueChange: (raw: string) => void }) {
  return <Input {...props} {...useNumberInput(value, onValueChange)} />
}
