require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'cafe-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg|ico/;
    const extName = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowed.test(file.mimetype);
    if (extName && mimeType) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, WEBP, GIF, SVG, ICO) are allowed!'));
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(cors());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || (() => {
  console.warn('[WARN] SESSION_SECRET is not set in .env — using a random per-boot secret. Sessions will invalidate on every server restart.');
  return crypto.randomBytes(32).toString('hex');
})();

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname)));

// Authentication middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUser) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Get all public content
app.get('/api/content', (req, res) => {
  try {
    const data = db.getPublicContent();
    res.json(data);
  } catch (err) {
    console.error('API Error /api/content:', err);
    res.status(500).json({ error: 'Failed to load site content' });
  }
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map();
function loginLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;

  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  if (record.count >= maxAttempts) {
    const retryIn = Math.ceil((record.resetAt - now) / 1000);
    return res.status(429).json({ error: `Too many login attempts. Try again in ${retryIn} seconds.` });
  }

  record.count += 1;
  loginAttempts.set(ip, record);

  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (now > v.resetAt) loginAttempts.delete(k);
    }
  }

  next();
}

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.getAdminUser(username);
  const targetPassword = process.env.ADMIN_PASSWORD;

  let isValid = false;

  if (user) {
    isValid = bcrypt.compareSync(password, user.password_hash);
  }

  // Allow the .env ADMIN_PASSWORD to act as an initial/onboarding password only
  // (no hardcoded fallback is trusted).
  if (!isValid && targetPassword && password === targetPassword) {
    isValid = true;
  }

  if (isValid) {
    req.session.adminUser = { username: user ? user.username : username };
    return res.json({ success: true, username: req.session.adminUser.username });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.adminUser) {
    return res.json({ authenticated: true, username: req.session.adminUser.username });
  }
  return res.json({ authenticated: false });
});

// ==========================================
// PROTECTED ADMIN API ENDPOINTS
// ==========================================

// Get complete database state for Admin UI
app.get('/api/admin/all', requireAdmin, (req, res) => {
  res.json(db.getAllAdminData());
});

// Upload Image
app.post('/api/admin/upload-image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  const relativePath = 'uploads/' + req.file.filename;
  res.json({ success: true, url: relativePath });
});

// Update Settings Sections
app.put('/api/admin/site-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('site_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/hero-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('hero_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/about-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('about_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/location-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('location_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/contact-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('contact_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/social-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('social_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/seo-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('seo_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/animation-settings', requireAdmin, (req, res) => {
  const updated = db.updateSection('animation_settings', req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/admin/section-visibility', requireAdmin, (req, res) => {
  const updated = db.updateSection('section_visibility', req.body);
  res.json({ success: true, data: updated });
});

// Menu Category CRUD
app.post('/api/admin/menu/categories', requireAdmin, (req, res) => {
  const saved = db.saveCategory(req.body);
  res.json({ success: true, category: saved });
});

app.delete('/api/admin/menu/categories/:id', requireAdmin, (req, res) => {
  const ok = db.deleteCategory(req.params.id);
  if (ok) return res.json({ success: true });
  res.status(404).json({ error: 'Category not found' });
});

// Menu Item CRUD
app.post('/api/admin/menu/items', requireAdmin, (req, res) => {
  const saved = db.saveMenuItem(req.body);
  res.json({ success: true, item: saved });
});

app.delete('/api/admin/menu/items/:id', requireAdmin, (req, res) => {
  const ok = db.deleteMenuItem(req.params.id);
  if (ok) return res.json({ success: true });
  res.status(404).json({ error: 'Item not found' });
});

app.post('/api/admin/menu/items/reorder', requireAdmin, (req, res) => {
  const { category_key, ordered_ids } = req.body;
  if (!category_key || !Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: 'category_key and ordered_ids array required' });
  }
  db.reorderMenuItems(category_key, ordered_ids);
  res.json({ success: true });
});

// Gallery CRUD
app.post('/api/admin/gallery/items', requireAdmin, (req, res) => {
  const saved = db.saveGalleryItem(req.body);
  res.json({ success: true, item: saved });
});

app.delete('/api/admin/gallery/items/:id', requireAdmin, (req, res) => {
  const ok = db.deleteGalleryItem(req.params.id);
  if (ok) return res.json({ success: true });
  res.status(404).json({ error: 'Gallery item not found' });
});

app.post('/api/admin/gallery/items/reorder', requireAdmin, (req, res) => {
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: 'ordered_ids array required' });
  }
  db.reorderGalleryItems(ordered_ids);
  res.json({ success: true });
});

// Change Admin Password
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  const username = req.session.adminUser.username;
  const user = db.getAdminUser(username);
  const targetPassword = process.env.ADMIN_PASSWORD;

  let isValid = user ? bcrypt.compareSync(currentPassword, user.password_hash) : false;
  if (!isValid && targetPassword && currentPassword === targetPassword) {
    isValid = true;
  }

  if (!isValid) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.updateAdminPassword(username, newHash);
  res.json({ success: true, message: 'Password updated successfully' });
});

// Serve Admin SPA at /admin
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Catch-all route to serve public site
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(` Rustic Roast Cafe Server Running!`);
  console.log(` Public Website : http://localhost:${PORT}`);
  console.log(` Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`===================================================`);
});