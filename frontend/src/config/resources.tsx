import { Avatar } from "@/components/ui/primitives";
import type { Field, ResourceConfig } from "@/components/resource/types";
import type { Row } from "@/hooks/use-resource";
import { FILES_URL } from "@/lib/api";
import { isoDate, money } from "@/lib/format";

/**
 * One entry per module. Column and field names are the database column names from the
 * documentation sheet; change labels, options and order here without touching any page.
 */

// ---------------------------------------------------------------- option lists
export const PERMISSIONS = [
  "all", "view_all", "view_projects", "view_own_projects", "view_tasks", "view_own_tasks", "view_assigned_tasks", "assign_tasks",
  "edit_profile", "view_team", "edit_team", "view_payroll", "edit_payroll", "approve_timesheets", "view_policies", "edit_policies",
] as const;
export const MODULE_ACTIONS = ["view", "add", "edit", "delete", "assign", "complete", "export", "process", "submit", "approve", "generate", "update", "send", "upload"] as const;
export const PROJECT_TYPES = ["Internal", "Client"] as const;
export const CATEGORIES: Record<string, readonly string[]> = {
  Development: ["Frontend", "Backend", "Full Stack", "Mobile", "AI/ML"],
  Marketing: ["SEO", "Social Media", "Content", "Paid Ads"],
  Design: ["Branding", "UI/UX", "Print"],
  IT: ["Data", "Networking", "Support"],
  Operations: ["Logistics", "Procurement", "Administration"],
};
export const DEPARTMENTS = ["Marketing", "IT", "HR", "Sales", "Design", "Backend", "Database", "Content", "DevOps", "Finance", "Operations"] as const;
export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "On Hold"] as const;
export const MEMBER_TYPES = ["Internee", "Full-time", "Part-time", "Contractor"] as const;
export const SCHEDULES = ["Full Time Day", "Full Time Night", "Part Time", "Flexible", "Remote"] as const;
export const BUSINESS_STRUCTURES = ["LLC", "Sole Proprietorship", "Corporation", "Partnership"] as const;
export const VENDOR_TYPES = ["Credit Card", "Service Provider", "Service", "Supplier", "Utility", "Other"] as const;
export const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"] as const;
export const SUB_TYPES: Record<string, readonly string[]> = {
  Asset: ["Cash/Bank", "Current Assets", "Fixed Assets", "Other Assets"],
  Liability: ["Current Liabilities", "Long Term Liabilities"],
  Equity: ["Capital", "Retained Earning"],
  Income: ["Service Revenue", "Sales Revenue", "Other Income"],
  Expense: ["Office Expense", "Professional Fees", "Advertising", "Rent / Lease", "Salary", "Utilities", "Other Expense"],
};

// ---------------------------------------------------------------- shared relations
const userRel = { resource: "users", label: (u: Row) => `${u.name} (${u.role_name})` };
const memberRel = { resource: "team-members", label: (m: Row) => [m.first_name, m.middle_name, m.surname].filter(Boolean).join(" ") };
const ledgerRel = { resource: "ledger-accounts", label: (a: Row) => `${a.account_code} - ${a.name}` };
const n = (v: unknown) => Number(v) || 0;

// ---------------------------------------------------------------- user management
export const users: ResourceConfig = {
  key: "users",
  title: "Users",
  singular: "User",
  description: "People who can sign in, and the role each one has.",
  rowLabel: (r) => r.name,
  columns: [
    { key: "id", header: "ID", type: "number" },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} />
          <span className="font-semibold">{r.name}</span>
        </div>
      ),
    },
    { key: "email", header: "Email" },
    { key: "role_name", header: "Role", type: "chips" },
    { key: "created_at", header: "Created", type: "date" },
  ],
  fields: [
    { name: "name", label: "Full name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "password", label: "Password", type: "password", required: true, help: "At least 8 characters. When editing, leave blank to keep the current password." },
    { name: "role_id", label: "Role", type: "relation", required: true, relation: { resource: "roles", label: (r) => r.role_name }, display: "role_name" },
  ],
};

