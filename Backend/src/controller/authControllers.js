import { userModel } from "../models/userModel.js";
import apiResponse from "../utils/apiResponse.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const login = async (req, res, next) => {
  try {
     const { username, password } = req.body;
    
  if (!username || !password) {
    return res.status(400).json(apiResponse(false, "Username and password are required", [], req.rrn));
  }
   const user = await userModel.findByUsername(username);  // ✅ find by username
    if (!user) {
      return res
        .status(401)
        .json(apiResponse(false, "Invalid username or password", [], req.rrn));
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(200)
        .json(apiResponse(false, "Invalid username or password", [], req.rrn));
    }
    if (user.status === false || user.status === null) {
      return res
        .status(200)
        .json(apiResponse(false, "Your account has been disabled. Please contact admin.", [], req.rrn));
    }
    const token = jwt.sign(
      { id: user.user_id, role: user.role, email: user.email, category: user.category },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    return res.json(
      apiResponse(
        true,
        "Login successful",
        {
          adminId: user.user_id,
          name: user.name,
          username: user.username,
          display_name: user.display_name,
          email: user.email,
          token,
          role: user.role,
          category: user.category,
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
      name, email, contact, industry,
      entityName, website, year, pincode,
      address, state, district, category,
      password, username   // ✅ extract password from request body
    } = req.body;

          // validate username
    if (!username || username.trim().length < 3) {
      return res.json(apiResponse(false, "Username must be at least 3 characters", {}, req.rrn));
    }

    // Validate password
    if (!password || password.length < 8) {
      return res.json(
        apiResponse(false, "Password must be at least 8 characters", {}, req.rrn)
      );
    }

    // check username already taken
    const existingUsername = await userModel.findByUsername(username);
    if (existingUsername) {
      return res.json(apiResponse(false, "Username already taken", {}, req.rrn));
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.json(apiResponse(false, "Email already registered", {}, req.rrn));
    }

    await userModel.insertCustomer(
      name, email, contact, industry, entityName,
      website, year, pincode, address, state, district,
      category || "msme",
      password, username  // ✅ pass real password to model
    );

    return res.json(apiResponse(true, "Registration successful", {}, req.rrn));
  } catch (err) {
    next(err);
  }
};