import { startServer } from "./index.js";

async function testIntegration() {
  console.log("🌐 Starting HTTP Server for Integration Testing...");
  const testPort = 3108;
  const server = await startServer(testPort);
  const baseUrl = `http://localhost:${testPort}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ HTTP PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ HTTP FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Unauthenticated root redirect to /login
    console.log("\n[TEST HTTP 1] Unauthenticated Access & Login Page...");
    const rootRes = await fetch(`${baseUrl}/`, { redirect: "manual" });
    assert(rootRes.status === 302 && rootRes.headers.get("location") === "/login", "Unauthenticated request redirects to /login");

    const loginRes = await fetch(`${baseUrl}/login`);
    const loginHtml = await loginRes.text();
    assert(loginRes.status === 200 && loginHtml.includes("BUREAU OF JAIL MANAGEMENT AND PENOLOGY"), "Login page renders successfully with BJMP header.");

    // 2. Sign in as Gate Officer
    console.log("\n[TEST HTTP 2] Officer Sign In & Session Cookie Handling...");
    const loginPostRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        usernameOrEmail: "gateofficer",
        password: "GateOfficer123!"
      }),
      redirect: "manual"
    });

    const cookieHeader = loginPostRes.headers.get("set-cookie");
    assert(loginPostRes.status === 302 && cookieHeader, "Gate officer login succeeds and returns session cookie.");
    const sessionCookie = cookieHeader ? cookieHeader.split(";")[0] : "";

    // 3. Authenticated Dashboard Access
    console.log("\n[TEST HTTP 3] Authenticated Navigation & Module Rendering...");
    const dashRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: sessionCookie }
    });
    const dashHtml = await dashRes.text();
    assert(dashRes.status === 200 && dashHtml.includes("Custodial Command Dashboard"), "Dashboard renders for signed-in officer.");
    assert(dashHtml.includes("Currently Inside"), "Dashboard displays 'Currently Inside' counter.");

    // 4. Visitor Registration Page
    const regRes = await fetch(`${baseUrl}/visitors/register`, {
      headers: { Cookie: sessionCookie }
    });
    const regHtml = await regRes.text();
    assert(regRes.status === 200 && (regHtml.includes("Visitor Registration") || regHtml.includes("Gate Processing")), "Visitor registration form renders.");

    // 5. Visitor Logbook
    const logRes = await fetch(`${baseUrl}/logbook`, {
      headers: { Cookie: sessionCookie }
    });
    const logHtml = await logRes.text();
    assert(logRes.status === 200 && logHtml.includes("Digital Visitor Logbook"), "Visitor logbook renders.");

    // 6. Cell Management
    const cellRes = await fetch(`${baseUrl}/cells`, {
      headers: { Cookie: sessionCookie }
    });
    const cellHtml = await cellRes.text();
    assert(cellRes.status === 200 && cellHtml.includes("Inmate Cell Assignment Monitoring"), "Cell management renders.");

    // 7. Daily Headcount
    const headRes = await fetch(`${baseUrl}/headcount`, {
      headers: { Cookie: sessionCookie }
    });
    const headHtml = await headRes.text();
    assert(headRes.status === 200 && headHtml.includes("Physical Headcount"), "Headcount module renders.");

    // 8. Reports & Analytics
    const repRes = await fetch(`${baseUrl}/reports`, {
      headers: { Cookie: sessionCookie }
    });
    const repHtml = await repRes.text();
    assert(repRes.status === 200 && repHtml.includes("Custodial Reports"), "Reports module renders.");

    // 9. Role-Based Access Control: Gate Officer should NOT have access to /users (Admin only)
    console.log("\n[TEST HTTP 4] Role-Based Access Protection Guard...");
    const userAdminRes = await fetch(`${baseUrl}/users`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual"
    });
    assert(userAdminRes.status === 302, "Gate officer is blocked from accessing Admin-only /users route.");

    // 10. Admin Sign In & Access to Protected Modules
    const adminLoginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        usernameOrEmail: "admin",
        password: "AdminPassword123!"
      }),
      redirect: "manual"
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const adminUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { Cookie: adminCookie }
    });
    const adminUsersHtml = await adminUsersRes.text();
    assert(adminUsersRes.status === 200 && adminUsersHtml.includes("Officer &amp; Personnel Account Management"), "Admin successfully accesses /users module.");

    const adminSettingsRes = await fetch(`${baseUrl}/settings`, {
      headers: { Cookie: adminCookie }
    });
    const adminSettingsHtml = await adminSettingsRes.text();
    assert(adminSettingsRes.status === 200 && adminSettingsHtml.includes("Facility Configuration &amp; System Settings"), "Admin successfully accesses /settings module.");

    console.log("\n=================================================");
    console.log(`📊 HTTP INTEGRATION SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================");

    server.close(() => {
      console.log("Test HTTP server closed gracefully.");
      if (failed === 0) {
        console.log("🌟 ALL HTTP INTEGRATION TESTS PASSED!");
        process.exit(0);
      } else {
        process.exit(1);
      }
    });

  } catch (err) {
    console.error("HTTP Test Exception:", err);
    server.close();
    process.exit(1);
  }
}

testIntegration();