export const roles: ResourceConfig = {
  key: "roles",
  title: "Roles",
  singular: "Role",
  description: "Roles group permissions. A role cannot be deleted while users still have it.",
  rowLabel: (r) => r.role_name,
  columns: [
    { key: "id", header: "ID", type: "number" },
    { key: "role_name", header: "Role name", render: (r) => <span className="font-semibold">{r.role_name}</span> },
    { key: "permissions", header: "Permissions", type: "chips" },
    { key: "user_count", header: "Users", type: "number" },
    { key: "created_at", header: "Created", type: "date" },
  ],
  fields: [
    { name: "role_name", label: "Role name", type: "text", required: true, placeholder: "e.g. finance" },
    { name: "permissions", label: "Permissions", type: "multicheck", required: true, options: PERMISSIONS, help: '"all" gives full access to every module.' },
  ],
};

export const modules: ResourceConfig = {
  key: "modules",
  title: "Modules",
  singular: "Module",
  description: "Software modules and the actions available in each. Visible to super admins only.",
  rowLabel: (r) => r.module_name,
  columns: [
    { key: "id", header: "ID", type: "number" },
    { key: "module_name", header: "Module", render: (r) => <span className="font-semibold">{r.module_name}</span> },
    { key: "actions", header: "Actions", type: "chips" },
    { key: "created_at", header: "Created", type: "date" },
  ],
  fields: [
    { name: "module_name", label: "Module name", type: "text", required: true, placeholder: "e.g. Users Management" },
    { name: "actions", label: "Actions", type: "multicheck", required: true, options: MODULE_ACTIONS },
  ],
};

// ---------------------------------------------------------------- task management
export const projects: ResourceConfig = {
  key: "projects",
  title: "Projects",
  singular: "Project",
  description: "Progress and running cost update automatically from each project's tasks.",
  rowLabel: (r) => r.project_name,
  formSize: "lg",
  defaults: () => ({ type: "Internal", start_date: isoDate() }),
  columns: [
    { key: "project_name", header: "Project", render: (r) => <span className="font-semibold">{r.project_name}</span> },
    { key: "type", header: "Type", type: "chips" },
    { key: "main_category", header: "Category" },
    { key: "sub_category", header: "Sub category", hidden: true },
    { key: "start_date", header: "Start", type: "date" },
    { key: "deadline", header: "Deadline", type: "date" },
    { key: "percent_completed", header: "Progress", type: "progress" },
    { key: "running_cost", header: "Running cost", type: "money" },
    { key: "estimated_cost", header: "Est. cost", type: "money" },
    { key: "estimated_time", header: "Est. time", type: "minutes" },
    { key: "task_count", header: "Tasks", type: "number", hidden: true },
    { key: "created_by_name", header: "Created by", hidden: true },
  ],
  fields: [
    { name: "project_name", label: "Project name", type: "text", required: true, wide: true },
    { name: "type", label: "Type", type: "select", options: PROJECT_TYPES, required: true },
    { name: "created_by", label: "Created by", type: "relation", relation: userRel, display: "created_by_name", only: "edit" },
    { name: "start_date", label: "Start date", type: "date", required: true },
    { name: "deadline", label: "Deadline", type: "date", required: true },
    { name: "main_category", label: "Main category", type: "select", options: Object.keys(CATEGORIES) },
    { name: "sub_category", label: "Sub category", type: "select", dependsOn: { field: "main_category", map: CATEGORIES } },
    { name: "estimated_cost", label: "Estimated cost", type: "money" },
    { name: "estimated_time", label: "Estimated time (minutes)", type: "number" },
  ],
};

