import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { User } from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

export const loginPage = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("login", {
    title: "BJMP Gate Officer - Secure Sign In",
    layout: false
  });
};

export const loginUser = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      req.flash("error_msg", "Please enter both username/email and password.");
      return res.redirect("/login");
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: usernameOrEmail.trim() },
          { email: usernameOrEmail.trim().toLowerCase() }
        ]
      }
    });

    if (!user) {
      await logAudit({
        req,
        action: "FAILED_LOGIN",
        entity: "User",
        entityId: usernameOrEmail,
        details: `Failed sign-in attempt for non-existent identifier: ${usernameOrEmail}`
      });
      req.flash("error_msg", "Invalid credentials or account does not exist.");
      return res.redirect("/login");
    }

    if (user.status !== "active") {
      await logAudit({
        req,
        user,
        action: "BLOCKED_LOGIN",
        entity: "User",
        entityId: user.id,
        details: `Deactivated user account attempted sign in: ${user.username}`
      });
      req.flash("error_msg", "This officer account has been deactivated. Contact facility administration.");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logAudit({
        req,
        user,
        action: "FAILED_PASSWORD",
        entity: "User",
        entityId: user.id,
        details: `Incorrect password entered for officer account: ${user.username}`
      });
      req.flash("error_msg", "Invalid username or password.");
      return res.redirect("/login");
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Set session user
    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      badge_number: user.badge_number
    };

    await logAudit({
      req,
      user,
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      details: `Gate/Custodial Officer ${user.name} (${user.badge_number || user.role}) signed in successfully.`
    });

    req.flash("success_msg", `Welcome back, ${user.name}!`);
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error_msg", "An unexpected error occurred during sign-in. Please try again.");
    res.redirect("/login");
  }
};

export const logoutUser = async (req, res) => {
  if (req.session && req.session.user) {
    await logAudit({
      req,
      user: req.session.user,
      action: "USER_LOGOUT",
      entity: "User",
      entityId: req.session.user.id,
      details: `Officer ${req.session.user.name} signed out of the system.`
    });
  }

  req.session.destroy(() => {
    res.redirect("/login");
  });
};

// User Management (Admin Only)
export const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      order: [["created_at", "DESC"]]
    });

    res.render("users", {
      title: "User Management - BJMP Custodial System",
      users: users.map(u => u.toJSON())
    });
  } catch (error) {
    console.error("List users error:", error);
    req.flash("error_msg", "Failed to retrieve user accounts.");
    res.redirect("/dashboard");
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, username, email, password, role, badge_number } = req.body;

    if (!name || !username || !email || !password || !role) {
      req.flash("error_msg", "All required fields must be filled.");
      return res.redirect("/users");
    }

    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { username: username.trim() },
          { email: email.trim().toLowerCase() }
        ]
      }
    });

    if (existing) {
      req.flash("error_msg", "A user account with this username or email already exists.");
      return res.redirect("/users");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name: name.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      badge_number: badge_number ? badge_number.trim() : null,
      status: "active"
    });

    await logAudit({
      req,
      user: req.session.user,
      action: "USER_CREATED",
      entity: "User",
      entityId: newUser.id,
      details: `Created new ${role} account for ${newUser.name} (${newUser.username}).`
    });

    req.flash("success_msg", `Officer account for ${name} successfully created.`);
    res.redirect("/users");
  } catch (error) {
    console.error("Create user error:", error);
    req.flash("error_msg", "Failed to create user account: " + error.message);
    res.redirect("/users");
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, badge_number } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      req.flash("error_msg", "Officer account not found.");
      return res.redirect("/users");
    }

    user.name = name.trim();
    user.email = email.trim().toLowerCase();
    user.role = role;
    user.badge_number = badge_number ? badge_number.trim() : null;
    await user.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "USER_UPDATED",
      entity: "User",
      entityId: user.id,
      details: `Updated details for ${user.username} (Role: ${user.role}, Badge: ${user.badge_number}).`
    });

    req.flash("success_msg", `Officer record for ${user.name} updated.`);
    res.redirect("/users");
  } catch (error) {
    console.error("Update user error:", error);
    req.flash("error_msg", "Failed to update officer record.");
    res.redirect("/users");
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      req.flash("error_msg", "User account not found.");
      return res.redirect("/users");
    }

    if (user.id === req.session.user.id) {
      req.flash("error_msg", "You cannot deactivate your own active session account.");
      return res.redirect("/users");
    }

    user.status = user.status === "active" ? "inactive" : "active";
    await user.save();

    await logAudit({
      req,
      user: req.session.user,
      action: user.status === "active" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entity: "User",
      entityId: user.id,
      details: `Officer account ${user.username} status set to ${user.status}.`
    });

    req.flash("success_msg", `Account for ${user.name} is now ${user.status}.`);
    res.redirect("/users");
  } catch (error) {
    console.error("Toggle user status error:", error);
    req.flash("error_msg", "Failed to modify account status.");
    res.redirect("/users");
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      req.flash("error_msg", "New password must be at least 6 characters.");
      return res.redirect("/users");
    }

    const user = await User.findByPk(id);
    if (!user) {
      req.flash("error_msg", "User account not found.");
      return res.redirect("/users");
    }

    user.password = await bcrypt.hash(new_password, 10);
    await user.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "USER_PASSWORD_RESET",
      entity: "User",
      entityId: user.id,
      details: `Administrative password reset performed for ${user.username}.`
    });

    req.flash("success_msg", `Password successfully reset for ${user.name}.`);
    res.redirect("/users");
  } catch (error) {
    console.error("Reset password error:", error);
    req.flash("error_msg", "Failed to reset password.");
    res.redirect("/users");
  }
};
