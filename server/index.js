const express = require('express');
const cors = require('cors');

const marketRoutes = require('./routes/market');
const decisionsRoutes = require('./routes/decisions');
const backtestRoutes = require('./routes/backtest');
const portfolioRoutes = require('./routes/portfolio');
const { router: usPredictionRoutes } = require('./routes/usPrediction');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api', marketRoutes);
app.use('/api', decisionsRoutes);
app.use('/api', backtestRoutes);
app.use('/api', usPredictionRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.get('/api/health', async (req, res) => {
  const dataService = process.env.DATA_SERVICE_URL || `http://127.0.0.1:${process.env.PORT === '3002' ? '5001' : '5000'}`;
  try {
    const response = await fetch(`${dataService}/api/health`);
    const sources = response.ok ? await response.json() : {};
    res.json({
      status: 'ok',
      service: 'qdii-advisor-server',
      dataService,
      ...sources,
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      service: 'qdii-advisor-server',
      dataService,
      deepseek_configured: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`QDII advisor server listening on http://localhost:${PORT}`);
});
