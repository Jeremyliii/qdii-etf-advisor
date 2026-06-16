const express = require('express');
const {
  getAShareSentiment,
  getAiAnalysis,
  getEconomicCalendar,
  getEarningsCalendar,
  getUsClose,
  getUsFutures,
  getUsHistory,
} = require('../services/dataProxy');
const {
  loadStoredPrediction,
  predictUSTonight,
  saveStoredPrediction,
  verifyUSPrediction,
} = require('../services/usPredictionEngine');

const router = express.Router();
const US_PREDICTION_TICKERS = ['NDX', 'SPY', 'SOXX', 'NVDA', 'AMD', 'TSM', 'VIX'];

async function buildUSPrediction({ persist = false } = {}) {
  const [historyPairs, calendar, earnings, aShareSentiment, futures, aiAnalysis] = await Promise.all([
    Promise.allSettled(US_PREDICTION_TICKERS.map(async (ticker) => [ticker, await getUsHistory(ticker, 180)])),
    getEconomicCalendar(2),
    getEarningsCalendar(2),
    getAShareSentiment(),
    getUsFutures(),
    getAiAnalysis(),
  ]);
  const historyMap = Object.fromEntries(
    historyPairs
      .filter((item) => item.status === 'fulfilled')
      .map((item) => item.value)
  );
  const prediction = predictUSTonight({
    usHistoryMap: historyMap,
    vixHistory: historyMap.VIX || [],
    calendar,
    earnings,
    aShareSentiment,
    futures,
    aiAnalysis,
  });
  if (persist) saveStoredPrediction(prediction);
  return prediction;
}

router.get('/us-prediction', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.refresh === '1';
    const now = new Date();
    const hour = now.getHours();
    const stored = loadStoredPrediction();
    if (!force && hour < 15 && stored) {
      return res.json({ prediction: stored, cached: true });
    }
    const prediction = await buildUSPrediction({ persist: true });
    res.json({ prediction, cached: false });
  } catch (error) {
    const stored = loadStoredPrediction();
    if (stored) return res.json({ prediction: stored, cached: true, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/tonight-events', async (req, res) => {
  try {
    const [calendar, earnings] = await Promise.all([
      getEconomicCalendar(2),
      getEarningsCalendar(2),
    ]);
    res.json({ calendar, earnings, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backtest-us-prediction', async (req, res) => {
  try {
    const days = Number(req.body?.days || 60);
    const tickers = ['NDX', 'SPY', 'SOXX', 'VIX'];
    const results = await Promise.allSettled(tickers.map(async (ticker) => [ticker, await getUsHistory(ticker, days + 90)]));
    const historyMap = Object.fromEntries(results.filter((item) => item.status === 'fulfilled').map((item) => item.value));
    const ndx = historyMap.NDX || [];
    let total = 0;
    let correct = 0;
    const rows = [];
    for (let i = 60; i < ndx.length - 1 && rows.length < days; i += 1) {
      const sliced = Object.fromEntries(Object.entries(historyMap).map(([ticker, list]) => [ticker, list.slice(0, i + 1)]));
      const prediction = predictUSTonight({ usHistoryMap: sliced, vixHistory: sliced.VIX || [] });
      const measuredPrediction = prediction.direction === 'uncertain'
        ? (prediction.score >= 50 ? 'up' : 'down')
        : prediction.direction;
      const measuredConfidence = prediction.direction === 'uncertain' ? 'low' : prediction.confidence;
      const nextChange = Number(ndx[i + 1].change_pct ?? ((ndx[i + 1].close - ndx[i].close) / ndx[i].close) * 100);
      const actual = nextChange > 0 ? 'up' : 'down';
      const hit = actual === measuredPrediction;
      total += 1;
      if (hit) correct += 1;
      rows.push({
        date: ndx[i + 1].date,
        prediction: measuredPrediction,
        originalDirection: prediction.direction,
        score: prediction.score,
        confidence: measuredConfidence,
        actual,
        actualChange: Math.round(nextChange * 100) / 100,
        hit,
      });
    }
    res.json({
      days,
      stats: {
        total,
        correct,
        accuracy: total ? Math.round((correct / total) * 1000) / 10 : 0,
      },
      rows: rows.reverse().slice(0, 30),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/us-prediction/verify', async (req, res) => {
  try {
    const usData = await getUsClose();
    res.json({ verification: verifyUSPrediction(loadStoredPrediction(), usData) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, buildUSPrediction };
