/** Keeps digits, one leading minus and the first decimal point: "$1,234.5.6" → "1234.56". */
export function cleanNumber(text: string) {
  const sign = text.trim().startsWith("-") ? "-" : ""
  const [whole, ...decimals] = text.replace(/[^\d.]/g, "").split(".")
  return sign + whole + (decimals.length ? "." + decimals.join("") : "")
}

// ponytail: both site locales (en-US, es-MX) group with "," and use "." for decimals; derive from Intl if a locale ever differs.
/** Adds thousands separators to the whole part only: "1234567.5" → "1,234,567.5". */
export function groupNumber(raw: string) {
  const [whole, decimals] = raw.split(".")
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimals === undefined ? "" : "." + decimals)
}
