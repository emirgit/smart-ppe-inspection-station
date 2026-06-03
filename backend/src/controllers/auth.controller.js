const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret, jwtExpiresIn, saltRounds } = require('../config/auth.config');

/**
 * Generates a signed JWT for the given admin.
 */
function generateToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

/**
 * Strips the password field from an admin record before sending it in a response.
 */
function formatAdmin(admin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    created_at: admin.createdAt,
    updated_at: admin.updatedAt,
  };
}

// ─── POST /api/auth/signup ──────────────────────────────
const signUp = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check email uniqueness
    const existing = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 409, message: 'Email is already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
      },
    });

    const token = generateToken(admin);

    res.status(201).json({
      success: true,
      data: {
        admin: formatAdmin(admin),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ───────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { code: 401, message: 'Invalid email or password' },
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 401, message: 'Invalid email or password' },
      });
    }

    const token = generateToken(admin);

    res.json({
      success: true,
      data: {
        admin: formatAdmin(admin),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/me ───────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Admin not found' },
      });
    }

    res.json({
      success: true,
      data: formatAdmin(admin),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { signUp, login, getMe };