export const tasks: ResourceConfig = {
  key: "tasks",
  title: "Tasks",
  singular: "Task",
  description: "Assign work and track it. Actual time is calculated from start and end when a task is completed.",
  rowLabel: (r) => r.task_name,
  formSize: "lg",
  defaults: () => ({ status: "Pending", assigned_date: isoDate() }),
  columns: [
    { key: "task_name", header: "Task", render: (r) => <span className="font-semibold">{r.task_name}</span> },
    { key: "project_name", header: "Project" },
    {
      key: "assigned_to_name",
      header: "Assigned to",
      render: (r) =>
        r.assigned_to_name ? (
          <div className="flex items-center gap-2">
            <Avatar name={r.assigned_to_name} size={24} />
            {r.assigned_to_name}
          </div>
        ) : (
          <span className="text-muted">Unassigned</span>
        ),
    },
    { key: "department", header: "Department" },
    { key: "status", header: "Status", type: "status" },
    { key: "deadline", header: "Deadline", type: "date" },
    { key: "estimated_time", header: "Est. time", type: "minutes" },
    { key: "actual_time", header: "Actual time", type: "minutes" },
    { key: "assigned_date", header: "Assigned", type: "date", hidden: true },
    { key: "assigned_by_name", header: "Assigned by", hidden: true },
    { key: "document_link", header: "Document", type: "link", hidden: true },
    { key: "start_time", header: "Start time", type: "datetime", hidden: true },
    { key: "end_time", header: "End time", type: "datetime", hidden: true },
    { key: "assignor_notes", header: "Assignor notes", hidden: true },
    { key: "assignee_notes", header: "Assignee notes", hidden: true },
  ],
  fields: [
    { name: "task_name", label: "Task name", type: "text", required: true, wide: true, section: "Task" },
    { name: "project_id", label: "Project", type: "relation", required: true, relation: { resource: "projects", label: (p) => p.project_name }, display: "project_name", section: "Task" },
    { name: "department", label: "Department", type: "select", options: DEPARTMENTS, section: "Task" },
    { name: "assigned_to", label: "Assigned to", type: "relation", relation: userRel, display: "assigned_to_name", section: "Task" },
    { name: "assigned_by", label: "Assigned by", type: "relation", relation: userRel, display: "assigned_by_name", only: "edit", section: "Task" },
    { name: "status", label: "Status", type: "select", options: TASK_STATUSES, required: true, section: "Task" },
    { name: "estimated_time", label: "Estimated time (minutes)", type: "number", section: "Schedule" },
    { name: "actual_time", label: "Actual time (minutes)", type: "number", only: "edit", help: "Filled in automatically on completion.", section: "Schedule" },
    { name: "assigned_date", label: "Assigned date", type: "date", section: "Schedule" },
    { name: "deadline", label: "Deadline", type: "date", section: "Schedule" },
    { name: "start_time", label: "Start time", type: "datetime", only: "edit", section: "Schedule" },
    { name: "end_time", label: "End time", type: "datetime", only: "edit", section: "Schedule" },
    { name: "document_link", label: "Document link", type: "url", wide: true, placeholder: "https://", section: "Notes" },
    { name: "assignor_notes", label: "Assignor notes", type: "textarea", section: "Notes" },
    { name: "assignee_notes", label: "Assignee notes", type: "textarea", only: "edit", section: "Notes" },
  ],
};

export const taskHistory: ResourceConfig = {
  key: "task-history",
  title: "Task History",
  singular: "Change",
  description: "Every change made to a task: what changed, from what, to what, and by whom.",
  readOnly: true,
  rowLabel: (r) => `${r.task_name}: ${r.field_name}`,
  columns: [
    { key: "changed_at", header: "Timestamp", type: "datetime" },
    { key: "project_name", header: "Project" },
    { key: "task_name", header: "Task", render: (r) => <span className="font-semibold">{r.task_name}</span> },
    { key: "field_name", header: "Field", type: "chips" },
    { key: "old_value", header: "Old value" },
    { key: "new_value", header: "New value" },
    { key: "changed_by_name", header: "Changed by" },
  ],
  fields: [
    { name: "changed_at", label: "Timestamp", type: "datetime" },
    { name: "project_name", label: "Project", type: "text" },
    { name: "task_name", label: "Task", type: "text" },
    { name: "field_name", label: "Field", type: "text" },
    { name: "old_value", label: "Old value", type: "textarea" },
    { name: "new_value", label: "New value", type: "textarea" },
    { name: "changed_by_name", label: "Changed by", type: "text" },
  ],
};

const memberName = (r: Row) => [r.first_name, r.middle_name, r.surname].filter(Boolean).join(" ");
const DOCS = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

