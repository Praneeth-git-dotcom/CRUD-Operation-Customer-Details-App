const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const DB_PATH = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to DB', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Initialize tables if not exist
const initSql = `
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  address_details TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
`;

db.exec(initSql, (err) => {
  if (err) console.error('DB init error:', err);
});

// Helper: run SQL returning promise
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Routes
app.get('/api/health', (req, res) => res.json({ success: true, message: 'OK' }));

// Create customer (optionally with initial address)
app.post('/api/customers',
  // validations
  body('first_name').trim().notEmpty().withMessage('first_name required'),
  body('last_name').trim().notEmpty().withMessage('last_name required'),
  body('phone_number').trim().notEmpty().withMessage('phone_number required')
    .isLength({ min: 6, max: 20 }).withMessage('phone_number length invalid'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { first_name, last_name, phone_number, address } = req.body;
    try {
      const insertCustomerSql = `INSERT INTO customers (first_name, last_name, phone_number) VALUES (?,?,?)`;
      const result = await runAsync(insertCustomerSql, [first_name, last_name, phone_number]);
      const customerId = result.id;

      if (address && address.address_details) {
        const insertAddressSql = `INSERT INTO addresses (customer_id, address_details, city, state, pin_code) VALUES (?,?,?,?,?)`;
        await runAsync(insertAddressSql, [customerId, address.address_details, address.city || '', address.state || '', address.pin_code || '']);
      }

      const created = await getAsync(`SELECT * FROM customers WHERE id = ?`, [customerId]);
      res.status(201).json({ success: true, data: created, message: 'Customer created' });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ success: false, message: 'Phone number already exists' });
      }
      console.error(err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// GET /api/customers - list with pagination, search, filters, sort
app.get('/api/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const city = req.query.city || '';
    const state = req.query.state || '';
    const pin_code = req.query.pin_code || '';
    const sort = req.query.sort || 'id:asc';

    // Build where clauses
    const whereParts = [];
    const params = [];

    if (search) {
      whereParts.push(`(first_name || ' ' || last_name LIKE ? OR phone_number LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (city) {
      whereParts.push(`id IN (SELECT customer_id FROM addresses WHERE city = ?)`);
      params.push(city);
    }
    if (state) {
      whereParts.push(`id IN (SELECT customer_id FROM addresses WHERE state = ?)`);
      params.push(state);
    }
    if (pin_code) {
      whereParts.push(`id IN (SELECT customer_id FROM addresses WHERE pin_code = ?)`);
      params.push(pin_code);
    }

    const whereSql = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

    // sorting
    let [sortField, sortDir] = sort.split(':');
    const allowedFields = ['first_name','last_name','id','phone_number'];
    if (!allowedFields.includes(sortField)) sortField = 'id';
    sortDir = (sortDir && sortDir.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

    const totalSql = `SELECT COUNT(*) as count FROM customers ${whereSql}`;
    const totalRow = await getAsync(totalSql, params);
    const total = (totalRow && totalRow.count) ? totalRow.count : 0;

    const sql = `SELECT * FROM customers ${whereSql} ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`;
    const rows = await allAsync(sql, [...params, limit, offset]);

    res.json({ success: true, data: rows, meta: { page, limit, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET single customer with addresses
app.get('/api/customers/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const customer = await getAsync(`SELECT * FROM customers WHERE id = ?`, [id]);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const addresses = await allAsync(`SELECT * FROM addresses WHERE customer_id = ?`, [id]);
    res.json({ success: true, data: { ...customer, addresses } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/customers/:id
app.put('/api/customers/:id',
  body('first_name').optional().trim().notEmpty().withMessage('first_name cannot be empty'),
  body('last_name').optional().trim().notEmpty().withMessage('last_name cannot be empty'),
  body('phone_number').optional().trim().isLength({ min: 6, max: 20 }).withMessage('phone_number length invalid'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const id = req.params.id;
    const { first_name, last_name, phone_number } = req.body;
    try {
      const existing = await getAsync(`SELECT * FROM customers WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });

      const updates = [];
      const params = [];
      if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
      if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
      if (phone_number) { updates.push('phone_number = ?'); params.push(phone_number); }

      if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

      const sql = `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`;
      params.push(id);
      await runAsync(sql, params);
      const updated = await getAsync(`SELECT * FROM customers WHERE id = ?`, [id]);
      res.json({ success: true, data: updated, message: 'Customer updated' });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ success: false, message: 'Phone number already exists' });
      }
      console.error(err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const existing = await getAsync(`SELECT * FROM customers WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });
    await runAsync(`DELETE FROM customers WHERE id = ?`, [id]);
    // addresses will be removed due to foreign key ON DELETE CASCADE
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Address routes
app.post('/api/customers/:id/addresses',
  body('address_details').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('state').trim().notEmpty(),
  body('pin_code').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const customerId = req.params.id;
    const { address_details, city, state, pin_code } = req.body;
    try {
      const existing = await getAsync(`SELECT * FROM customers WHERE id = ?`, [customerId]);
      if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });

      const sql = `INSERT INTO addresses (customer_id, address_details, city, state, pin_code) VALUES (?,?,?,?,?)`;
      const result = await runAsync(sql, [customerId, address_details, city, state, pin_code]);
      const created = await getAsync(`SELECT * FROM addresses WHERE id = ?`, [result.id]);
      res.status(201).json({ success: true, data: created, message: 'Address added' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

app.get('/api/customers/:id/addresses', async (req, res) => {
  const customerId = req.params.id;
  try {
    const existing = await getAsync(`SELECT * FROM customers WHERE id = ?`, [customerId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found' });
    const rows = await allAsync(`SELECT * FROM addresses WHERE customer_id = ?`, [customerId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/addresses/:addressId',
  body('address_details').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('state').optional().trim().notEmpty(),
  body('pin_code').optional().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const addressId = req.params.addressId;
    const { address_details, city, state, pin_code } = req.body;
    try {
      const existing = await getAsync(`SELECT * FROM addresses WHERE id = ?`, [addressId]);
      if (!existing) return res.status(404).json({ success: false, message: 'Address not found' });

      const updates = [];
      const params = [];
      if (address_details) { updates.push('address_details = ?'); params.push(address_details); }
      if (city) { updates.push('city = ?'); params.push(city); }
      if (state) { updates.push('state = ?'); params.push(state); }
      if (pin_code) { updates.push('pin_code = ?'); params.push(pin_code); }

      if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

      const sql = `UPDATE addresses SET ${updates.join(', ')} WHERE id = ?`;
      params.push(addressId);
      await runAsync(sql, params);
      const updated = await getAsync(`SELECT * FROM addresses WHERE id = ?`, [addressId]);
      res.json({ success: true, data: updated, message: 'Address updated' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

app.delete('/api/addresses/:addressId', async (req, res) => {
  const addressId = req.params.addressId;
  try {
    const existing = await getAsync(`SELECT * FROM addresses WHERE id = ?`, [addressId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Address not found' });
    await runAsync(`DELETE FROM addresses WHERE id = ?`, [addressId]);
    res.json({ success: true, message: 'Address deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});