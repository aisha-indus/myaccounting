-- IBMS schema. Table and column names follow the documentation spreadsheet exactly.
-- All monetary values are DECIMAL(15,2) (SRS 2.4).

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  permissions TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_name VARCHAR(150) NOT NULL UNIQUE,
  actions TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_name VARCHAR(190) NOT NULL UNIQUE,
  type VARCHAR(50),
  start_date DATE,
  deadline DATE,
  estimated_cost DECIMAL(15,2) DEFAULT 0,
  running_cost DECIMAL(15,2) DEFAULT 0,
  estimated_time INT DEFAULT 0,
  percent_completed INT DEFAULT 0,
  main_category VARCHAR(100),
  sub_category VARCHAR(100),
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_name VARCHAR(190) NOT NULL,
  project_id INT,
  assigned_to INT,
  assigned_by INT,
  department VARCHAR(100),
  estimated_time INT DEFAULT 0,
  actual_time INT DEFAULT 0,
  deadline DATE,
  assigned_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  document_link VARCHAR(500),
  assignor_notes TEXT,
  assignee_notes TEXT,
  start_time DATETIME,
  end_time DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_assignor FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INT,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  surname VARCHAR(100),
  company_name VARCHAR(190),
  cnic_ntn VARCHAR(50),
  cell VARCHAR(50),
  email VARCHAR(190),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(100),
  member_type VARCHAR(50),
  start_date DATE,
  status VARCHAR(30) DEFAULT 'Active',
  schedule VARCHAR(100),
  salary DECIMAL(15,2),
  hourly_rate DECIMAL(15,2),
  weekly_hours INT,
  monthly_hours INT,
  overtime_rate DECIMAL(15,2),
  flat_rate DECIMAL(15,2),
  commissions DECIMAL(15,2),
  over_ride DECIMAL(15,2),
  bank_name VARCHAR(150),
  account_number VARCHAR(100),
  iban VARCHAR(100),
  jazz_cash VARCHAR(50),
  easy_paisa VARCHAR(50),
  notes TEXT,
  profile_picture VARCHAR(255),
  cnic_upload VARCHAR(255),
  cv_upload VARCHAR(255),
  contract_upload VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_pay_sheet (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_member_id INT NOT NULL,
  month DATE NOT NULL,
  total_regular_hours INT DEFAULT 0,
  hourly_rate DECIMAL(15,2) DEFAULT 0,
  base_salary DECIMAL(15,2) DEFAULT 0,
  overtime_hours INT DEFAULT 0,
  overtime_rate DECIMAL(15,2) DEFAULT 0,
  total_overtime DECIMAL(15,2) DEFAULT 0,
  bonus_comm DECIMAL(15,2) DEFAULT 0,
  flat_rate DECIMAL(15,2) DEFAULT 0,
  gross_payout DECIMAL(15,2) DEFAULT 0,
  tax_withheld DECIMAL(15,2) DEFAULT 0,
  gratuity DECIMAL(15,2) DEFAULT 0,
  insurance DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  net_payout DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_member FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_time_sheet (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_member_id INT NOT NULL,
  date DATE NOT NULL,
  login TIME,
  logout TIME,
  total_hours DECIMAL(15,2) DEFAULT 0,
  pay_value DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_time_member FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_member_id INT NOT NULL,
  main_category VARCHAR(100),
  sub_category VARCHAR(100),
  estimated_time_min INT DEFAULT 0,
  estimated_cost DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_skills_member FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  business_name VARCHAR(190) NOT NULL,
  industry VARCHAR(100),
  business_structure VARCHAR(100),
  ssn_ein_ntn_cnic VARCHAR(50),
  phone VARCHAR(50),
  ext VARCHAR(20),
  web_address VARCHAR(255),
  email VARCHAR(190),
  num_employees INT,
  num_contractors INT,
  budget_month_start DATE,
  budget_month_end DATE,
  bank_name VARCHAR(150),
  account_no VARCHAR(100),
  current_balance DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_business_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  account_code VARCHAR(50) NOT NULL UNIQUE,
  account_type VARCHAR(30) NOT NULL,
  sub_type VARCHAR(100),
  category VARCHAR(100),
  start_date DATE,
  start_balance DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_name VARCHAR(150) NOT NULL,
  business_name VARCHAR(190),
  tax_id VARCHAR(50),
  phone VARCHAR(50),
  web_address VARCHAR(255),
  what_is_this_for VARCHAR(255),
  user_id INT,
  business_id INT,
  due_date DATE,
  login_url VARCHAR(255),
  email VARCHAR(190),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  amount_owed DECIMAL(15,2) DEFAULT 0,
  balance_of_credit_given DECIMAL(15,2) DEFAULT 0,
  auto_billing BOOLEAN DEFAULT 0,
  turn_on_reminder BOOLEAN DEFAULT 0,
  linked_ledger_account_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_ledger FOREIGN KEY (linked_ledger_account_id) REFERENCES ledger_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(100),
  contact_name VARCHAR(150) NOT NULL,
  business_name VARCHAR(190),
  tax_id VARCHAR(50),
  is_1099 BOOLEAN DEFAULT 0,
  phone VARCHAR(50),
  email VARCHAR(190),
  web_address VARCHAR(255),
  login_url VARCHAR(255),
  user_id INT,
  due_date DATE,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  auto_billing BOOLEAN DEFAULT 0,
  turn_on_reminder BOOLEAN DEFAULT 0,
  amount_owed DECIMAL(15,2) DEFAULT 0,
  balance_left_on_credit DECIMAL(15,2) DEFAULT 0,
  what_is_this_for VARCHAR(255),
  linked_ledger_account_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_vendors_ledger FOREIGN KEY (linked_ledger_account_id) REFERENCES ledger_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  party_name VARCHAR(190),
  customer_id INT,
  vendor_id INT,
  for_what VARCHAR(255),
  ledger_account_id INT NOT NULL,
  amount_now DECIMAL(15,2) DEFAULT 0,
  amount_later DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_tx_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_tx_ledger FOREIGN KEY (ledger_account_id) REFERENCES ledger_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT,
  account_id INT NOT NULL,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_journal_tx FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_journal_account FOREIGN KEY (account_id) REFERENCES ledger_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Added after the documentation sheet (requested): invoices and per-role module access.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(30) UNIQUE,
  customer_id INT NOT NULL,
  business_id INT,
  issue_date DATE NOT NULL,
  due_date DATE,
  ledger_account_id INT NOT NULL,
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  transaction_id INT,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_invoice_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_ledger FOREIGN KEY (ledger_account_id) REFERENCES ledger_accounts(id),
  CONSTRAINT fk_invoice_tx FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 1,
  unit_price DECIMAL(15,2) DEFAULT 0,
  amount DECIMAL(15,2) DEFAULT 0,
  CONSTRAINT fk_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per role + module that differs from the built-in default. access: none | view | full
CREATE TABLE IF NOT EXISTS role_module_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  module_key VARCHAR(50) NOT NULL,
  access VARCHAR(10) NOT NULL,
  UNIQUE KEY uq_role_module (role_id, module_key),
  CONSTRAINT fk_access_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
