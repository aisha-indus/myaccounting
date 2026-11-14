# IBMS - Accounting & Business Management System

Two separate projects:

| Folder | What it is | Stack |
| --- | --- | --- |
| `backend/` | REST API on port 5000 | Node.js, Express, TypeScript, MySQL (mysql2), JWT, bcrypt, Multer, Nodemailer, Winston |
| `frontend/` | Web app on port 3000 | Next.js 16, React 19, TypeScript, Tailwind CSS v4, TanStack Table + Query, React Hook Form, Zod, Axios |

## What you need

- Node.js 20 or newer (`node -v`)
- MySQL 8 running. The easiest way on Windows is XAMPP: open the XAMPP Control Panel and press **Start** next to MySQL. XAMPP's default user is `root` with an empty password.

## Run it (Windows, quickest)

1. Start MySQL.
2. Open `backend\.env` and check `DB_USER` and `DB_PASSWORD` match your MySQL. (For XAMPP the defaults already match.)
3. Double-click **`setup.bat`** (one time only). It installs packages, creates the `ibms` database with all 16 tables, and loads the sample data from the documentation sheet.
4. Double-click **`start.bat`**. It starts both servers and opens http://localhost:3000.
5. Sign in with `bob@example.com` (super-admin). The password is the `SEED_PASSWORD` value in `backend\.env`.

## Run it by hand

```bash
cd backend
npm install
npm run db:setup      # creates database + tables, then loads sample data
npm run dev           # API on http://localhost:5000/api
```

```bash
cd frontend
npm install
npm run dev           # app on http://localhost:3000
```

If `backend/.env` or `frontend/.env.local` is missing, copy it from the `.env.example` next to it.
`SEED_PASSWORD` must be set (8+ characters) before `npm run db:seed`.

## Sample users

Every sample user has the same password (`SEED_PASSWORD`). A few to try:

| Email | Role | Sees |
| --- | --- | --- |
| bob@example.com | super-admin | everything |
| alice@example.com | agent | projects and tasks |
| carol@example.com | client | read-only projects and tasks |

Create users with other roles (finance, hr, manager) from **User Management > Users**.

## Common problems

| Message | Fix |
| --- | --- |
| `Cannot connect to MySQL` / `ECONNREFUSED` | MySQL is not running, or `DB_PORT` is wrong (default 3306). |
| `Access denied for user` | `DB_USER` / `DB_PASSWORD` in `backend\.env` do not match your MySQL. |
| `The database already has data` | The seed only runs on an empty database. To start over: drop the `ibms` database, then `npm run db:setup`. |
| Login page says it cannot reach the server | The backend is not running, or `NEXT_PUBLIC_API_URL` in `frontend\.env.local` is wrong. |
| Port 3000 or 5000 already in use | Close the other program, or change `PORT` in `backend\.env` (and the API URL in `frontend\.env.local`). |

## Customising the template

| To change | Edit |
| --- | --- |
| App name, tagline, default currency, accent choices | `frontend/src/config/site.ts` |
| Colours, dark theme, shadows | `frontend/src/app/globals.css` (the `:root`, `[data-theme="dark"]` and `[data-accent]` blocks) |
| Logo | `frontend/src/components/layout/logo.tsx` |
| Sidebar links and who sees them | `frontend/src/config/nav.ts` |
| Any module's table columns, form fields, dropdown options | `frontend/src/config/resources.tsx` |
| Buttons, inputs, cards, tables, dialogs | `frontend/src/components/ui/` |

Users can also switch light/dark theme, accent colour and currency from the palette icon in the top bar.

## Backend map

| File | Purpose |
| --- | --- |
| `database/schema.sql` | All 16 tables, column names exactly as in the documentation sheet |
| `src/resources.ts` | One definition per table: writable columns, permissions, business rules |
| `src/utils/crud.ts` | Generic list / read / create / update / delete router |
| `src/services/accounting.ts` | Money In / Money Out journal entries, P&L, Balance Sheet, Cash Flow |
| `src/routes/` | Auth, dashboard, transactions, reports, payroll generation, clock in/out |
| `src/middleware/auth.ts` | JWT check and role groups |

### How a transaction is posted

- **Money In**: debit Cash (amount now) + debit Accounts Receivable (amount later), credit the selected account.
- **Money Out**: debit the selected account, credit Cash (amount now) + credit Accounts Payable (amount later).

The cash account is the first ledger account with sub type `Cash/Bank`; receivable and payable are found by category `Receivables` / `Payables`. Keep one of each in the chart of accounts.

## Email

Leave `SMTP_HOST` empty and emails (welcome, password reset, task assigned) are only written to the backend log. Fill in the `SMTP_*` values in `backend\.env` to send them.

