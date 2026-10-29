import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import fs from "fs";
import hbs from "hbs";
import dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import { seedDatabase } from "./seed.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "bjmp-custodial-system-secret-key-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8 // 8-hour shift session expiration
    }
  })
);

app.use(flash());

// Register Handlebars Helpers
hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("neq", (a, b) => a !== b);
hbs.registerHelper("or", (a, b) => a || b);
hbs.registerHelper("and", (a, b) => a && b);
hbs.registerHelper("not", (a) => !a);
hbs.registerHelper("gt", (a, b) => Number(a) > Number(b));
hbs.registerHelper("gte", (a, b) => Number(a) >= Number(b));
hbs.registerHelper("lt", (a, b) => Number(a) < Number(b));
hbs.registerHelper("lte", (a, b) => Number(a) <= Number(b));
hbs.registerHelper("add", (a, b) => Number(a) + Number(b));
hbs.registerHelper("sub", (a, b) => Number(a) - Number(b));
hbs.registerHelper("json", (obj) => JSON.stringify(obj));

hbs.registerHelper("formatDate", (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? dateVal : d.toISOString().split("T")[0];
  } catch {
    return dateVal;
  }
});

hbs.registerHelper("formatDateTime", (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    return isNaN(d.getTime())
      ? dateVal
      : d.toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
  } catch {
    return dateVal;
  }
});

hbs.registerHelper("statusBadge", (status) => {
  let badgeClass = "bg-gray-100 text-gray-800 border-gray-300";

  switch (status) {
    case "Checked In":
      badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
      break;
    case "Checked Out":
      badgeClass = "bg-blue-100 text-blue-800 border-blue-300";
      break;
    case "Registered":
      badgeClass = "bg-amber-100 text-amber-800 border-amber-300";
      break;
    case "Denied":
      badgeClass = "bg-red-100 text-red-800 border-red-300";
      break;
    case "Cancelled":
      badgeClass = "bg-gray-200 text-gray-700 border-gray-300";
      break;
    case "Matched":
      badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
      break;
    case "Discrepancy":
      badgeClass = "bg-red-100 text-red-800 border-red-300 animate-pulse";
      break;
    case "Reviewed":
      badgeClass = "bg-purple-100 text-purple-800 border-purple-300";
      break;
    case "Pending":
      badgeClass = "bg-amber-100 text-amber-800 border-amber-300";
      break;
    case "Active":
      badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
      break;
    case "Inactive":
      badgeClass = "bg-gray-100 text-gray-600 border-gray-300";
      break;
  }

  return new hbs.SafeString(
    `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}">${status}</span>`
  );
});

// Template engine setup for .xian
app.engine("xian", async (filePath, options, callback) => {
  try {
    const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, "views");

    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => {
        if (err) return reject(err);
        resolve(html);
      });
    });

    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) {
    callback(err);
  }
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

// Synchronously register all partials from views/partials
const partialsDir = path.join(__dirname, "views/partials");
if (fs.existsSync(partialsDir)) {
  const files = fs.readdirSync(partialsDir);
  files
    .filter((file) => file.endsWith(".xian"))
    .forEach((file) => {
      const partialName = file.replace(".xian", "");
      const fullPath = path.join(partialsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      hbs.registerPartial(partialName, content);
    });
}

// Global flash & user middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  if (req.session && req.session.user) {
    res.locals.currentUser = req.session.user;
    res.locals.isAdmin = req.session.user.role === "admin";
    res.locals.isSupervisor = req.session.user.role === "supervisor" || req.session.user.role === "admin";
    res.locals.isGateOfficer = req.session.user.role === "gate_officer";
  }
  next();
});

// App Routes
app.use("/", router);

// Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).send(`
    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
      <h2 style="color: #dc2626;">System Error</h2>
      <p style="color: #4b5563;">An internal server error occurred while processing your request.</p>
      <pre style="background: #f3f4f6; padding: 15px; border-radius: 6px; text-align: left; max-width: 800px; margin: 20px auto; overflow-x: auto;">${err.message}</pre>
      <a href="/dashboard" style="display: inline-block; padding: 10px 20px; background: #1e3a8a; color: white; text-decoration: none; border-radius: 4px;">Return to Dashboard</a>
    </div>
  `);
});

export default app;

// Server Startup
export const startServer = async (port = PORT) => {
  try {
    // Ensure database is connected and initialized
    await seedDatabase(false);

    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(`🛡️ BJMP Custodial Gate System running at http://localhost:${port}`);
        resolve(server);
      });
      server.on("error", reject);
    });
  } catch (error) {
    console.error("Failed to start BJMP server:", error);
    process.exit(1);
  }
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun && !process.env.XIAN_ELECTRON) {
  startServer();
}
