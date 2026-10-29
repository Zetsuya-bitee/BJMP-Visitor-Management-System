# BJMP Custodial / Gate Officer – Visitor Management System

A production-ready, secure web application engineered for the Custodial and Gate Officer Department of a correctional facility (Bureau of Jail Management and Penology - BJMP).

This application manages visitor registration, digital logbook tracking, inmate cell assignment monitoring, daily physical headcounts, discrepancy certification, audit trail logging, and certified record exports.

---

## 🏛️ System Modules & Key Features

### 1. User Authentication & Role-Based Access Control
- **Secure Authentication**: Hashed password verification (`bcrypt`), secure HTTP session management, and session timeout.
- **Roles & Permissions**:
  - `admin` (Jail Warden / System Administrator): Full system control, account management (create, update, deactivate, reset password), facility system settings, audits.
  - `supervisor` (Custodial Shift Supervisor): Inmate cell transfers, headcount discrepancy review & certification, visitor management, report generation, audit trail.
  - `gate_officer` (Authorized Gate Officer): Visitor registration, ingress check-in & departure check-out, logbook filtering, physical headcount roll submission, view cell housing.
- **Security Audit Logging**: Every critical action (logins, failed attempts, check-ins, check-outs, denials, corrections, cell transfers, headcounts) is permanently recorded with user, timestamp, action, IP address, and forensic details.

### 2. Custodial Command Dashboard
- **Live Metrics**:
  - Total visitors recorded today
  - Visitors currently inside the facility (active ingress)
  - Completed visits (officially checked out)
  - Expected visitors (scheduled appointments)
  - Active inmates currently in facility custody
  - Cell occupancy breakdown with capacity percentage bars
- **Active Real-Time Alerts**:
  - **Incomplete Check-Outs / Overstay Alert**: Flags visitors who have exceeded the allowable visit duration (60 minutes threshold) without checking out.
  - **Headcount Muster Alert**: Alerts personnel if a shift headcount is pending or has an unreviewed discrepancy.
- **Quick Date Filter**: Change date to view historical dashboard logs.

### 3. Visitor Registration & Processing
- **Comprehensive Visitor Intake Form**:
  - Auto-generated Visitor Code (`VIS-YYYYMMDD-XXXX`)
  - Auto-generated Visit Reference Number (`VRN-YYYYMMDD-XXXX`)
  - Full legal name, valid government ID type (PhilSys, Driver's License, Passport, UMID, Postal ID, PRC, Voter's, Senior Citizen, etc.), and ID number
  - Contact number, residential address, gender
  - Inmate selection from active custody roster
  - Relationship to inmate (Spouse, Child, Parent, Sibling, Legal Counsel, etc.)
  - Purpose of visit (Family visit, Legal consultation, Medical handover, Pastoral, etc.)
  - Assigned visiting venue (Visiting Hall A, Hall B, Conjugal Pavilion, Attorney-Client Booth, etc.)
  - Date and time of entry
  - Gate officer processing the visitor (auto-detected from active session)
- **Duplicate Active Check-In Guard**: Prevents checking in a visitor who is already inside the facility under an active uncompleted check-in.
- **Repeat Visitor Lookup**: Fast autocomplete search bar to autofill returning visitors by name or ID number.
- **Denial Workflow**: Requires a mandatory justification reason when denying gate entry.
- **Printable Visitor Pass**: Official gate entry pass featuring barcode visuals, visitor details, inmate details, security guidelines, and officer signature line.

### 4. Digital Visitor Logbook
- Digital replacement for manual paper-based log sheets.
- **Search & Multi-Filter**: Search by visitor name, ID number, inmate name, reference number; filter by status (`Checked In`, `Checked Out`, `Registered`, `Denied`, `Cancelled`) and date range.
- **Quick Check-Out**: Departure check-out action with optional notes and property return confirmation.
- **Controlled Record Correction**: Editing an existing record requires a mandatory justification reason, which is permanently logged in the audit trail.
- **CSV Export**: Export filtered logbook records to CSV format with UTF-8 BOM encoding for Excel.

### 5. Inmate Cell Assignment Management
- **Housing Monitoring**: Visual cell occupancy overview (capacity, occupancy count, percentage fill bar, full/open badges).
- **Inmate Custody Register**: Search inmates by ID (`INM-YYYY-XXXX`), legal name, or case number; view current housing block and security rating.
- **Authorized Cell Transfer**: Restricted to Supervisors and Admins; validates cell capacity limits, closes previous active assignment, creates new assignment record, updates cell occupancy counters, and logs audit trail.
- **Chronological History Modal**: Complete historical record of an inmate's past and present cell placements with dates and approving officers.

### 6. Daily Attendance & Physical Headcount
- **Three-Shift Tracking**:
  - Morning Shift: `06:00 - 14:00`
  - Afternoon Shift: `14:00 - 22:00`
  - Night Shift: `22:00 - 06:00`
- **Expected Count**: Synchronized with active inmate custody roster as facility baseline.
- **Explicit Verification**: Verification requires explicit entry of the physical roll count by an authorized officer (does not auto-verify on entry).
- **Discrepancy Detection**: Computes count difference (`Verified - Expected`). Flags discrepancy and mandates an explanation remark before submission.
- **Supervisor Review & Certification**: Shift supervisors review and acknowledge discrepancies with official findings.
- **Headcount CSV Export**: Downloadable attendance reports for any date range.

