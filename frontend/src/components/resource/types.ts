import type { Row } from "@/hooks/use-resource";

export type FieldType =
  | "text"
  | "email"
  | "url"
  | "password"
  | "number"
  | "money"
  | "date"
  | "month"
  | "datetime"
  | "time"
  | "textarea"
  | "select"
  | "relation"
  | "boolean"
  | "multicheck"
  | "file";

export interface Field {
  /** Column name, exactly as in the database. */
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Choices for "select" and "multicheck". */
  options?: readonly string[];
  /** Makes a select depend on another field: options[valueOfOtherField]. */
  dependsOn?: { field: string; map: Record<string, readonly string[]> };
  /** For "relation": which resource to load and how to label each row. */
  relation?: { resource: string; label: (row: Row) => string; filter?: (row: Row) => boolean };
  /** Joined column that holds the readable value of a relation (used in the detail view). */
  display?: string;
  section?: string;
  /** Take the full row width in the form grid. */
  wide?: boolean;
  help?: string;
  placeholder?: string;
  /** Only shown when creating / editing. */
  only?: "create" | "edit";
  /** For "file": accepted extensions. */
  accept?: string;
  min?: number;
  /** Error shown when the value is below `min`. */
  minMessage?: string;
  /**
   * For "select": when creating, several options can be picked at once and one record is saved per
   * option (e.g. one skill per sub category). When editing, it is a normal single select.
   */
  splitOnCreate?: boolean;
  /** Shown in the form but not sent to the server (e.g. a total used to work out another field). */
  virtual?: boolean;
  /** Value worked out from the other fields while typing; the input is read-only. */
  computed?: (values: Row) => unknown;
  /** Starting value when editing, for a field that is not a database column. */
  initial?: (row: Row) => unknown;
}

export type ColType = "text" | "money" | "number" | "date" | "datetime" | "month" | "time" | "minutes" | "percent" | "bool" | "status" | "chips" | "link" | "progress";

export interface Col {
  key: string;
  header: string;
  type?: ColType;
  /** Custom cell. The raw value is still used for sorting, search and export. */
  render?: (row: Row) => React.ReactNode;
  /** Hidden until switched on from the Columns menu. */
  hidden?: boolean;
}

export interface ResourceConfig {
  /** API path, e.g. "team-members" -> /api/team-members */
  key: string;
  title: string;
  singular: string;
  description: string;
  columns: Col[];
  fields: Field[];
  readOnly?: boolean;
  /** Text shown for a row in the delete confirmation and dialog titles. */
  rowLabel: (row: Row) => string;
  formSize?: "md" | "lg" | "xl";
  /** Send as multipart/form-data (needed for file fields). */
  multipart?: boolean;
  /** Initial values for a new record. */
  defaults?: () => Row;
  /** Live summary shown at the bottom of the form (e.g. computed payroll totals). */
  formSummary?: (values: Row) => { label: string; value: string; strong?: boolean }[];
}
