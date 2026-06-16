const express = require('express');
const { QDII_ETF_POOL } = require('../services/etfPool');
const { DEFAULT_CONFIG, generateDecisions } = require('../services/decisionEngine');
const { runPredictionBacktest } = require('../services/backtestEngine');
const { labelConfidence } = require('../services/scoringModel');
const { getAShareSentiment, getAiAnalysis, getEtfKlineBatch, getEtfQuotes, getUsClose, getUsHistory } = require('../services/dataProxy');
const { loadStoredPrediction, verifyUSPrediction } = require('../services/usPredictionEngine');

const router = express.Router();
const accuracyCache = { time: 0, value: {} };

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function estimateRange(item) {
  if (!item.linkedDataAvailable) return null;
  const linked = Number(item.linkedChange || 0);
  const passive = !item.type || item.type === 'ETF';
  const lowFactor = passive ? 0.6 : 0.4;
  const highFactor = passive ? 0.9 : 0.7;
  if (!Number.isFinite(linked)) return null;
  const values = [linked * lowFactor, linked * highFactor].sort((a, b) => a - b);
  return values.map((value) => round(value));
}

function uniqueHistoryTickers() {
  return [...new Set([
    'NDX',
    'VIX',
    ...QDII_ETF_POOL.flatMap((item) => item.linkedTickers || [])
  ])];
}

async function buildSectorAccuracy(etfKlineMap) {
  if (Date.now() - accuracyCache.time < 30 * 60_000) return accuracyCache.value;

  const historyDays = 160;
  const tickers = uniqueHistoryTickers();
  const historyResults = await Promise.allSettled(
    tickers.map(async (ticker) => [ticker, await getUsHistory(ticker, historyDays)])
  );
  const usHistoryMap = Object.fromEntries(
    historyResults
      .filter((item) => item.status === 'fulfilled')
      .map((item) => item.value)
  );
  const backtest = runPredictionBacktest(etfKlineMap, usHistoryMap, {
    days: 60,
    etfPool: QDII_ETF_POOL,
    aShareSentiment: etfKlineMap['510300'] || []
  });
  const value = Object.fromEntries(
    (backtest.stats.bySector || []).map((item) => [item.sector, {
      accuracy: item.accuracy,
      total: item.total,
      correct: item.correct,
      reliable: item.accuracy >= 55
    }])
  );
  accuracyCache.time = Date.now();
  accuracyCache.value = value;
  return value;
}

function generateTomorrowPrediction(decisions, sectorAccuracyMap = {}) {
  const predictions = decisions.map((item) => {
    const sectorAccuracy = sectorAccuracyMap[item.sector] || null;
    const prediction = item.direction || 'neutral';
    const directionScore = Number(item.directionScore || 50);
    const confidence = directionScore >= 65 || directionScore <= 35
      ? 'high'
      : directionScore >= 55 || directionScore <= 45
        ? 'medium'
        : 'low';
    const reasons = [...(item.reasons || [])];
    const confidenceInfo = labelConfidence({
      score: directionScore,
      sectorAccuracy: Number(sectorAccuracy?.accuracy || 0),
      linkedChange: item.linkedChange,
      techConfirmed: true
    });
    const confidenceLabels = [...confidenceInfo.labels];
    if (confidence === 'low') confidenceLabels.unshift('⚠️ 方向低置信度', '只看作方向参考，不等于操作建议');
    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      tracking: item.tracking,
      score: directionScore,
      directionScore,
      opportunityScore: item.opportunityScore,
      action: item.action,
      actionLabel: item.actionLabel,
      prediction,
      confidence,
      confidenceLabels: [...new Set(confidenceLabels)],
      estimatedRange: prediction === 'neutral' ? null : estimateRange(item),
      estimatedRangeAvailable: prediction !== 'neutral' && Boolean(item.linkedDataAvailable),
      historicalAccuracy: sectorAccuracy,
      reasons: [...new Set([...(item.directionReasons || []), ...reasons])].slice(0, 4),
      linkedChange: item.linkedChange,
      linkedDataAvailable: item.linkedDataAvailable,
      linkedCoverage: item.linkedCoverage,
      estimatedPremium: item.estimatedPremium,
      premiumAvailable: item.premiumAvailable,
      premiumSource: item.premiumSource,
      navBasis: item.navBasis,
      navTime: item.navTime
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    target: 'next_cn_trading_day',
    ups: predictions.filter((item) => item.prediction === 'up').sort((a, b) => b.score - a.score),
    downs: predictions.filter((item) => item.prediction === 'down').sort((a, b) => a.score - b.score),
    neutrals: predictions.filter((item) => item.prediction === 'neutral').sort((a, b) => b.score - a.score)
  };
}

async function buildDecisionPayload(query = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    buyThreshold: Number(query.buyThreshold || DEFAULT_CONFIG.buyThreshold),
    sellThreshold: Number(query.sellThreshold || DEFAULT_CONFIG.sellThreshold),
    etfPool: QDII_ETF_POOL
  };
  const symbols = QDII_ETF_POOL.map((item) => item.symbol);
  const klineSymbols = [...symbols, '510300'];
  const [usData, aiAnalysis, etfQuotes, etfKlineMap, aShareSentiment] = await Promise.all([
    getUsClose(),
    getAiAnalysis(),
    getEtfQuotes(symbols),
    getEtfKlineBatch(klineSymbols, 160),
    getAShareSentiment()
  ]);
  const usPredictionVerification = verifyUSPrediction(loadStoredPrediction(), usData);
  const decisions = generateDecisions(usData, aiAnalysis, etfQuotes, etfKlineMap, {
    ...config,
    aShareSentiment,
    usPredictionVerification
  });
  return { decisions, aiAnalysis, usData, aShareSentiment, etfKlineMap, usPredictionVerification, updatedAt: new Date().toISOString() };
}

router.get('/decisions', async (req, res) => {
  try {
    const payload = await buildDecisionPayload(req.query);
    res.json({
      decisions: payload.decisions,
      aiAnalysis: payload.aiAnalysis,
      usData: payload.usData,
      aShareSentiment: payload.aShareSentiment,
      usPredictionVerification: payload.usPredictionVerification,
      updatedAt: payload.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prediction', async (req, res) => {
  try {
    const payload = await buildDecisionPayload(req.query);
    const sectorAccuracyMap = await buildSectorAccuracy(payload.etfKlineMap);
    res.json({
      prediction: generateTomorrowPrediction(payload.decisions, sectorAccuracyMap),
      aiAnalysis: payload.aiAnalysis,
      usData: payload.usData,
      aShareSentiment: payload.aShareSentiment,
      usPredictionVerification: payload.usPredictionVerification,
      updatedAt: payload.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
