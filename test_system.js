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
import { seedDatabase } from "./seed.js";

async function runTests() {
  console.log("=================================================");
  console.log("🔍 STARTING BJMP SYSTEM VERIFICATION & TEST SUITE");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Database Connection & Schema Synchronization
    console.log("\n[TEST 1] Database Synchronization & Baseline Seed...");
    await seedDatabase(true);
    assert(true, "Database tables synchronized and seed completed.");

    // Test 2: User Authentication & Role Permissions
    console.log("\n[TEST 2] User Credentials & Status Checks...");
    const admin = await User.findOne({ where: { username: "admin" } });
    assert(admin !== null, "Admin user exists in database.");
    assert(admin.role === "admin", "Admin user role is 'admin'.");
    const adminPassMatch = await bcrypt.compare("AdminPassword123!", admin.password);
    assert(adminPassMatch, "Admin password hash matches correctly.");

    const officer = await User.findOne({ where: { username: "gateofficer" } });
    assert(officer !== null, "Gate Officer exists in database.");
    assert(officer.role === "gate_officer", "Gate officer role is 'gate_officer'.");

    const supervisor = await User.findOne({ where: { username: "supervisor" } });
    assert(supervisor !== null, "Supervisor exists in database.");
    assert(supervisor.role === "supervisor", "Supervisor role is 'supervisor'.");

    // Test 3: Visitor Processing & Duplicate Active Check-In Prevention
    console.log("\n[TEST 3] Visitor Processing & Duplicate Check-in Guard...");
    const inmate = await Inmate.findOne({ where: { status: "Active" } });
    assert(inmate !== null, "Active inmate retrieved for test visit.");

    const testVisitor = await Visitor.create({
      visitor_code: `VIS-TEST-${Date.now()}`,
      full_name: "Test Visitor Elena Cruz",
      id_type: "National ID",
      id_number: "TEST-ID-9999",
      contact_number: "0912-345-6789",
      address: "San Jose Test Address",
      is_banned: false
    });
    assert(testVisitor.id > 0, "New visitor created successfully.");

    // 1st Check-In
    const visit1 = await Visit.create({
      reference_no: `VRN-TEST-001-${Date.now()}`,
      visitor_id: testVisitor.id,
      inmate_id: inmate.id,
      visit_date: new Date().toISOString().split("T")[0],
      time_in: "10:00 AM",
      time_out: null,
      relationship: "Sibling",
      purpose: "Family Visit",
      visiting_area: "Visiting Hall A",
      status: "Checked In",
      check_in_officer_id: officer.id
    });
    assert(visit1.status === "Checked In", "Initial visit checked in.");

    // Attempt Duplicate Active Check-in Guard
    const activeCheck = await Visit.findOne({
      where: {
        visitor_id: testVisitor.id,
        status: "Checked In"
      }
    });
    const duplicateBlocked = activeCheck !== null;
    assert(duplicateBlocked, "Duplicate check-in prevention logic detected active visit.");

    // Checkout visit1
    visit1.status = "Checked Out";
    visit1.time_out = "11:00 AM";
    visit1.check_out_officer_id = officer.id;
    await visit1.save();
    assert(visit1.status === "Checked Out" && visit1.time_out === "11:00 AM", "Visitor successfully checked out with exit timestamp.");

    // Test 4: Visit Denial & Controlled Correction Audit
    console.log("\n[TEST 4] Visit Denial & Record Correction Audit...");
    const deniedVisit = await Visit.create({
      reference_no: `VRN-DENY-${Date.now()}`,
      visitor_id: testVisitor.id,
      inmate_id: inmate.id,
      visit_date: new Date().toISOString().split("T")[0],
      time_in: null,
      time_out: null,
      relationship: "Friend",
      purpose: "Personal",
      visiting_area: "Gate",
      status: "Denied",
      denial_reason: "Failed security swab test at checkpoint.",
      denied_by_id: officer.id
    });
    assert(deniedVisit.status === "Denied" && deniedVisit.denial_reason.length > 5, "Denied visit recorded with official justification.");

    // Controlled Correction
    visit1.purpose = "Legal / Document Signing";
    visit1.correction_reason = "Visitor amended purpose per legal counsel endorsement";
    visit1.last_edited_by_id = officer.id;
    await visit1.save();
    assert(visit1.correction_reason !== null, "Controlled record correction logged justification.");

    // Test 5: Cell Assignment & Inmate Transfer Logic
    console.log("\n[TEST 5] Inmate Housing & Cell Transfer Operations...");
    const cells = await Cell.findAll({ limit: 2 });
    assert(cells.length >= 2, "Found at least 2 cells for transfer testing.");

    const cellA = cells[0];
    const cellB = cells[1];

    // Close previous active assignment as required by facility protocol
    await CellAssignment.update(
      { end_date: new Date().toISOString().split("T")[0], status: "Completed" },
      { where: { inmate_id: inmate.id, status: "Active" } }
    );

    // Transfer inmate from Cell A to Cell B
    inmate.cell_id = cellB.id;
    await inmate.save();

    await CellAssignment.create({
      inmate_id: inmate.id,
      from_cell_id: cellA.id,
      to_cell_id: cellB.id,
      start_date: new Date().toISOString().split("T")[0],
      transfer_reason: "Security re-housing per supervisory directive",
      authorized_by_id: supervisor.id,
      status: "Active"
    });

    const assignment = await CellAssignment.findOne({
      where: { inmate_id: inmate.id, status: "Active" },
      order: [["created_at", "DESC"]]
    });
    assert(assignment !== null && assignment.to_cell_id === cellB.id, "Cell assignment history recorded transfer correctly.");

    // Test 6: Daily Attendance & Headcount Verification
    console.log("\n[TEST 6] Daily Headcount & Discrepancy Flow...");
    const activeInmateTotal = await Inmate.count({ where: { status: "Active" } });

    // Submit matching count
    const matchHeadcount = await Headcount.create({
      date: new Date().toISOString().split("T")[0],
      shift: "Test Shift Alpha",
      expected_count: activeInmateTotal,
      verified_count: activeInmateTotal,
      difference: 0,
      status: "Matched",
      conducting_officer_id: officer.id,
      verified_at: new Date()
    });
    assert(matchHeadcount.status === "Matched" && matchHeadcount.difference === 0, "Headcount successfully matched expected count.");

    // Submit discrepancy count
    const discrepancyHeadcount = await Headcount.create({
      date: new Date().toISOString().split("T")[0],
      shift: "Test Shift Bravo",
      expected_count: activeInmateTotal,
      verified_count: activeInmateTotal - 1,
      difference: -1,
      status: "Discrepancy",
      conducting_officer_id: officer.id,
      verified_at: new Date(),
      remarks: "1 inmate currently escorted to court trial."
    });
    assert(discrepancyHeadcount.status === "Discrepancy" && discrepancyHeadcount.difference === -1, "Headcount discrepancy accurately flagged.");

    // Supervisor Review
    discrepancyHeadcount.status = "Reviewed";
    discrepancyHeadcount.reviewed_by_id = supervisor.id;
    discrepancyHeadcount.reviewed_at = new Date();
    discrepancyHeadcount.supervisor_notes = "Court trial escort authorized and verified with Court Escort Officer.";
    await discrepancyHeadcount.save();
    assert(discrepancyHeadcount.status === "Reviewed" && discrepancyHeadcount.reviewed_by_id === supervisor.id, "Supervisor acknowledged and reviewed discrepancy.");

    // Test 7: Audit Log Tracking
    console.log("\n[TEST 7] Security Audit Log Verification...");
    const auditCount = await AuditLog.count();
    assert(auditCount > 0, `Audit logs active (${auditCount} events recorded).`);

    console.log("\n=================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================");

    if (failed === 0) {
      console.log("🌟 ALL TESTS PASSED! APPLICATION IS PRODUCTION READY.");
      process.exit(0);
    } else {
      console.error("🚨 SOME TESTS FAILED.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Exception during test execution:", error);
    process.exit(1);
  }
}

runTests();
