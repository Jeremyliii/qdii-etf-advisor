const DATA_SERVICE = process.env.DATA_SERVICE_URL || `http://127.0.0.1:${process.env.PORT === '3002' ? '5001' : '5000'}`;
const cache = new Map();

async function requestData(path, ttlMs = 60_000) {
  const key = path;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < ttlMs) {
    return cached.value;
  }
  const response = await fetch(`${DATA_SERVICE}${path}`);
  if (!response.ok) {
    throw new Error(`data-service ${response.status}: ${path}`);
  }
  const value = await response.json();
  cache.set(key, { time: Date.now(), value });
  return value;
}

function query(params) {
  return new URLSearchParams(params).toString();
}

async function getUsClose() {
  return (await requestData('/api/us-close', 5 * 60_000)).data || {};
}

async function getUsFutures() {
  return (await requestData('/api/us-futures', 60_000)).data || {};
}

async function getUsNews() {
  return (await requestData('/api/us-news', 5 * 60_000)).data || [];
}

async function getEconomicCalendar(days = 2) {
  return (await requestData(`/api/economic-calendar?${query({ days })}`, 30 * 60_000)).data || {};
}

async function getEarningsCalendar(days = 2) {
  return (await requestData(`/api/earnings-calendar?${query({ days })}`, 30 * 60_000)).data || {};
}

async function getAiAnalysis() {
  return await requestData('/api/ai-analyze', 30 * 60_000);
}

async function getEtfQuotes(symbols) {
  if (!symbols.length) return {};
  return (await requestData(`/api/etf-quotes?${query({ symbols: symbols.join(',') })}`, 30_000)).data || {};
}

async function getEtfKlineBatch(symbols, days = 220) {
  if (!symbols.length) return {};
  return (await requestData(`/api/etf-kline-batch?${query({ symbols: symbols.join(','), days })}`, 15 * 60_000)).data || {};
}

async function getUsHistory(ticker, days = 500) {
  return (await requestData(`/api/us-history?${query({ ticker, days })}`, 60 * 60_000)).data || [];
}

async function getAShareSentiment() {
  return (await requestData('/api/ashare-sentiment', 60_000)).data || {};
}

module.exports = {
  getAShareSentiment,
  getAiAnalysis,
  getEconomicCalendar,
  getEarningsCalendar,
  getEtfKlineBatch,
  getEtfQuotes,
  getUsClose,
  getUsFutures,
  getUsHistory,
  getUsNews
};
