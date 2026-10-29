import { Op } from "sequelize";
import {
  Inmate,
  Cell,
  CellAssignment,
  User
} from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

// List Cells and Inmates
export const getCellManagement = async (req, res) => {
  try {
    const { search, block, status } = req.query;

    // 1. Cells with occupancy
    const cells = await Cell.findAll({
      include: [
        {
          model: Inmate,
          as: "inmates",
          where: { status: "Active" },
          required: false
        }
      ],
      order: [["cell_number", "ASC"]]
    });

    const cellsFormatted = cells.map(cell => {
      const inmateCount = cell.inmates ? cell.inmates.length : 0;
      const percentage = cell.capacity > 0 ? Math.round((inmateCount / cell.capacity) * 100) : 0;
      return {
        id: cell.id,
        cell_number: cell.cell_number,
        block: cell.block,
        capacity: cell.capacity,
        occupancy: inmateCount,
        percentage,
        isFull: inmateCount >= cell.capacity,
        status: cell.status,
        notes: cell.notes
      };
    });

    // 2. Inmates list
    const inmateWhere = {};
    if (status && status !== "ALL") {
      inmateWhere.status = status;
    } else {
      inmateWhere.status = "Active";
    }

    if (search && search.trim()) {
      const q = search.trim();
      inmateWhere[Op.or] = [
        { inmate_number: { [Op.like]: `%${q}%` } },
        { first_name: { [Op.like]: `%${q}%` } },
        { last_name: { [Op.like]: `%${q}%` } },
        { case_number: { [Op.like]: `%${q}%` } }
      ];
    }

    const inmateInclude = [
      {
        model: Cell,
        as: "cell",
        required: false,
        where: block && block !== "ALL" ? { block } : undefined
      }
    ];

    const inmates = await Inmate.findAll({
      where: inmateWhere,
      include: inmateInclude,
      order: [["last_name", "ASC"]]
    });

    // Distinct blocks for filter
    const uniqueBlocks = [...new Set(cells.map(c => c.block))];

    res.render("cell-management", {
      title: "Inmate Cell Assignment Monitoring",
      cells: cellsFormatted,
      inmates: inmates.map(i => i.toJSON()),
      uniqueBlocks,
      filters: {
        search: search || "",
        block: block || "ALL",
        status: status || "Active"
      }
    });
  } catch (error) {
    console.error("Cell management error:", error);
    req.flash("error_msg", "Error loading cell management: " + error.message);
    res.redirect("/dashboard");
  }
};

// Record Cell Transfer (Admin or Supervisor Only)
export const transferInmateCell = async (req, res) => {
  try {
    const { inmate_id, to_cell_id, transfer_reason, remarks } = req.body;

    if (!inmate_id || !to_cell_id || !transfer_reason || transfer_reason.trim().length === 0) {
      req.flash("error_msg", "Mandatory requirement: Target cell and authorized transfer reason are required.");
      return res.redirect("/cells");
    }

    const inmate = await Inmate.findByPk(inmate_id, {
      include: [{ model: Cell, as: "cell" }]
    });

    if (!inmate) {
      req.flash("error_msg", "Inmate record not found.");
      return res.redirect("/cells");
    }

    const targetCell = await Cell.findByPk(to_cell_id, {
      include: [
        {
          model: Inmate,
          as: "inmates",
          where: { status: "Active" },
          required: false
        }
      ]
    });

    if (!targetCell) {
      req.flash("error_msg", "Target cell does not exist.");
      return res.redirect("/cells");
    }

    // Check capacity
    const currentCount = targetCell.inmates ? targetCell.inmates.length : 0;
    if (currentCount >= targetCell.capacity) {
      req.flash("error_msg", `Cell Capacity Exceeded: ${targetCell.cell_number} is already at full capacity (${currentCount}/${targetCell.capacity}).`);
      return res.redirect("/cells");
    }

    if (inmate.cell_id === targetCell.id) {
      req.flash("error_msg", `Inmate is already assigned to ${targetCell.cell_number}.`);
      return res.redirect("/cells");
    }

    const fromCellId = inmate.cell_id;
    const oldCellName = inmate.cell ? inmate.cell.cell_number : "Unassigned";

    // 1. Close current active assignment in history
    await CellAssignment.update(
      {
        end_date: new Date().toISOString().split("T")[0],
        status: "Completed"
      },
      {
        where: {
          inmate_id: inmate.id,
          status: "Active"
        }
      }
    );

    // 2. Create new CellAssignment record
    await CellAssignment.create({
      inmate_id: inmate.id,
      from_cell_id: fromCellId,
      to_cell_id: targetCell.id,
      start_date: new Date().toISOString().split("T")[0],
      end_date: null,
      transfer_reason: transfer_reason.trim(),
      authorized_by_id: req.session.user.id,
      status: "Active",
      remarks: remarks ? remarks.trim() : null
    });

    // 3. Update Inmate's current cell
    inmate.cell_id = targetCell.id;
    await inmate.save();

    // 4. Update occupancy numbers on Cells
    if (fromCellId) {
      const countOld = await Inmate.count({ where: { cell_id: fromCellId, status: "Active" } });
      await Cell.update({ current_occupancy: countOld }, { where: { id: fromCellId } });
    }
    const countNew = await Inmate.count({ where: { cell_id: targetCell.id, status: "Active" } });
    await Cell.update({ current_occupancy: countNew }, { where: { id: targetCell.id } });

    // 5. Audit Log
    await logAudit({
      req,
      user: req.session.user,
      action: "CELL_TRANSFER",
      entity: "Inmate",
      entityId: inmate.inmate_number,
      details: `Custody Transfer authorized by ${req.session.user.name}: Transferred inmate ${inmate.last_name}, ${inmate.first_name} from ${oldCellName} to ${targetCell.cell_number}. Reason: "${transfer_reason.trim()}"`
    });

    req.flash("success_msg", `Inmate ${inmate.last_name} successfully transferred to ${targetCell.cell_number}.`);
    res.redirect("/cells");
  } catch (error) {
    console.error("Transfer inmate cell error:", error);
    req.flash("error_msg", "Failed to transfer inmate: " + error.message);
    res.redirect("/cells");
  }
};

// Inmate Assignment History (JSON endpoint for modal)
export const getInmateHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await CellAssignment.findAll({
      where: { inmate_id: id },
      include: [
        { model: Cell, as: "fromCell" },
        { model: Cell, as: "toCell" },
        { model: User, as: "authorizedBy" }
      ],
      order: [["created_at", "DESC"]]
    });

    res.json(history);
  } catch (error) {
    console.error("Get inmate history error:", error);
    res.status(500).json({ error: "Failed to retrieve assignment history" });
  }
};

