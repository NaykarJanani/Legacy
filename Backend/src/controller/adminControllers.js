import apiResponse from "../utils/apiResponse.js";
import { AdminModel } from '../models/adminModel.js'
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userModel } from "../models/userModel.js";
import { sessionQuestionModel } from "../models/sessionQuestionModel.js";
import pool from "../config/db/db_config.js";
import { userActivityModel } from "../models/userActivityModel.js";
import { getViewUrl } from "../aws/storageService.js";

export const getStudents = async (req, res, next) => {
  try {
    // const students = await StudentModel.getAllStudents();
    return res.json(apiResponse(true, "Students fetched", {}, req.rrn));
  } catch (err) {
    next(err);
  }
};


export const registerAdmin = async (req, res, next) => {
  try {

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json(apiResponse(false, "Name, email, and password are required", [], req.rrn));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingAdmin = await AdminModel.findByEmail(email);
    if (existingAdmin) {
      return res.status(409).json(apiResponse(false, "Admin with this email already exists", [], req.rrn));
    }

    await AdminModel.registerAdmin({ name, email, password: hashedPassword });

    return res.json(apiResponse(true, "Admin Registered", [], req.rrn));

  } catch (err) {
    next(err);
  }
}

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json(apiResponse(false, "Email and password are required", [], req.rrn));
    }

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res
        .status(200)
        .json(apiResponse(false, "Invalid email or password", [], req.rrn));
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(200)
        .json(apiResponse(false, "Invalid email or password", [], req.rrn));
    }

    // ✅ Generate JWT token
   const token = jwt.sign(
  {
    id: admin.admin_id,
    role: admin.role,
    email: admin.email
  },
  process.env.JWT_SECRET,
  {
    expiresIn: process.env.JWT_EXPIRES_IN
  }
);

    // ✅ Send response with token
    return res.json(
      apiResponse(
        true,
        "Login successful",
        {
          adminId: admin.admin_id,
          name: admin.name,
          email: admin.email,
          token, // attach token
          role: 'admin'
        },
        req.rrn
      )
    );
  } catch (err) {
    next(err);
  }
};