## Production

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm start
```

Set a strong `JWT_SECRET`, `NODE_ENV=production`, and `CLIENT_URL` to the real frontend address.

## What is automatic

| When you... | The system... |
| --- | --- |
| Save any ledger account | Recalculates **Opening Balance Equity** so assets always equal liabilities + equity |
| Record Money In / Money Out | Posts balanced journal entries; "later" amounts raise the customer's / vendor's amount owed |
| Record Money In to **Accounts Receivable** (or Money Out to **Accounts Payable**) | Treats it as a payment and lowers the amount owed |
| Create a business with bank details | Adds its bank account to the ledger with the current balance |
| Create a customer / vendor | Links it to Accounts Receivable / Accounts Payable |
| Generate a pay sheet month | Uses clocked time sheet hours for regular and overtime hours |
| Save or delete a pay sheet entry | Posts (or removes) salary expense, cash paid and deductions payable in the ledger |
| Change a task | Logs task history, recalculates project progress and running cost, emails a new assignee |

Missing control accounts (Cash, Accounts Receivable, Accounts Payable, Salaries & Wages) are created automatically.

## Other features

- **Export**: every table, the ledger summary, all three reports and the 1099 report export to Excel (.xlsx), PDF and CSV.
- **Own work only**: intern, contractor and client roles see only tasks assigned to them and the projects those belong to.
- **1099 report**: Vendors > 1099 report, per year.
- **Email customers**: Customers > Email customers (all, or only those with a balance due).
- **Reminders** (hourly check, each at most once a day): task assignee the day before a deadline; customers and vendor owners with "Turn on reminder" from 3 days before the due date while a balance is owed.
- **Audit log**: every create, update, delete and sign-in is written to `backend/logs/audit.log`.

Emails are only written to `backend/logs/app.log` until the `SMTP_*` values are set in `backend/.env`.

## Database commands

| Command (in `backend`) | What it does |
| --- | --- |
| `npm run db:setup` | Creates the database and tables, loads the sample data (empty database only) |
| `npm run db:reset` | Removes all records, keeps the super-admin user, roles and modules |

## Invoices

Accounting > Invoices. Tables `invoices` and `invoice_items` (added on request; not in the original documentation sheet).

- **New invoice**: customer, dates, line items and an optional tax rate. Totals are calculated by the server.
- Saving posts the total to **Accounts Receivable** against the income account and raises the customer's amount owed.
- **Receive** records a payment: it posts Money In to Accounts Receivable and lowers the customer's balance. Status (Unpaid, Partial, Overdue, Paid) is worked out from payments and the due date.
- **View > Download PDF** gives the printable invoice. The sender is the customer's linked business.
- An invoice with payments cannot be deleted; delete its payments from Transactions first.

## Module Access (switch modules on or off per role)

User Management > Module Access, super admin only. Table `role_module_access` (added on request).

For every role and module choose **Off** (hidden and blocked), **View** (read only) or **Full** (add, edit, delete). Changes apply on the user's next click. "reset" under a role name puts it back to the defaults, which are defined in `MODULES` in `backend/src/middleware/auth.ts`. Super admin always has everything.

## Onboarding tour

Starts by itself the first time a user opens the dashboard on a device, and can be replayed from the **?** button in the top bar. Steps are in `frontend/src/components/layout/tour.tsx`; add `data-tour="name"` to any element to point a step at it.

## After pulling new code

Run `npm run db:migrate` in `backend` once. It only creates tables that are missing and never touches existing data.

## Deploying online (Vercel + cloud MySQL)

Deploy the two folders as **two Vercel projects** from the same GitHub repo.

### 1. Online database
Create a MySQL service (for example Aiven, free plan). Then, on your PC:

1. Copy `backend/.env.cloud.example` to `backend/.env.cloud` and fill in the online host, port, user, password and database name.
2. In `backend` run `npm run db:copy-to-cloud`. It creates all tables online and copies this PC's data (users, accounts, records). It refuses to run if the online database already has users.

### 2. Backend project
Vercel > Add New > Project > this repo. Root Directory `backend`, preset **Express**. Environment variables:

| Key | Value |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | from the database provider |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | optional: the provider's CA certificate, to also verify the server |
| `JWT_SECRET` | a long random string (not the one on your PC) |
| `JWT_EXPIRES_IN` | `2h` |
| `CLIENT_URL` | the frontend's Vercel address, e.g. `https://myaccounting.vercel.app` |
| `NODE_ENV` | `production` |

### 3. Frontend project
Root Directory `frontend`, preset **Next.js**. Set `NEXT_PUBLIC_API_URL` to the backend's Vercel address followed by `/api`, then redeploy.

### What works differently on Vercel
- Logs and the audit trail go to the Vercel function logs (no files).
- Uploaded files (profile picture, CNIC, CV, contract) are stored only temporarily. Keep the documents somewhere permanent if they matter.
- Hourly reminder emails do not run on their own. A super admin can trigger them, or run the backend on a normal server (Railway, Render, a VPS) where everything works as on your PC.