export const teamMembers: ResourceConfig = {
  key: "team-members",
  title: "Team Members",
  singular: "Team member",
  description: "Employee and contractor profiles: contact details, employment, bank and rates.",
  rowLabel: memberName,
  formSize: "xl",
  multipart: true,
  defaults: () => ({ status: "Active", member_type: "Full-time", start_date: isoDate() }),
  columns: [
    {
      key: "first_name",
      header: "Name",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={memberName(r)} src={r.profile_picture ? `${FILES_URL}${r.profile_picture}` : null} />
          <div>
            <p className="font-semibold">{memberName(r)}</p>
            {r.email && <p className="text-xs text-muted">{r.email}</p>}
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", type: "status" },
    { key: "member_type", header: "Member type", type: "chips" },
    { key: "start_date", header: "Start date", type: "date" },
    { key: "cell", header: "Cell" },
    { key: "cnic_ntn", header: "CNIC / NTN" },
    { key: "city", header: "City" },
    { key: "salary", header: "Salary", type: "money" },
    { key: "hourly_rate", header: "Hourly rate", type: "money" },
    { key: "middle_name", header: "Middle name", hidden: true },
    { key: "surname", header: "Surname", hidden: true },
    { key: "company_name", header: "Company", hidden: true },
    { key: "email", header: "Email", hidden: true },
    { key: "address_line1", header: "Address line 1", hidden: true },
    { key: "address_line2", header: "Address line 2", hidden: true },
    { key: "province", header: "Province", hidden: true },
    { key: "schedule", header: "Schedule", hidden: true },
    { key: "user_name", header: "Linked user", hidden: true },
  ],
  fields: [
    { name: "first_name", label: "First name", type: "text", required: true, section: "Personal info" },
    { name: "middle_name", label: "Middle name", type: "text", section: "Personal info" },
    { name: "surname", label: "Surname", type: "text", section: "Personal info" },
    { name: "company_name", label: "Company name", type: "text", section: "Personal info" },
    { name: "cnic_ntn", label: "CNIC / NTN", type: "text", section: "Personal info" },
    { name: "cell", label: "Cell", type: "text", section: "Personal info" },
    { name: "email", label: "Email", type: "email", section: "Personal info" },
    { name: "address_line1", label: "Address line 1", type: "text", section: "Personal info" },
    { name: "address_line2", label: "Address line 2", type: "text", section: "Personal info" },
    { name: "city", label: "City", type: "text", section: "Personal info" },
    { name: "province", label: "Province", type: "text", section: "Personal info" },
    { name: "notes", label: "Notes", type: "textarea", section: "Personal info" },

    { name: "user_id", label: "Link user", type: "relation", relation: userRel, display: "user_name", help: "Lets this person clock in and out.", section: "Employment details" },
    { name: "member_type", label: "Member type", type: "select", options: MEMBER_TYPES, section: "Employment details" },
    { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], section: "Employment details" },
    { name: "start_date", label: "Start date", type: "date", section: "Employment details" },
    { name: "schedule", label: "Schedule", type: "select", options: SCHEDULES, section: "Employment details" },
    { name: "profile_picture", label: "Profile picture", type: "file", accept: ".jpg,.jpeg,.png,.webp", help: "JPG, PNG or WebP.", section: "Employment details" },

    { name: "bank_name", label: "Bank name", type: "text", section: "Bank info" },
    { name: "account_number", label: "Account number", type: "text", section: "Bank info" },
    { name: "iban", label: "IBAN", type: "text", section: "Bank info" },
    { name: "jazz_cash", label: "Jazz Cash", type: "text", section: "Bank info" },
    { name: "easy_paisa", label: "Easy Paisa", type: "text", section: "Bank info" },
    { name: "salary", label: "Salary (monthly)", type: "money", section: "Bank info" },

    { name: "hourly_rate", label: "Hourly rate", type: "money", section: "Rates" },
    { name: "weekly_hours", label: "Weekly hours", type: "number", section: "Rates" },
    { name: "monthly_hours", label: "Monthly hours", type: "number", section: "Rates" },
    { name: "overtime_rate", label: "Overtime rate", type: "money", section: "Rates" },
    { name: "flat_rate", label: "Flat rate", type: "money", section: "Rates" },
    { name: "commissions", label: "Commissions", type: "money", section: "Rates" },
    { name: "over_ride", label: "Over ride", type: "money", section: "Rates" },

    { name: "cnic_upload", label: "CNIC", type: "file", accept: DOCS, help: "PDF, DOC or image, max 5MB.", section: "Documents" },
    { name: "cv_upload", label: "CV", type: "file", accept: DOCS, help: "PDF, DOC or image, max 5MB.", section: "Documents" },
    { name: "contract_upload", label: "Contract", type: "file", accept: DOCS, help: "PDF, DOC or image, max 5MB.", section: "Documents" },
  ],
};

const memberField: Field = { name: "team_member_id", label: "Team member", type: "relation", required: true, relation: memberRel, display: "member_name" };

