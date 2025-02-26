// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.AZURE_POSTGRESQL_USER,
  password: process.env.AZURE_POSTGRESQL_PASSWORD,
  host: process.env.AZURE_POSTGRESQL_HOST,
  port: process.env.AZURE_POSTGRESQL_PORT,
  database: process.env.AZURE_POSTGRESQL_DATABASE,
  ssl: process.env.AZURE_POSTGRESQL_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
  console.log('Database initialized');
}

initDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Get all todos
app.get('/api/todos', async (req, res) => {
  const result = await pool.query('SELECT * FROM todos ORDER BY created_at ASC');
  res.json(result.rows);
});

// Create a new todo
app.post('/api/todos', async (req, res) => {
  const { text } = req.body;
  
  const result = await pool.query(
    'INSERT INTO todos (text, completed) VALUES ($1, $2) RETURNING *',
    [text, false]
  );
  
  res.status(201).json(result.rows[0]);
});

// Clear completed todos
app.delete('/api/todos/completed', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM todos WHERE completed = true RETURNING *'
  );
  
  res.json(result.rows);
});

// Update a todo
app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body;
  
  let result;
  if (text !== undefined && completed !== undefined) {
    result = await pool.query(
      'UPDATE todos SET text = $1, completed = $2 WHERE id = $3 RETURNING *',
      [text, completed, id]
    );
  } else if (text !== undefined) {
    result = await pool.query(
      'UPDATE todos SET text = $1 WHERE id = $2 RETURNING *',
      [text, id]
    );
  } else if (completed !== undefined) {
    result = await pool.query(
      'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *',
      [completed, id]
    );
  }
  
  res.json(result.rows[0]);
});

// Toggle todo completion
app.patch('/api/todos/:id/toggle', async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'UPDATE todos SET completed = NOT completed WHERE id = $1 RETURNING *',
    [id]
  );
  
  res.json(result.rows[0]);
});

// Delete a todo
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM todos WHERE id = $1 RETURNING *',
    [id]
  );
  
  res.json(result.rows[0]);
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
