/**
 * Template settings. Change these to rebrand the whole app.
 * Colours live in src/app/globals.css (see the ":root" and "[data-accent]" blocks).
 */
export const site = {
  name: "IBMS",
  fullName: "Integrated Business Management System",
  tagline: "Projects, people and accounts in one place.",
  /** Default currency / number format. Users can switch currency from the Appearance menu. */
  currency: "PKR",
  locale: "en-US",
  currencies: ["PKR", "USD", "EUR", "GBP", "AED", "SAR"],
  /** Accent colours offered in the Appearance menu. Each needs a matching [data-accent] block in globals.css. */
  accents: [
    { id: "teal", label: "Teal", swatch: "#0f766e" },
    { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
    { id: "blue", label: "Blue", swatch: "#2563eb" },
    { id: "violet", label: "Violet", swatch: "#7c3aed" },
    { id: "rose", label: "Rose", swatch: "#e11d48" },
    { id: "amber", label: "Amber", swatch: "#b45309" },
  ],
} as const;