export const skills: ResourceConfig = {
  key: "skills",
  title: "Skills",
  singular: "Skill",
  description: "What each team member can do, with typical time and cost.",
  rowLabel: (r) => `${r.member_name}: ${r.sub_category || r.main_category}`,
  columns: [
    { key: "member_name", header: "Team member", render: (r) => <span className="font-semibold">{r.member_name}</span> },
    { key: "main_category", header: "Main category", type: "chips" },
    { key: "sub_category", header: "Sub category" },
    { key: "estimated_time_min", header: "Est. time", type: "minutes" },
    { key: "estimated_cost", header: "Est. cost", type: "money" },
    { key: "created_at", header: "Added", type: "date" },
  ],
  fields: [
    memberField,
    { name: "main_category", label: "Skill main category", type: "text", required: true },
    { name: "sub_category", label: "Skill sub category", type: "text" },
    { name: "estimated_time_min", label: "Estimated time (minutes)", type: "number" },
    { name: "estimated_cost", label: "Estimated cost", type: "money" },
  ],
};

export const paySheet: ResourceConfig = {
  key: "master-pay-sheet",
  title: "Master Pay Sheet",
  singular: "Pay sheet entry",
  description: "Monthly payroll. Totals are calculated for you and every entry is posted to the ledger automatically.",
  rowLabel: (r) => `${r.member_name} - ${String(r.month).slice(0, 7)}`,
  formSize: "lg",
  defaults: () => ({ month: isoDate().slice(0, 7) }),
  // TM-04-02 / TM-04-03, mirrored from the server so the totals update while typing.
  formSummary: (v) => {
    const overtime = n(v.overtime_hours) * n(v.overtime_rate);
    const gross = n(v.base_salary) + overtime + n(v.bonus_comm) + n(v.flat_rate);
    const net = gross - (n(v.tax_withheld) + n(v.gratuity) + n(v.insurance) + n(v.other_deductions));
    return [
      { label: "Total overtime", value: money(overtime) },
      { label: "Gross pay-out", value: money(gross) },
      { label: "Net pay-out", value: money(net), strong: true },
    ];
  },
  columns: [
    { key: "member_name", header: "Name", render: (r) => <span className="font-semibold">{r.member_name}</span> },
    { key: "cnic_ntn", header: "CNIC / NTN", hidden: true },
    { key: "month", header: "Month", type: "month" },
    { key: "total_regular_hours", header: "Regular hrs", type: "number" },
    { key: "hourly_rate", header: "Hourly rate", type: "money", hidden: true },
    { key: "base_salary", header: "Base salary", type: "money" },
    { key: "overtime_hours", header: "OT hrs", type: "number", hidden: true },
    { key: "overtime_rate", header: "OT rate", type: "money", hidden: true },
    { key: "total_overtime", header: "Total overtime", type: "money" },
    { key: "bonus_comm", header: "Bonus / comm", type: "money" },
    { key: "flat_rate", header: "Flat rate", type: "money", hidden: true },
    { key: "gross_payout", header: "Gross pay-out", type: "money" },
    { key: "tax_withheld", header: "Tax withheld", type: "money" },
    { key: "gratuity", header: "Gratuity", type: "money", hidden: true },
    { key: "insurance", header: "Insurance", type: "money", hidden: true },
    { key: "other_deductions", header: "Other deductions", type: "money", hidden: true },
    { key: "net_payout", header: "Net pay-out", type: "money" },
    { key: "posted", header: "In ledger", type: "bool" },
  ],
  fields: [
    { ...memberField, section: "Period" },
    { name: "month", label: "Month", type: "month", required: true, section: "Period" },
    { name: "total_regular_hours", label: "Total regular hours", type: "number", section: "Earnings" },
    { name: "hourly_rate", label: "Hourly rate", type: "money", section: "Earnings" },
    { name: "base_salary", label: "Base salary", type: "money", section: "Earnings" },
    { name: "bonus_comm", label: "Bonus / commission", type: "money", section: "Earnings" },
    { name: "overtime_hours", label: "Overtime hours", type: "number", section: "Earnings" },
    { name: "overtime_rate", label: "Overtime rate", type: "money", section: "Earnings" },
    { name: "flat_rate", label: "Flat rate", type: "money", section: "Earnings" },
    { name: "tax_withheld", label: "Tax withheld", type: "money", section: "Deductions" },
    { name: "gratuity", label: "Gratuity", type: "money", section: "Deductions" },
    { name: "insurance", label: "Insurance", type: "money", section: "Deductions" },
    { name: "other_deductions", label: "Other deductions", type: "money", section: "Deductions" },
  ],
};

