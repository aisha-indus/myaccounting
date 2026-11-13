import { Check, ExternalLink, Minus } from "lucide-react";
import type { Row } from "@/hooks/use-resource";
import { date, dateTime, minutes, money, month, number } from "@/lib/format";
import { Badge, Progress, StatusBadge } from "../ui/primitives";
import type { Col, ColType, Field } from "./types";

const dash = <span className="text-muted/60">-</span>;
const empty = (v: unknown) => v === null || v === undefined || v === "";

export function formatCell(type: ColType | undefined, value: unknown): React.ReactNode {
  if (type !== "bool" && type !== "progress" && empty(value)) return dash;
  switch (type) {
    case "money":
      return <span className="num font-semibold">{money(value)}</span>;
    case "number":
      return <span className="num">{number(value)}</span>;
    case "percent":
      return <span className="num">{Number(value) || 0}%</span>;
    case "progress":
      return (
        <div className="flex min-w-28 items-center gap-2.5">
          <Progress value={Number(value) || 0} />
          <span className="num w-9 text-right text-xs font-semibold text-muted">{Number(value) || 0}%</span>
        </div>
      );
    case "date":
      return <span className="num">{date(value)}</span>;
    case "datetime":
      return <span className="num">{dateTime(value)}</span>;
    case "month":
      return month(value);
    case "time":
      return <span className="num">{String(value).slice(0, 5)}</span>;
    case "minutes":
      return <span className="num">{minutes(value)}</span>;
    case "bool":
      return Number(value) ? (
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/12 text-success">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <Minus className="size-4 text-muted/50" />
      );
    case "status":
      return <StatusBadge value={value} />;
    case "chips":
      return (
        <div className="flex max-w-md flex-wrap gap-1">
          {String(value)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (
              <Badge key={s} tone={s === "all" ? "brand" : "neutral"}>
                {s}
              </Badge>
            ))}
        </div>
      );
    case "link": {
      const href = String(value);
      return (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-52 items-center gap-1 font-medium text-brand-text hover:underline" title={href}>
          <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, "")}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      );
    }
    default:
      return (
        <span className="block max-w-72 truncate" title={String(value)}>
          {String(value)}
        </span>
      );
  }
}

export const renderCol = (col: Col, row: Row) => (col.render ? col.render(row) : formatCell(col.type, row[col.key]));

const FIELD_TO_COL: Partial<Record<Field["type"], ColType>> = {
  money: "money",
  number: "number",
  date: "date",
  month: "month",
  datetime: "datetime",
  time: "time",
  boolean: "bool",
  url: "link",
  multicheck: "chips",
};

/** Read-only value of a form field, used by the detail view. */
export function fieldValue(field: Field, row: Row): React.ReactNode {
  if (field.type === "password") return "********";
  if (field.type === "relation") return formatCell("text", row[field.display || field.name]);
  if (field.type === "select" && /status|type/.test(field.name)) return formatCell("status", row[field.name]);
  return formatCell(FIELD_TO_COL[field.type], row[field.name]);
}
