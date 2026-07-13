import { createContext } from "react"

/**
 * Signals to descendant form fields that they should be treated as
 * read-only/disabled (e.g. a cancelled shipment plan). Native form
 * controls are disabled via a wrapping <fieldset>, which does not
 * cascade to custom components (like SearchableSelect), so those
 * components consume this context directly as a fallback.
 */
export const FormReadOnlyContext = createContext(false)