export const timeSheet: ResourceConfig = {
  key: "master-time-sheet",
  title: "Master Time Sheet",
  singular: "Time sheet entry",
  description: "Daily login and logout. Total hours and pay value are calculated from the member's hourly rate.",
  rowLabel: (r) => `${r.member_name} - ${String(r.date).slice(0, 10)}`,
  defaults: () => ({ date: isoDate() }),
  columns: [
    { key: "member_name", header: "Name", render: (r) => <span className="font-semibold">{r.member_name}</span> },
    { key: "date", header: "Date", type: "date" },
    { key: "login", header: "Login", type: "time" },
    {
      key: "logout",
      header: "Logout",
      render: (r) => (r.logout ? <span className="num">{String(r.logout).slice(0, 5)}</span> : <span className="text-xs font-semibold text-info">Clocked in</span>),
    },
    { key: "total_hours", header: "Total hours", type: "number" },
    { key: "pay_value", header: "Pay value", type: "money" },
  ],
  fields: [
    memberField,
    { name: "date", label: "Date", type: "date", required: true },
    { name: "login", label: "Login", type: "time", required: true },
    { name: "logout", label: "Logout", type: "time" },
  ],
};

// ---------------------------------------------------------------- accounting
export const businesses: ResourceConfig = {
  key: "businesses",
  title: "Businesses",
  singular: "Business",
  description: "The business entities you keep books for.",
  rowLabel: (r) => r.business_name,
  formSize: "lg",
  columns: [
    { key: "business_name", header: "Business", render: (r) => <span className="font-semibold">{r.business_name}</span> },
    { key: "first_name", header: "Name", render: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "-" },
    { key: "industry", header: "Industry" },
    { key: "business_structure", header: "Structure", type: "chips" },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    { key: "bank_name", header: "Bank" },
    { key: "current_balance", header: "Balance", type: "money" },
    { key: "ssn_ein_ntn_cnic", header: "SSN / EIN / NTN / CNIC", hidden: true },
    { key: "ext", header: "Ext", hidden: true },
    { key: "web_address", header: "Web address", type: "link", hidden: true },
    { key: "num_employees", header: "Employees", type: "number", hidden: true },
    { key: "num_contractors", header: "Contractors", type: "number", hidden: true },
    { key: "budget_month_start", header: "Fiscal year start", type: "date", hidden: true },
    { key: "budget_month_end", header: "Fiscal year end", type: "date", hidden: true },
    { key: "account_no", header: "Account no", hidden: true },
  ],
  fields: [
    { name: "user_id", label: "Select user (owner)", type: "relation", relation: userRel, display: "user_name", section: "Owner" },
    { name: "first_name", label: "First name", type: "text", section: "Owner" },
    { name: "last_name", label: "Last name", type: "text", section: "Owner" },
    { name: "business_name", label: "Business name", type: "text", required: true, section: "Business" },
    { name: "industry", label: "Industry", type: "text", section: "Business" },
    { name: "business_structure", label: "Business structure", type: "select", options: BUSINESS_STRUCTURES, section: "Business" },
    { name: "ssn_ein_ntn_cnic", label: "SSN / EIN / NTN / CNIC", type: "text", section: "Business" },
    { name: "phone", label: "Phone", type: "text", section: "Business" },
    { name: "ext", label: "Ext", type: "text", section: "Business" },
    { name: "web_address", label: "Web address", type: "url", placeholder: "https://", section: "Business" },
    { name: "email", label: "Email", type: "email", section: "Business" },
    { name: "num_employees", label: "No. of employees", type: "number", section: "Business" },
    { name: "num_contractors", label: "No. of contractors", type: "number", section: "Business" },
    { name: "budget_month_start", label: "Budget month (start)", type: "date", section: "Fiscal year and bank" },
    { name: "budget_month_end", label: "Budget month (end)", type: "date", help: "Leave blank to use one year from the start.", section: "Fiscal year and bank" },
    { name: "bank_name", label: "Bank name", type: "text", section: "Fiscal year and bank" },
    { name: "account_no", label: "Account no", type: "text", section: "Fiscal year and bank" },
    { name: "current_balance", label: "Current balance", type: "money", section: "Fiscal year and bank" },
  ],
};

const creditSummary = (v: Row) => [
  { label: "Credit limit", value: money(v.credit_limit) },
  { label: "Amount owed", value: money(v.amount_owed) },
  { label: "Credit remaining", value: money(n(v.credit_limit) - n(v.amount_owed)), strong: true },
];

