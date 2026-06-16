const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_FILE = path.join(__dirname, '..', 'portfolio.json');

function readPortfolio() {
  if (!fs.existsSync(DB_FILE)) {
    return { cash: 100000, positions: [], transactions: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { cash: 100000, positions: [], transactions: [] };
  }
}

function writePortfolio(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

router.get('/', (req, res) => {
  res.json(readPortfolio());
});

router.put('/', (req, res) => {
  const next = {
    cash: Number(req.body.cash || 0),
    positions: Array.isArray(req.body.positions) ? req.body.positions : [],
    transactions: Array.isArray(req.body.transactions) ? req.body.transactions : []
  };
  writePortfolio(next);
  res.json(next);
});

router.post('/positions', (req, res) => {
  const data = readPortfolio();
  const position = {
    id: `${Date.now()}`,
    symbol: req.body.symbol,
    name: req.body.name,
    shares: Number(req.body.shares || 0),
    cost: Number(req.body.cost || 0),
    createdAt: new Date().toISOString()
  };
  data.positions.push(position);
  data.transactions.unshift({ ...position, type: 'add' });
  writePortfolio(data);
  res.status(201).json(data);
});

router.delete('/positions/:id', (req, res) => {
  const data = readPortfolio();
  data.positions = data.positions.filter((position) => position.id !== req.params.id);
  data.transactions.unshift({ id: req.params.id, type: 'remove', createdAt: new Date().toISOString() });
  writePortfolio(data);
  res.json(data);
});

module.exports = router;
