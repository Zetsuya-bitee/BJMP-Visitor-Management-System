import bcrypt from "bcrypt";
import {
  sequelize,
  User,
  Cell,
  Inmate,
  CellAssignment,
  Visitor,
  Visit,
  Headcount,
  AuditLog,
  SystemSetting
} from "./models/index.js";

export async function seedDatabase(force = false) {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force });
    console.log("Database schema synchronized.");

    // Check if admin already exists
    const adminCount = await User.count();
    if (adminCount > 0 && !force) {
      console.log("Database already seeded. Skipping initial seeding.");
      return;
    }

    console.log("Seeding BJMP Custodial System...");

    // 1. Settings
    await SystemSetting.bulkCreate([
      {
        setting_key: "facility_name",
        setting_value: "BJMP San Jose District Jail - Gate & Custodial Unit",
        category: "General",
        description: "Official Name of the Correctional Facility"
      },
      {
        setting_key: "facility_code",
        setting_value: "BJMP-R4B-SJD-01",
        category: "General",
        description: "Unique Facility Identifier Code"
      },
      {
        setting_key: "visiting_hours",
        setting_value: "08:00 AM - 05:00 PM (Tuesday to Sunday)",
        category: "Visits",
        description: "Authorized visitor operating hours"
      },
      {
        setting_key: "max_visit_duration_minutes",
        setting_value: "60",
        category: "Visits",
        description: "Standard allowable visit duration in minutes"
      },
      {
        setting_key: "visiting_areas",
        setting_value: "Visiting Hall A,Visiting Hall B,Conjugal Pavilion,Attorney-Client Booth,Gate Reception Area",
        category: "Visits",
        description: "Comma-separated list of approved visiting venues"
      },
      {
        setting_key: "overstay_alert_threshold_minutes",
        setting_value: "60",
        category: "Security",
        description: "Threshold after which an incomplete checkout triggers an active alert"
      }
    ]);

    // 2. Users
    const passwordHash = await bcrypt.hash("AdminPassword123!", 10);
    const supervisorHash = await bcrypt.hash("Supervisor123!", 10);
    const officerHash = await bcrypt.hash("GateOfficer123!", 10);

    const admin = await User.create({
      username: "admin",
      name: "JCInsp Carlos M. Santos",
      email: "warden.santos@bjmp.gov.ph",
      password: passwordHash,
      role: "admin",
      badge_number: "BJMP-W-001",
      status: "active"
    });

    const supervisor = await User.create({
      username: "supervisor",
      name: "SJO4 Roberto V. Mendoza",
      email: "supervisor.mendoza@bjmp.gov.ph",
      password: supervisorHash,
      role: "supervisor",
      badge_number: "BJMP-SUP-014",
      status: "active"
    });

    const gateOfficer = await User.create({
      username: "gateofficer",
      name: "JO2 Danilo P. Ramos",
      email: "officer.ramos@bjmp.gov.ph",
      password: officerHash,
      role: "gate_officer",
      badge_number: "BJMP-GO-089",
      status: "active"
    });

    const gateOfficer2 = await User.create({
      username: "gateofficer2",
      name: "JO1 Maria Elena Castro",
      email: "officer.castro@bjmp.gov.ph",
      password: officerHash,
      role: "gate_officer",
      badge_number: "BJMP-GO-092",
      status: "active"
    });

    // 3. Cells
    const cellsData = [
      { cell_number: "Cell 101", block: "Block A - Maximum Security", capacity: 10, current_occupancy: 2, status: "Active", notes: "High surveillance cell" },
      { cell_number: "Cell 102", block: "Block A - Maximum Security", capacity: 10, current_occupancy: 1, status: "Active", notes: "High surveillance cell" },
      { cell_number: "Cell 201", block: "Block B - Medium Security", capacity: 15, current_occupancy: 2, status: "Active", notes: "General population" },
      { cell_number: "Cell 202", block: "Block B - Medium Security", capacity: 15, current_occupancy: 1, status: "Active", notes: "General population" },
      { cell_number: "Cell 301", block: "Block C - Female Dormitory", capacity: 12, current_occupancy: 1, status: "Active", notes: "Female sector" },
      { cell_number: "Cell 401", block: "Block D - Minimum / Trustee Ward", capacity: 20, current_occupancy: 1, status: "Active", notes: "Low-risk trustees" }
    ];
    const createdCells = await Cell.bulkCreate(cellsData);

    // 4. Inmates
    const inmatesData = [
      {
        inmate_number: "INM-2024-0101",
        first_name: "Juan",
        last_name: "Dela Cruz",
        middle_name: "Mercado",
        gender: "Male",
        date_of_birth: "1988-04-12",
        date_admitted: "2024-01-15",
        case_number: "CR-2024-0089",
        security_level: "Maximum",
        status: "Active",
        cell_id: createdCells[0].id,
        remarks: "Strict visitation guidelines applied."
      },
      {
        inmate_number: "INM-2024-0102",
        first_name: "Eduardo",
        last_name: "Reyes",
        middle_name: "Torres",
        gender: "Male",
        date_of_birth: "1992-08-25",
        date_admitted: "2024-02-10",
        case_number: "CR-2024-0144",
        security_level: "Maximum",
        status: "Active",
        cell_id: createdCells[0].id,
        remarks: "Court appearance scheduled next month."
      },
      {
        inmate_number: "INM-2024-0103",
        first_name: "Ramon",
        last_name: "Villanueva",
        middle_name: "Soriano",
        gender: "Male",
        date_of_birth: "1985-11-03",
        date_admitted: "2024-03-01",
        case_number: "CR-2024-0205",
        security_level: "Maximum",
        status: "Active",
        cell_id: createdCells[1].id,
        remarks: "Medical checkup cleared."
      },
      {
        inmate_number: "INM-2024-0201",
        first_name: "Ricardo",
        last_name: "Bautista",
        middle_name: "Luna",
        gender: "Male",
        date_of_birth: "1995-03-14",
        date_admitted: "2024-04-18",
        case_number: "CR-2024-0312",
        security_level: "Medium",
        status: "Active",
        cell_id: createdCells[2].id,
        remarks: "Enrolled in vocational skills training."
      },
      {
        inmate_number: "INM-2024-0202",
        first_name: "Antonio",
        last_name: "Garcia",
        middle_name: "Pascual",
        gender: "Male",
        date_of_birth: "1990-07-20",
        date_admitted: "2024-05-02",
        case_number: "CR-2024-0419",
        security_level: "Medium",
        status: "Active",
        cell_id: createdCells[2].id,
        remarks: "Good conduct standing."
      },
      {
        inmate_number: "INM-2024-0203",
        first_name: "Manuel",
        last_name: "Santos",
        middle_name: "David",
        gender: "Male",
        date_of_birth: "1993-09-09",
        date_admitted: "2024-06-11",
        case_number: "CR-2024-0504",
        security_level: "Medium",
        status: "Active",
        cell_id: createdCells[3].id,
        remarks: "No disciplinary actions."
      },
      {
        inmate_number: "INM-2024-0301",
        first_name: "Maria Cristina",
        last_name: "Flores",
        middle_name: "Beltran",
        gender: "Female",
        date_of_birth: "1991-12-05",
        date_admitted: "2024-02-28",
        case_number: "CR-2024-0199",
        security_level: "Medium",
        status: "Active",
        cell_id: createdCells[4].id,
        remarks: "Eligible for attorney consultation."
      },
      {
        inmate_number: "INM-2024-0401",
        first_name: "Fernando",
        last_name: "Aquino",
        middle_name: "Guevarra",
        gender: "Male",
        date_of_birth: "1978-01-30",
        date_admitted: "2023-11-20",
        case_number: "CR-2023-0981",
        security_level: "Minimum",
        status: "Active",
        cell_id: createdCells[5].id,
        remarks: "Designated facility trustee."
      }
    ];
    const createdInmates = await Inmate.bulkCreate(inmatesData);

    // 5. Initial Cell Assignment History
    for (const inm of createdInmates) {
      await CellAssignment.create({
        inmate_id: inm.id,
        from_cell_id: null,
        to_cell_id: inm.cell_id,
        start_date: inm.date_admitted,
        transfer_reason: "Initial cell assignment upon custodial admission",
        authorized_by_id: supervisor.id,
        status: "Active",
        remarks: "Standard custodial admission protocol"
      });
    }

    // 6. Visitors
    const visitorsData = [
      {
        visitor_code: "VIS-20261029-001",
        full_name: "Corazon Dela Cruz",
        id_type: "National ID (PhilSys)",
        id_number: "ID-PH-4921-8842",
        contact_number: "0917-123-4567",
        address: "Barangay Poblacion, San Jose, Occ. Mindoro",
        gender: "Female"
      },
      {
        visitor_code: "VIS-20261029-002",
        full_name: "Atty. Renato P. Almario",
        id_type: "PRC Attorney License",
        id_number: "IBP-ROLL-48210",
        contact_number: "0920-987-6543",
        address: "Unit 402 Legal Tower, Batangas City",
        gender: "Male"
      },
      {
        visitor_code: "VIS-20261029-003",
        full_name: "Teresa Reyes",
        id_type: "Driver's License",
        id_number: "N01-14-098231",
        contact_number: "0918-555-1234",
        address: "Sitio Riverside, Central, San Jose",
        gender: "Female"
      },
      {
        visitor_code: "VIS-20261029-004",
        full_name: "Danilo Bautista Sr.",
        id_type: "Senior Citizen ID",
        id_number: "OSCA-2019-0412",
        contact_number: "0922-333-8899",
        address: "Barangay Pag-asa, Mamburao",
        gender: "Male"
      },
      {
        visitor_code: "VIS-20261029-005",
        full_name: "Pedro Morales",
        id_type: "Voter's ID",
        id_number: "VOT-5912-3019",
        contact_number: "0919-444-2211",
        address: "Barangay San Roque, San Jose",
        gender: "Male",
        is_banned: false
      }
    ];
    const createdVisitors = await Visitor.bulkCreate(visitorsData);

    const todayStr = new Date().toISOString().split("T")[0];

    // 7. Visits (Checked In, Checked Out, Denied, Registered)
    await Visit.bulkCreate([
      {
        reference_no: "VRN-20261029-1001",
        visitor_id: createdVisitors[0].id, // Corazon
        inmate_id: createdInmates[0].id, // Juan Dela Cruz
        visit_date: todayStr,
        time_in: "08:30 AM",
        time_out: null, // Currently Inside! (Alert test: over 60 mins)
        relationship: "Spouse",
        purpose: "Family Visit",
        visiting_area: "Visiting Hall A",
        status: "Checked In",
        check_in_officer_id: gateOfficer.id,
        remarks: "Approved family visitor; food basket inspected and passed."
      },
      {
        reference_no: "VRN-20261029-1002",
        visitor_id: createdVisitors[1].id, // Atty. Almario
        inmate_id: createdInmates[6].id, // Maria Cristina Flores
        visit_date: todayStr,
        time_in: "09:00 AM",
        time_out: null, // Currently Inside
        relationship: "Legal Counsel",
        purpose: "Legal Consultation",
        visiting_area: "Attorney-Client Booth",
        status: "Checked In",
        check_in_officer_id: gateOfficer.id,
        remarks: "Legal case briefing; documents inspected according to security protocols."
      },
      {
        reference_no: "VRN-20261029-1003",
        visitor_id: createdVisitors[2].id, // Teresa Reyes
        inmate_id: createdInmates[1].id, // Eduardo Reyes
        visit_date: todayStr,
        time_in: "08:15 AM",
        time_out: "09:15 AM",
        relationship: "Sibling",
        purpose: "Welfare Check",
        visiting_area: "Visiting Hall B",
        status: "Checked Out",
        check_in_officer_id: gateOfficer.id,
        check_out_officer_id: gateOfficer.id,
        remarks: "Visit completed normally without incidents."
      },
      {
        reference_no: "VRN-20261029-1004",
        visitor_id: createdVisitors[3].id, // Danilo Bautista Sr.
        inmate_id: createdInmates[3].id, // Ricardo Bautista
        visit_date: todayStr,
        time_in: "10:00 AM",
        time_out: "10:50 AM",
        relationship: "Parent",
        purpose: "Family Visit",
        visiting_area: "Visiting Hall A",
        status: "Checked Out",
        check_in_officer_id: gateOfficer2.id,
        check_out_officer_id: gateOfficer2.id,
        remarks: "Prescription medication handed over to jail medical officer."
      },
      {
        reference_no: "VRN-20261029-1005",
        visitor_id: createdVisitors[4].id, // Pedro Morales
        inmate_id: createdInmates[2].id, // Ramon Villanueva
        visit_date: todayStr,
        time_in: null,
        time_out: null,
        relationship: "Friend",
        purpose: "Personal Visit",
        visiting_area: "Gate Reception Area",
        status: "Denied",
        denial_reason: "Visitor failed intoxication sobriety screening at gate checkpoint; prohibited items detected.",
        denied_by_id: gateOfficer.id,
        remarks: "Turned away at main security gate checkpoint pursuant to BJMP SOP 2024-03."
      },
      {
        reference_no: "VRN-20261029-1006",
        visitor_id: createdVisitors[3].id, // Danilo Bautista Sr.
        inmate_id: createdInmates[3].id,
        visit_date: todayStr,
        time_in: null,
        time_out: null,
        relationship: "Parent",
        purpose: "Follow-up visit",
        visiting_area: "Visiting Hall A",
        status: "Registered",
        check_in_officer_id: gateOfficer.id,
        remarks: "Pre-registered appointment for afternoon session."
      }
    ]);

    // 8. Headcounts
    const activeInmateCount = createdInmates.length; // 8 active inmates
    await Headcount.bulkCreate([
      {
        date: todayStr,
        shift: "Morning (06:00 - 14:00)",
        expected_count: activeInmateCount,
        verified_count: activeInmateCount,
        difference: 0,
        status: "Matched",
        conducting_officer_id: gateOfficer.id,
        verified_at: new Date(),
        remarks: "All 8 inmates accounted for in designated cells during 06:00 muster.",
        reviewed_by_id: supervisor.id,
        reviewed_at: new Date(),
        supervisor_notes: "Headcount verified and certified accurate."
      },
      {
        date: todayStr,
        shift: "Afternoon (14:00 - 22:00)",
        expected_count: activeInmateCount,
        verified_count: null,
        difference: 0,
        status: "Pending",
        conducting_officer_id: null,
        verified_at: null,
        remarks: "Scheduled for 18:00 inspection lockup."
      }
    ]);

    // 9. Initial Audit Logs
    await AuditLog.bulkCreate([
      {
        user_id: admin.id,
        username: admin.username,
        action: "SYSTEM_INITIALIZED",
        entity: "System",
        entity_id: "0",
        ip_address: "127.0.0.1",
        details: "Initial BJMP custodial management database initialized and seeded with baseline configurations."
      },
      {
        user_id: gateOfficer.id,
        username: gateOfficer.username,
        action: "VISITOR_CHECKED_IN",
        entity: "Visit",
        entity_id: "VRN-20261029-1001",
        ip_address: "192.168.1.101",
        details: "Processed check-in for Corazon Dela Cruz visiting inmate Juan Dela Cruz (Cell 101)."
      },
      {
        user_id: gateOfficer.id,
        username: gateOfficer.username,
        action: "VISITOR_DENIED",
        entity: "Visit",
        entity_id: "VRN-20261029-1005",
        ip_address: "192.168.1.101",
        details: "Denied visit for Pedro Morales: Intoxication / security breach."
      }
    ]);

    console.log("✅ BJMP database successfully seeded!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  seedDatabase(true).then(() => {
    console.log("Seed script completed.");
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