export const customers: ResourceConfig = {
  key: "customers",
  title: "Customers",
  singular: "Customer",
  description: "Who pays you. Amount owed goes up when a Money In transaction leaves part to come later.",
  rowLabel: (r) => r.business_name || r.contact_name,
  formSize: "lg",
  formSummary: creditSummary,
  columns: [
    {
      key: "contact_name",
      header: "Customer",
      render: (r) => (
        <div>
          <p className="font-semibold">{r.contact_name}</p>
          {r.business_name && <p className="text-xs text-muted">{r.business_name}</p>}
        </div>
      ),
    },
    { key: "business_name", header: "Business name", hidden: true },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    { key: "what_is_this_for", header: "What is this for" },
    { key: "due_date", header: "Due date", type: "date" },
    { key: "credit_limit", header: "Credit limit", type: "money" },
    { key: "amount_owed", header: "Amount owed", type: "money" },
    { key: "balance_of_credit_given", header: "Credit balance", type: "money" },
    { key: "auto_billing", header: "Auto billing", type: "bool" },
    { key: "turn_on_reminder", header: "Reminder", type: "bool" },
    { key: "tax_id", header: "Tax ID", hidden: true },
    { key: "web_address", header: "Web address", type: "link", hidden: true },
    { key: "login_url", header: "Log in URL", type: "link", hidden: true },
    { key: "user_name", header: "User", hidden: true },
    { key: "owner_business_name", header: "Business", hidden: true },
    { key: "ledger_account_name", header: "Ledger account", hidden: true },
  ],
  fields: [
    { name: "contact_name", label: "Contact name", type: "text", required: true, section: "Contact" },
    { name: "business_name", label: "Business name", type: "text", section: "Contact" },
    { name: "tax_id", label: "Tax ID", type: "text", section: "Contact" },
    { name: "phone", label: "Phone", type: "text", section: "Contact" },
    { name: "email", label: "Email", type: "email", section: "Contact" },
    { name: "web_address", label: "Web address", type: "url", placeholder: "https://", section: "Contact" },
    { name: "login_url", label: "Log in URL", type: "url", placeholder: "https://", section: "Contact" },
    { name: "what_is_this_for", label: "What is this for?", type: "text", section: "Contact" },
    { name: "user_id", label: "User (owner)", type: "relation", relation: userRel, display: "user_name", section: "Billing" },
    { name: "business_id", label: "Business", type: "relation", relation: { resource: "businesses", label: (b) => b.business_name }, display: "owner_business_name", section: "Billing" },
    { name: "due_date", label: "Due date", type: "date", section: "Billing" },
    { name: "linked_ledger_account_id", label: "Link ledger account", type: "relation", relation: ledgerRel, display: "ledger_account_name", section: "Billing" },
    { name: "credit_limit", label: "Credit limit", type: "money", section: "Billing" },
    { name: "amount_owed", label: "Amount owed to us", type: "money", section: "Billing" },
    { name: "auto_billing", label: "Auto billing", type: "boolean", section: "Billing" },
    { name: "turn_on_reminder", label: "Turn on reminder", type: "boolean", section: "Billing" },
  ],
};

