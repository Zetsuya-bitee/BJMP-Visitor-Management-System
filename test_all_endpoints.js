import { startServer } from "./index.js";

async function verifyAllEndpoints() {
  const testPort = 3199;
  const server = await startServer(testPort);
  const baseUrl = `http://localhost:${testPort}`;

  console.log(`\n======================================================`);
  console.log(`🔍 COMPREHENSIVE ENDPOINT VERIFICATION SCAN`);
  console.log(`======================================================`);

  let errors = [];

  // Helper to test
  async function testRoute(name, url, options = {}, expectedStatus = 200) {
    try {
      const res = await fetch(url, options);
      if (res.status === expectedStatus) {
        console.log(`  ✅ [${res.status}] ${name}`);
      } else {
        console.error(`  ❌ [${res.status} != ${expectedStatus}] ${name} (${url})`);
        errors.push(`${name}: expected ${expectedStatus}, got ${res.status}`);
      }
      return res;
    } catch (e) {
      console.error(`  💥 EXCEPTION: ${name} - ${e.message}`);
      errors.push(`${name}: ${e.message}`);
      return null;
    }
  }

  try {
    // 1. Public & Auth Endpoints
    await testRoute("Root unauth redirect", `${baseUrl}/`, { redirect: "manual" }, 302);
    await testRoute("Login page", `${baseUrl}/login`, {}, 200);
    await testRoute("Register redirect", `${baseUrl}/register`, { redirect: "manual" }, 302);
    await testRoute("Forgot-password redirect", `${baseUrl}/forgot-password`, { redirect: "manual" }, 302);
    await testRoute("Logout redirect", `${baseUrl}/logout`, { redirect: "manual" }, 302);

    // 2. Login as Gate Officer
    const officerLogin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ usernameOrEmail: "gateofficer", password: "GateOfficer123!" }),
      redirect: "manual"
    });
    const officerCookie = officerLogin.headers.get("set-cookie")?.split(";")[0] || "";

    // 3. Officer accessible pages
    const officerHeaders = { Cookie: officerCookie };
    await testRoute("Dashboard (Officer)", `${baseUrl}/dashboard`, { headers: officerHeaders }, 200);
    await testRoute("Visitor Registration (Officer)", `${baseUrl}/visitors/register`, { headers: officerHeaders }, 200);
    await testRoute("Visitor Search API (Officer)", `${baseUrl}/visitors/search?q=corazon`, { headers: officerHeaders }, 200);
    await testRoute("Visitor Pass View (Officer)", `${baseUrl}/visitors/pass/1`, { headers: officerHeaders }, 200);
    await testRoute("Visitor Logbook (Officer)", `${baseUrl}/logbook`, { headers: officerHeaders }, 200);
    await testRoute("Logbook Export CSV (Officer)", `${baseUrl}/logbook/export/csv`, { headers: officerHeaders }, 200);
    await testRoute("Cell Management (Officer)", `${baseUrl}/cells`, { headers: officerHeaders }, 200);
    await testRoute("Inmate History API (Officer)", `${baseUrl}/cells/inmate/1/history`, { headers: officerHeaders }, 200);
    await testRoute("Daily Headcount (Officer)", `${baseUrl}/headcount`, { headers: officerHeaders }, 200);
    await testRoute("Headcount Export CSV (Officer)", `${baseUrl}/headcount/export/csv`, { headers: officerHeaders }, 200);
    await testRoute("Reports (Officer)", `${baseUrl}/reports`, { headers: officerHeaders }, 200);
    await testRoute("Print Report (Officer)", `${baseUrl}/reports/print`, { headers: officerHeaders }, 200);

    // 4. Role guards: Officer should be redirected (302) on Admin/Supervisor routes
    await testRoute("Audit Logs guard (Officer blocked)", `${baseUrl}/audit-logs`, { headers: officerHeaders, redirect: "manual" }, 302);
    await testRoute("User Management guard (Officer blocked)", `${baseUrl}/users`, { headers: officerHeaders, redirect: "manual" }, 302);
    await testRoute("Settings guard (Officer blocked)", `${baseUrl}/settings`, { headers: officerHeaders, redirect: "manual" }, 302);

    // 5. Login as Supervisor
    const supLogin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ usernameOrEmail: "supervisor", password: "Supervisor123!" }),
      redirect: "manual"
    });
    const supCookie = supLogin.headers.get("set-cookie")?.split(";")[0] || "";
    const supHeaders = { Cookie: supCookie };

    await testRoute("Audit Logs (Supervisor)", `${baseUrl}/audit-logs`, { headers: supHeaders }, 200);
    await testRoute("User Management guard (Supervisor blocked)", `${baseUrl}/users`, { headers: supHeaders, redirect: "manual" }, 302);

    // 6. Login as Admin
    const adminLogin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ usernameOrEmail: "admin", password: "AdminPassword123!" }),
      redirect: "manual"
    });
    const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0] || "";
    const adminHeaders = { Cookie: adminCookie };

    await testRoute("Audit Logs (Admin)", `${baseUrl}/audit-logs`, { headers: adminHeaders }, 200);
    await testRoute("User Accounts (Admin)", `${baseUrl}/users`, { headers: adminHeaders }, 200);
    await testRoute("System Settings (Admin)", `${baseUrl}/settings`, { headers: adminHeaders }, 200);

    console.log(`\n======================================================`);
    if (errors.length === 0) {
      console.log(`🎉 ALL 24 ENDPOINTS & ROUTE GUARDS VERIFIED WITH 0 ERRORS!`);
    } else {
      console.error(`🚨 DETECTED ${errors.length} ROUTE ERRORS:`);
      errors.forEach(e => console.error(" - " + e));
    }
    console.log(`======================================================`);

    server.close(() => {
      process.exit(errors.length === 0 ? 0 : 1);
    });

  } catch (err) {
    console.error("Test Exception:", err);
    server.close();
    process.exit(1);
  }
}

verifyAllEndpoints();

