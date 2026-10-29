export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash("error_msg", "Please sign in to access the Custodial Gate Management System.");
    return res.redirect("/login");
  }

  // Inject current user into template locals
  res.locals.currentUser = req.session.user;
  res.locals.isAdmin = req.session.user.role === "admin";
  res.locals.isSupervisor = req.session.user.role === "supervisor" || req.session.user.role === "admin";
  res.locals.isGateOfficer = req.session.user.role === "gate_officer";

  next();
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash("error_msg", "Authentication required.");
      return res.redirect("/login");
    }

    const userRole = req.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      req.flash("error_msg", `Access Denied: Your account role (${userRole}) is not authorized for this operation.`);
      return res.redirect("/dashboard");
    }

    next();
  };
};