export const vendors: ResourceConfig = {
  key: "vendors",
  title: "Vendors",
  singular: "Vendor",
  description: "Who you pay. Amount owed goes up when a Money Out transaction leaves part to go later.",
  rowLabel: (r) => r.business_name || r.contact_name,
  formSize: "lg",
  formSummary: creditSummary,
  columns: [
    {
      key: "contact_name",
      header: "Vendor",
      render: (r) => (
        <div>
          <p className="font-semibold">{r.contact_name}</p>
          {r.business_name && <p className="text-xs text-muted">{r.business_name}</p>}
        </div>
      ),
    },
    { key: "business_name", header: "Business name", hidden: true },
    { key: "type", header: "Type", type: "chips" },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    { key: "what_is_this_for", header: "What is this" },
    { key: "due_date", header: "Due date", type: "date" },
    { key: "credit_limit", header: "Credit limit", type: "money" },
    { key: "amount_owed", header: "Amount owed", type: "money" },
    { key: "balance_left_on_credit", header: "Balance left", type: "money" },
    { key: "is_1099", header: "1099", type: "bool" },
    { key: "auto_billing", header: "Autopay", type: "bool" },
    { key: "turn_on_reminder", header: "Reminder", type: "bool", hidden: true },
    { key: "tax_id", header: "Tax ID", hidden: true },
    { key: "web_address", header: "Web address", type: "link", hidden: true },
    { key: "login_url", header: "Log in URL", type: "link", hidden: true },
    { key: "ledger_account_name", header: "Ledger account", hidden: true },
  ],
  fields: [
    { name: "type", label: "Type", type: "select", options: VENDOR_TYPES, section: "Contact" },
    { name: "contact_name", label: "Contact name", type: "text", required: true, section: "Contact" },
    { name: "business_name", label: "Business name", type: "text", section: "Contact" },
    { name: "tax_id", label: "Tax ID", type: "text", section: "Contact" },
    { name: "phone", label: "Phone", type: "text", section: "Contact" },
    { name: "email", label: "Email", type: "email", section: "Contact" },
    { name: "web_address", label: "Web address", type: "url", placeholder: "https://", section: "Contact" },
    { name: "login_url", label: "Log in URL", type: "url", placeholder: "https://", section: "Contact" },
    { name: "what_is_this_for", label: "What is this for?", type: "text", section: "Contact" },
    { name: "user_id", label: "User (owner)", type: "relation", relation: userRel, display: "user_name", section: "Billing" },
    { name: "due_date", label: "Due date", type: "date", section: "Billing" },
    { name: "linked_ledger_account_id", label: "Link ledger account", type: "relation", relation: ledgerRel, display: "ledger_account_name", section: "Billing" },
    { name: "credit_limit", label: "Credit limit", type: "money", section: "Billing" },
    { name: "amount_owed", label: "Amount owed", type: "money", section: "Billing" },
    { name: "is_1099", label: "1099", type: "boolean", section: "Billing" },
    { name: "auto_billing", label: "Auto billing", type: "boolean", section: "Billing" },
    { name: "turn_on_reminder", label: "Turn on reminder", type: "boolean", section: "Billing" },
  ],
};

export const ledgerAccounts: ResourceConfig = {
  key: "ledger-accounts",
  title: "Ledger Accounts",
  singular: "Ledger account",
  description: "Your chart of accounts. Balances come from journal entries plus start balances, and Opening Balance Equity keeps them balanced automatically.",
  rowLabel: (r) => `${r.account_code} - ${r.name}`,
  defaults: () => ({ account_type: "Asset", start_date: isoDate(), start_balance: 0 }),
  columns: [],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "account_code", label: "Account code", type: "text", required: true, placeholder: "e.g. 1010", help: "Must be unique." },
    { name: "account_type", label: "Account type", type: "select", options: ACCOUNT_TYPES, required: true },
    { name: "sub_type", label: "Sub type", type: "select", dependsOn: { field: "account_type", map: SUB_TYPES } },
    { name: "category", label: "Category", type: "text", placeholder: "e.g. Office Expense, Salary" },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "start_balance", label: "Start balance", type: "money" },
  ],
};

export const journalEntries: ResourceConfig = {
  key: "journal-entries",
  title: "Journal Entries",
  singular: "Journal entry",
  description: "The debit and credit lines created automatically by every transaction.",
  readOnly: true,
  rowLabel: (r) => `Entry #${r.id}`,
  columns: [
    { key: "date", header: "Date", type: "date" },
    { key: "transaction_id", header: "Txn #", type: "number" },
    { key: "account_code", header: "Code" },
    { key: "account_name", header: "Account", render: (r) => <span className="font-semibold">{r.account_name}</span> },
    { key: "description", header: "Description" },
    { key: "party_name", header: "Party" },
    { key: "debit_amount", header: "Debit", type: "money", render: (r) => (Number(r.debit_amount) ? <span className="num font-semibold">{money(r.debit_amount)}</span> : <span className="text-muted/50">-</span>) },
    { key: "credit_amount", header: "Credit", type: "money", render: (r) => (Number(r.credit_amount) ? <span className="num font-semibold">{money(r.credit_amount)}</span> : <span className="text-muted/50">-</span>) },
  ],
  fields: [
    { name: "date", label: "Date", type: "date" },
    { name: "transaction_id", label: "Transaction #", type: "number" },
    { name: "account_name", label: "Account", type: "text" },
    { name: "account_type", label: "Account type", type: "select" },
    { name: "debit_amount", label: "Debit", type: "money" },
    { name: "credit_amount", label: "Credit", type: "money" },
    { name: "party_name", label: "Party", type: "text" },
    { name: "for_what", label: "For what", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};