export const registerCustomer = async (req, res, next) => {
  try {

    const {
      name,
      email,
      contact,
      industry,
      entityName,
      website,
      year,
      pincode,
      address,
      state,
      district,
      category,
      username,
      password
    } = req.body;

    // validate username
    if (!username || username.trim().length < 3) {
      return res.json(apiResponse(false, "Username must be at least 3 characters", {}, req.rrn));
    }

    // validate password
    if (!password || password.length < 8) {
      return res.json(apiResponse(false, "Password must be at least 8 characters", {}, req.rrn));
    }

    const checkEmail = await userModel.findByEmail(email);

    if (checkEmail) {
      return res.json(apiResponse(
        false,
        "Email Already there",
        {},
        req.rrn
      ));
    }

    // check username already taken
    const existingUsername = await userModel.findByUsername(username);
    if (existingUsername) {
      return res.json(apiResponse(false, "Username already taken", {}, req.rrn));
    }

    await userModel.insertCustomer(
      name, email, contact, industry, entityName,
      website, year, pincode, address, state, district,
      category || "msme",
      password, username
    );

    return res.json(apiResponse(
      true,
      "Customer Register",
      {},
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}

export const customerList = async (req, res, next) => {

  try {

    // GET CATEGORY FROM FRONTEND
    const { category } = req.query;

    // PASS CATEGORY TO MODEL
    const data = await userModel.getUsers('customer', category);

    return res.json(apiResponse(
      true,
      "Customer List",
      data,
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}

export const editorList = async (req, res, next) => {

  try {

    const data = await userModel.getUsers('editor');

    return res.json(apiResponse(
      true,
      "Customer List",
      data,
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
}



export const createEditor = async (req, res, next) => {
  try {

    const {
      name,
      email,
      phone,
      address,
      category,
      username,
      password
    } = req.body;

    const allowedCategories = ["msme", "school", "temple", "village"];

    // OPTIONAL VALIDATION (safe now)
    if (category && !allowedCategories.includes(category)) {
      return res.json(apiResponse(
        false,
        "Invalid category",
        {},
        req.rrn
      ));
    }

    // validate username
    if (!username || username.trim().length < 3) {
      return res.json(apiResponse(false, "Username must be at least 3 characters", {}, req.rrn));
    }

    // validate password
    if (!password || password.length < 8) {
      return res.json(apiResponse(false, "Password must be at least 8 characters", {}, req.rrn));
    }

    const checkEmail = await userModel.findByEmail(email);

    if (checkEmail) {
      return res.json(apiResponse(
        false,
        "Email Already there",
        {},
        req.rrn
      ));
    }

    // check username already taken
    const existingUsername = await userModel.findByUsername(username);
    if (existingUsername) {
      return res.json(apiResponse(false, "Username already taken", {}, req.rrn));
    }

    await userModel.insertEditor(
      name,
      email,
      phone,
      address,
      category || "msme",  // default safe value
      username,
      password
    );

    return res.json(apiResponse(
      true,
      "Editor Created",
      {},
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}


export const addSession = async (req, res, next) => {
  try {

    const data = req.body;

    await sessionQuestionModel.addSession(data);


    return res.json(apiResponse(
      true,
      "Session Added",
      {},
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}

export const getSession = async (req, res, next) => {
  try {

    const data = await sessionQuestionModel.getAllSession();

    return res.json(apiResponse(
      true,
      "Session Added",
      data,
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}


export const updateSession = async (req, res, next) => {
  try {

    const data = req.body;

    await sessionQuestionModel.updateSession(data.sessionId, data);

    return res.json(apiResponse(
      true,
      "Session Updated",
      {},
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}

export const updateSessionSeq = async (req, res, next) => {
  try {

    const {session_id,newNumber} = req.body;

    if(!session_id || !newNumber){
      throw new Error("Something is Missing")
    }

    await sessionQuestionModel.updateSeqSession(session_id,newNumber);
     return res.json(apiResponse(
      true,
      "Seq Updated",
      {},
      req.rrn
    ));

  } catch (err) {
    next(err);
  }
}
export const getUserGallery = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      "SELECT * FROM user_gallery WHERE user_id = $1",
      [user_id]
    );

    return res.json(apiResponse(
      true,
      "Gallery fetched",
      result.rows,
      req.rrn
    ));
  } catch (err) {
    next(err);
  }
};
export const getProfile = async (req, res, next) => {

  try {

    const result = await pool.query(
      `
      SELECT
        admin_id,
        name,
        email,
        role,
        phone
      FROM admin
      WHERE admin_id = $1
      `,
      [req.user.id]
    );

    return res.json(
      apiResponse(
        true,
        "Profile fetched",
        result.rows[0],
        req.rrn
      )
    );

  } catch (err) {

    next(err);

  }

};

export const updateProfile = async (req, res, next) => {

  try {

    const {
      name,
      email,
      phone,
      password
    } = req.body;

    let hashedPassword = null;

    // HASH PASSWORD ONLY IF PROVIDED
    if (password && password.trim() !== "") {

      hashedPassword = await bcrypt.hash(password, 10);

    }

    // UPDATE WITH PASSWORD
    if (hashedPassword) {

      await pool.query(
        `
        UPDATE admin
        SET
          name = $1,
          email = $2,
          phone = $3,
          password = $4,
          updated_at = NOW()
        WHERE admin_id = $5
        `,
        [
          name,
          email,
          phone,
          hashedPassword,
          req.user.id
        ]
      );

    } else {

      // UPDATE WITHOUT PASSWORD
      await pool.query(
        `
        UPDATE admin
        SET
          name = $1,
          email = $2,
          phone = $3,
          updated_at = NOW()
        WHERE admin_id = $4
        `,
        [
          name,
          email,
          phone,
          req.user.id
        ]
      );

    }

    return res.json(
      apiResponse(
        true,
        "Profile Updated Successfully",
        {},
        req.rrn
      )
    );

  } catch (err) {

    next(err);

  }

};

export const getDailyActivity = async (req, res, next) => {

    try {

        const { date } = req.query;

        const data =
            await userActivityModel.getDailyActivity(date);

        return res.json(
            apiResponse(
                true,
                "Daily activity fetched",
                data,
                req.rrn
            )
        );

    } catch (err) {
        next(err);
    }

};
export const updateSessionStatus = async (req, res, next) => {

  try {

    const { session_id, status } = req.body;

    await pool.query(
      `
      UPDATE session
      SET status = $1
      WHERE session_id = $2
      `,
      [status, session_id]
    );

    return res.json(
      apiResponse(
        true,
        "Status Updated",
        {},
        req.rrn
      )
    );

  } catch (err) {

    next(err);

  }

};
export const getDashboardStats = async (req, res, next) => {
  try {

    const [
      users,
      admins,
      sessions,
      subSessions,
      questions,
      aiRequests,
      activities,
      galleries,
      publishedBooks,
      pendingApprovals
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'customer'"),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'editor'"),
      pool.query("SELECT COUNT(*) FROM session"),
      pool.query("SELECT COUNT(*) FROM sub_session"),
      pool.query("SELECT COUNT(*) FROM question"),
      pool.query("SELECT COUNT(*) FROM ai_req_res"),
      pool.query("SELECT COUNT(*) FROM user_activity"),
      pool.query("SELECT COUNT(*) FROM user_gallery"),
      // A book is "published" once the admin has marked it so — this is the
      // same published_at column markFlipbookPublishRequestPublished sets.
      pool.query("SELECT COUNT(*) FROM approved_flipbooks WHERE published_at IS NOT NULL"),
      // Requests still awaiting the admin's "publish" action.
      pool.query("SELECT COUNT(*) FROM flipbook_publish_requests WHERE status = 'pending'")
    ]);

    return res.json(
      apiResponse(
        true,
        "Dashboard Stats",
        {
          totalUsers: Number(users.rows[0].count),
          totalAdmins: Number(admins.rows[0].count),
          totalSessions: Number(sessions.rows[0].count),
          totalSubSessions: Number(subSessions.rows[0].count),
          totalQuestions: Number(questions.rows[0].count),
          totalAIRequests: Number(aiRequests.rows[0].count),
          totalActivities: Number(activities.rows[0].count),
          totalGalleryUploads: Number(galleries.rows[0].count),
          publishedBooks: Number(publishedBooks.rows[0].count),
          pendingApprovals: Number(pendingApprovals.rows[0].count)
        },
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};
export const getCustomerQA = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `
      SELECT 
          ss.sub_session_id,
          ss.title AS sub_session_title,
          q.question_id,
          q.question,
          COALESCE(ca.answer, 'Pending') AS answer
      FROM users u
      INNER JOIN session s 
          ON s.category = u.category
      INNER JOIN sub_session ss 
          ON ss.session_id = s.session_id
      INNER JOIN question q 
          ON q.sub_session_id = ss.sub_session_id
      LEFT JOIN customer_answer ca 
          ON ca.question_id = q.question_id
          AND ca.sub_session_id = ss.sub_session_id
          AND ca.session_id = s.session_id
          AND ca.user_id = u.user_id
      WHERE u.user_id = $1
      ORDER BY ss.seq, q.question_id
      `,
      [user_id]
    );

    return res.json(
      apiResponse(true, "Customer Q/A fetched", result.rows, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// In adminController.js
export const getSessionByUserId = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      `SELECT session_id FROM customer_answer 
       WHERE user_id = $1 
       LIMIT 1`,
      [user_id]
    );
    return res.json(apiResponse(true, "Session fetched", result.rows[0] || {}, req.rrn));
  } catch (err) {
    next(err);
  }
};

export const updateEditorStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof status !== "boolean") {
      return res.status(400).json(apiResponse(false, "Invalid status value", {}, req.rrn));
    }

    const result = await pool.query(
      `UPDATE users SET status = $1 WHERE user_id = $2 AND role = 'editor' RETURNING user_id`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(apiResponse(false, "Editor not found", {}, req.rrn));
    }

    return res.json(apiResponse(true, "Status updated successfully", {}, req.rrn));

  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW CONTROLLERS — added for missing admin routes (task 14)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET CUSTOMER PROFILE ───────────────────────────────────────────────────
// GET /api/admin/customer/:user_id/profile
// Returns full profile row for one customer — used in the CRM detail view
// and at the top of the editor's review panel.

export const getCustomerProfile = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT
         user_id,
         name,
         email,
         mobile,
         category,
         industry,
         "entityname" AS entity_name,
         website,
         year,
         pincode,
         address,
         state,
         district,
         status,
         created_at,
         updated_at
       FROM users
       WHERE user_id = $1
         AND role = 'customer'`,
      [user_id]
    );

    if (!result.rows[0]) {
      return res.status(404).json(
        apiResponse(false, "Customer not found", {}, req.rrn)
      );
    }

    return res.json(
      apiResponse(true, "Customer profile fetched", result.rows[0], req.rrn)
    );

  } catch (err) {
    next(err);
  }
};

// ─── UPDATE CUSTOMER STATUS ─────────────────────────────────────────────────
// PUT /api/admin/customer/:user_id/status
// Body: { status: true | false }
// Enables or disables a customer account.
// The authenticate middleware already checks status on every request,
// so disabling here immediately blocks that customer from logging in.

export const updateCustomerStatus = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { status }  = req.body;

    if (typeof status !== "boolean") {
      return res.status(400).json(
        apiResponse(false, "status must be a boolean (true or false)", {}, req.rrn)
      );
    }

    const result = await pool.query(
      `UPDATE users
       SET    status     = $1,
              updated_at = NOW()
       WHERE  user_id    = $2
         AND  role       = 'customer'
       RETURNING user_id, name, email, status`,
      [status, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(
        apiResponse(false, "Customer not found", {}, req.rrn)
      );
    }

    return res.json(
      apiResponse(
        true,
        `Customer account ${status ? "enabled" : "disabled"} successfully`,
        result.rows[0],
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};

// ─── GET CUSTOMER'S CURRENT EDITOR ASSIGNMENT ──────────────────────────────
// GET /api/admin/customer/:user_id/editor
// Returns the editor currently assigned to this customer, or null if none.
// Used by the admin UI to warn before reassigning a customer who already
// has an editor, since a customer should only ever have one at a time.

export const getCustomerEditor = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT
         u.user_id AS editor_id,
         u.name,
         u.email,
         ec.assigned_at
       FROM editor_customer ec
       JOIN users u
         ON u.user_id = ec.editor_id
       WHERE ec.user_id = $1
       ORDER BY ec.assigned_at DESC
       LIMIT 1`,
      [user_id]
    );

    return res.json(
      apiResponse(
        true,
        result.rows[0] ? "Customer already has an assigned editor" : "No editor assigned yet",
        result.rows[0] ?? null,
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};

// ─── ASSIGN EDITOR TO CUSTOMER ─────────────────────────────────────────────
// POST /api/admin/editor/assign
// Body: { editor_id, user_id }
// Creates a row in editor_assignments linking an editor to a customer.
// The editor can then see this customer in their review queue.
//
// NOTE: editor_assignments table must exist. Run npm run create-database
// after adding src/config/db/schemas/editor_assignments.json (see below).

export const assignEditorToCustomer = async (req, res, next) => {
  try {
    const { editor_id, user_id } = req.body;

    if (!editor_id || !user_id) {
      return res.status(400).json(
        apiResponse(false, "editor_id and user_id are required", {}, req.rrn)
      );
    }

    // Verify editor exists and has editor role
    const editorCheck = await pool.query(
      `SELECT user_id, name, category
       FROM users
       WHERE user_id = $1 AND role = 'editor' AND status = TRUE`,
      [editor_id]
    );

    if (!editorCheck.rows[0]) {
      return res.status(404).json(
        apiResponse(false, "Editor not found or inactive", {}, req.rrn)
      );
    }

    // Verify customer exists
    const customerCheck = await pool.query(
      `SELECT user_id, name, category
       FROM users
       WHERE user_id = $1 AND role = 'customer'`,
      [user_id]
    );

    if (!customerCheck.rows[0]) {
      return res.status(404).json(
        apiResponse(false, "Customer not found", {}, req.rrn)
      );
    }

    // A customer can only ever have ONE editor at a time. Previously this
    // was a plain INSERT ... ON CONFLICT (editor_id, user_id) DO NOTHING,
    // which only blocked re-assigning the *same* editor twice — assigning a
    // *different* editor to a customer who already had one just added a
    // second row, leaving the customer with multiple editors. Replace any
    // existing assignment(s) for this user_id before inserting the new one.
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");

      await client.query(
        `DELETE FROM editor_customer WHERE user_id = $1`,
        [user_id]
      );

      result = await client.query(
        `INSERT INTO editor_customer (editor_id, user_id)
         VALUES ($1, $2)
         RETURNING *`,
        [editor_id, user_id]
      );

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    return res.status(201).json(
      apiResponse(
        true,
        `${editorCheck.rows[0].name} assigned to ${customerCheck.rows[0].name}`,
        result.rows[0],
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};

// ─── GET CUSTOMERS ASSIGNED TO AN EDITOR ───────────────────────────────────
// GET /api/admin/editor/:editor_id/customers
// Returns all customers currently assigned to one editor,
// with their answer completion stats for the admin overview.

export const getEditorCustomers = async (req, res, next) => {
  try {
    const { editor_id } = req.params;

    const editorCheck = await pool.query(
      `SELECT user_id, name, email, category
       FROM users
       WHERE user_id = $1 AND role = 'editor'`,
      [editor_id]
    );

    if (!editorCheck.rows[0]) {
      return res.status(404).json(
        apiResponse(false, "Editor not found", {}, req.rrn)
      );
    }

    const result = await pool.query(
      `SELECT
         u.user_id,
         u.name,
         u.email,
         u.mobile,
         u.category,
         u.industry,
         u."entityname"   AS entity_name,
         u.status         AS account_status,
         ea.assigned_at
       FROM editor_customer ea
       JOIN users u
         ON u.user_id = ea.user_id
       WHERE ea.editor_id = $1
       ORDER BY ea.assigned_at DESC`,
      [editor_id]
    );

    return res.json(
      apiResponse(
        true,
        "Editor's assigned customers fetched",
        {
          editor:    editorCheck.rows[0],
          customers: result.rows,
        },
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};

// ─── GET ALL FLIPBOOK PUBLISH REQUESTS (ADMIN OVERSIGHT) ───────────────────
// GET /api/admin/flipbook-publish-requests
// Returns every "customer wants to publish" request across ALL editors, not
// just the one it's assigned to. This is the backstop for when an individual
// editor misses or forgets a request — the admin can see it's gone stale and
// step in (nudge the editor, reassign, etc). Ordered oldest-first so the
// most overdue requests surface at the top.

export const getFlipbookPublishRequestsAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         fpr.id,
         fpr.user_id,
         fpr.editor_id,
         fpr.status,
         fpr.created_at,
         fpr.updated_at,
         c.name  AS customer_name,
         c.email AS customer_email,
         e.name  AS editor_name,
         e.email AS editor_email
       FROM flipbook_publish_requests fpr
       JOIN users c ON c.user_id = fpr.user_id
       LEFT JOIN users e ON e.user_id = fpr.editor_id AND e.role = 'editor'
       WHERE fpr.status IN ('pending', 'acknowledged')
       ORDER BY fpr.created_at ASC`
    );

    return res.json(
      apiResponse(true, "Publish requests fetched", result.rows, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─── MARK A PUBLISH REQUEST AS PUBLISHED (ADMIN) ───────────────────────────
// PATCH /api/admin/flipbook-publish-requests/:id/publish
// Admin-side confirmation that a customer's book has actually been
// published — the terminal state. Unlike the editor's "acknowledge" (which
// only means "I've seen this"), this permanently resolves the request and
// removes it from both the admin oversight list and the editor's own queue.

export const markFlipbookPublishRequestPublished = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const reqResult = await client.query(
      `UPDATE flipbook_publish_requests
       SET status = 'published', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!reqResult.rows[0]) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json(apiResponse(false, "Request not found", {}, req.rrn));
    }

    const { user_id } = reqResult.rows[0];

    // This is the actual signal the rest of the app reads (deriveProjectStatus,
    // editor Projects tab, etc.) — without this, the request itself flips to
    // 'published' but the book's real status never moves off "Ready To Publish".
    const bookResult = await client.query(
      `UPDATE approved_flipbooks
       SET published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [user_id]
    );

    await client.query("COMMIT");

    return res.json(
      apiResponse(
        true,
        "Marked as published",
        { request: reqResult.rows[0], flipbook: bookResult.rows[0] || null },
        req.rrn
      )
    );
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ─── GET ALL PUBLISHED FLIPBOOKS (ADMIN) ───────────────────────────────────
// GET /api/admin/flipbooks
// Returns every editor-approved flipbook across all customers, with a ready
// -to-view PDF url for each, for the Publishing Flipbooks admin screen.

export const getAllFlipbooksAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         af.id,
         af.user_id,
         af.pdf_key,
         af.storage_type,
         af.pdf_file_name,
         af.title,
         af.total_pages,
         af.status,
         af.updated_by_editor_id,
         af.created_at,
         af.updated_at,
         u.name  AS customer_name,
         u.email AS customer_email,
         e.name  AS editor_name
       FROM approved_flipbooks af
       JOIN users u ON u.user_id = af.user_id
       LEFT JOIN users e ON e.user_id = af.updated_by_editor_id AND e.role = 'editor'
       ORDER BY af.updated_at DESC`
    );

    const flipbooks = await Promise.all(
      result.rows.map(async (row) => {
        let pdf_url = null;
        try {
          pdf_url =
            row.storage_type === "local"
              ? `${req.protocol}://${req.get("host")}${row.pdf_key}`
              : await getViewUrl(row.pdf_key);
        } catch (urlErr) {
          console.error(`Failed to resolve flipbook URL for id ${row.id}:`, urlErr.message);
        }
        return { ...row, pdf_url };
      })
    );

    return res.json(
      apiResponse(true, "Flipbooks fetched", flipbooks, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/editor/assign
// Body: { editor_id, user_id }
// Marks the assignment as inactive rather than hard-deleting,
// preserving the audit trail of who reviewed which biography.

export const unassignEditorFromCustomer = async (req, res, next) => {
  try {
    const { editor_id, user_id } = req.body;

    if (!editor_id || !user_id) {
      return res.status(400).json(
        apiResponse(false, "editor_id and user_id are required", {}, req.rrn)
      );
    }

    const result = await pool.query(
      `DELETE FROM editor_customer
       WHERE editor_id = $1 AND user_id = $2
       RETURNING *`,
      [editor_id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(
        apiResponse(false, "Assignment not found", {}, req.rrn)
      );
    }

    return res.json(
      apiResponse(true, "Editor unassigned successfully", result.rows[0], req.rrn)
    );

  } catch (err) {
    next(err);
  }
};

// ─── GET SINGLE SESSION BY ID ───────────────────────────────────────────────
// GET /api/admin/session/:session_id
// Returns one fully-nested session with all its chapters,
// sub-sessions, and questions. Used by the admin session editor
// and by the user-side chapter detail view.

export const getSessionById = async (req, res, next) => {
  try {
    const { session_id } = req.params;

    // Session row
    const sessionRes = await pool.query(
      `SELECT * FROM session WHERE session_id = $1`,
      [session_id]
    );

    if (!sessionRes.rows[0]) {
      return res.status(404).json(
        apiResponse(false, "Session not found", {}, req.rrn)
      );
    }

    const session = sessionRes.rows[0];

    // All sub_sessions for this session
    const subSessionRes = await pool.query(
      `SELECT * FROM sub_session
       WHERE session_id = $1 AND status = TRUE
       ORDER BY seq, sub_session_id`,
      [session_id]
    );

    const subSessions = subSessionRes.rows;

    // All questions for those sub_sessions
    let questions = [];
    if (subSessions.length) {
      const subIds = subSessions.map(ss => ss.sub_session_id);
      const questionRes = await pool.query(
        `SELECT * FROM question
         WHERE sub_session_id = ANY($1) AND status = TRUE
         ORDER BY sub_session_id, question_id`,
        [subIds]
      );
      questions = questionRes.rows;
    }

    // Index questions by sub_session_id
    const questionsBySubSession = {};
    for (const q of questions) {
      if (!questionsBySubSession[q.sub_session_id]) {
        questionsBySubSession[q.sub_session_id] = [];
      }
      questionsBySubSession[q.sub_session_id].push(q);
    }

    // Group sub_sessions under chapter titles
    // Sub-session titles are stored as "Chapter → SubChapter"
    const chaptersMap = new Map();
    for (const ss of subSessions) {
      const [chapterTitle = ss.title, subChapterTitle = ""] =
        ss.title.split(" → ");

      if (!chaptersMap.has(chapterTitle)) {
        chaptersMap.set(chapterTitle, []);
      }

      chaptersMap.get(chapterTitle).push({
        sub_session_id:   ss.sub_session_id,
        title:            subChapterTitle,
        full_title:       ss.title,
        seq:              ss.seq,
        status:           ss.status,
        questions:        questionsBySubSession[ss.sub_session_id] ?? [],
      });
    }

    const mainPoints = [];
    for (const [chapterTitle, subs] of chaptersMap) {
      mainPoints.push({ title: chapterTitle, subChapters: subs });
    }

    return res.json(
      apiResponse(
        true,
        "Session fetched",
        {
          session_id:  session.session_id,
          title:       session.title,
          category:    session.category,
          status:      session.status,
          seq:         session.seq ?? 0,
          created_at:  session.created_at,
          updated_at:  session.updated_at,
          mainPoints,
        },
        req.rrn
      )
    );

  } catch (err) {
    next(err);
  }
};