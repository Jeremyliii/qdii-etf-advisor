function calcSMA(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function calcEMA(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(values, period = 14) {
  if (values.length < period + 1) return values.map(() => 50);
  const result = Array(period).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calcMACD(values, fast = 12, slow = 26, signalPeriod = 9) {
  const fastEma = calcEMA(values, fast);
  const slowEma = calcEMA(values, slow);
  const dif = values.map((_, index) => (fastEma[index] || 0) - (slowEma[index] || 0));
  const dea = calcEMA(dif, signalPeriod);
  const histogram = dif.map((value, index) => value - (dea[index] || 0));
  return { dif, dea, histogram };
}

function calcMaxDrawdown(curve) {
  let peak = curve[0]?.equity || 1;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    const drawdown = peak ? (peak - point.equity) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}

module.exports = { calcSMA, calcEMA, calcRSI, calcMACD, calcMaxDrawdown };