### 7. Reports & Record Exports
- **8 Dedicated Report Categories**:
  1. Daily Visitor Logbook
  2. Visitors Currently Checked In
  3. Completed & Denied Visits
  4. Visitors Who Have Not Checked Out (Overstay Audit)
  5. Visitor Activity by Date Range
  6. Inmate Cell Assignment & Housing Summary
  7. Daily Headcount Records & Discrepancies
  8. User Activity & Security Audit Trail
- **CSV Data Export** and **Official Printable Report (PDF)** formatted with Republic of the Philippines / DILG / BJMP headers, facility code, generated timestamp, and 3-tier signatory certification block (Prepared by Officer, Verified by Supervisor, Approved by Jail Warden).

### 8. User Management (Admin Only)
- List, create, update, and manage custodial personnel accounts.
- Set roles (`admin`, `supervisor`, `gate_officer`), badge numbers, and email.
- One-click account activation/deactivation with self-deactivation protection.
- Administrative password reset.

### 9. System Settings (Admin Only)
- Configurable facility name, facility code, visiting hours, allowable visit duration, overstay alert threshold, and visiting venue list.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (ES Modules, `import`/`export`)
- **Backend Framework**: Express.js
- **Database & ORM**: Sequelize ORM
  - Default: **SQLite** (`./bjmp_database.sqlite`) for zero-configuration, fully persistent local operation.
  - Optional: **MySQL / MariaDB** (configure via `.env` without code changes).
- **Security & Sessions**: `bcrypt` (password hashing), `express-session`, `connect-flash`.
- **View Engine**: Handlebars (`hbs`) using the `.xian` template extension.
- **UI & Styling**: Tailwind CSS, FontAwesome 6 Icons.

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- Node.js v18.0.0 or higher (v24 recommended).
- Git (optional).

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
The application comes pre-configured with `.env`. You can adjust settings or use `.env.example`:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=bjmp-custodial-secure-session-key-2026-auth-prod
DB_DIALECT=sqlite
DB_STORAGE=./bjmp_database.sqlite

# MySQL (Optional - to use MySQL instead of SQLite):
# DB_DIALECT=mysql
# DB_HOST=localhost
# DB_PORT=3306
# DB_NAME=BJMP
# DB_USER=root
# DB_PASS=

FACILITY_NAME=BJMP San Jose District Jail - Gate & Custodial Unit
FACILITY_CODE=BJMP-R4B-SJD-01
TIMEZONE=Asia/Manila
```

### 4. Database Setup & Seeding
The database auto-seeds on first application start, or you can run the seed script directly:
```bash
npm run seed
```

### 5. Launch the Application
```bash
npm start
```
The terminal will display:
```
🛡️ BJMP Custodial Gate System running at http://localhost:3000
```
Open your browser to: **`http://localhost:3000`**

---

## 🔑 Default Authorized Accounts

The database includes three pre-configured accounts for testing each clearance tier (also available via one-click preset buttons on the login page):

| Role | Username | Password | Full Name & Rank | Clearance |
| :--- | :--- | :--- | :--- | :--- |
| **Warden / Admin** | `admin` | `AdminPassword123!` | JCInsp Carlos M. Santos | Full System, User Mgmt, Settings |
| **Shift Supervisor** | `supervisor` | `Supervisor123!` | SJO4 Roberto V. Mendoza | Cell Transfers, Headcount Review, Audits |
| **Gate Officer** | `gateofficer` | `GateOfficer123!` | JO2 Danilo P. Ramos | Visitor Reg, Check In/Out, Roll Submission |

---

## 🧪 Automated Testing

Run the automated test suite covering unit, business logic, and HTTP integration workflows:
```bash
npm test
```
This executes:
1. `node test_system.js`: Verifies database tables, bcrypt hashing, visitor duplicate check-in prevention, check-out timestamps, record correction audits, cell capacity checks, and headcount discrepancy reviews (21 tests).
2. `node test_integration.js`: Tests unauthenticated redirects, login sessions, authenticated dashboard rendering, registration, logbook, cell management, headcount, reports, and role-based route blocking (13 tests).

---

## 💾 Backup and Restoration Procedures

### SQLite (Default Setup):
- **Backup**:
  Copy the database file `bjmp_database.sqlite` to an encrypted backup storage volume:
  ```powershell
  Copy-Item -Path ".\bjmp_database.sqlite" -Destination ".\backups\bjmp_database_$(Get-Date -Format 'yyyyMMdd_HHmmss').sqlite"
  ```
- **Restore**:
  Stop the node server, replace `bjmp_database.sqlite` with the backup copy, and restart.

### MySQL (When Configured):
- **Backup**:
  ```bash
  mysqldump -u root -p BJMP > bjmp_backup_$(date +%Y%m%d).sql
  ```
- **Restore**:
  ```bash
  mysql -u root -p BJMP < bjmp_backup_20261029.sql
  ```

---

## ⚖️ Compliance & Security Statement
This application complies with correctional facility operational standards:
- Passwords are encrypted using salted `bcrypt` algorithms.
- Cross-Site Scripting (XSS) mitigated through template escaping.
- SQL injection protected by Sequelize parameterized queries.
- Role-based route middleware ensures gate officers cannot alter cell assignments or access administrative user accounts.
- Sensitive records are accompanied by permanent audit trail logs containing officer badge references and client IP addresses.

