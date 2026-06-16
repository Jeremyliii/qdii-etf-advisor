const { getTechConfirmation } = require('./scoringModel');

const PREDICT_UP_THRESHOLD = 58;
const PREDICT_DOWN_THRESHOLD = 42;

function classifyPrediction({ score, linkedChange, linkedCount = 0, technical = {} }) {
  const cleanScore = Number(score || 0);
  const cleanLinkedChange = Number(linkedChange || 0);
  const tech = getTechConfirmation(technical);

  if (!linkedCount || Math.abs(cleanLinkedChange) < 0.1) {
    return {
      direction: 'neutral',
      confidence: 'low',
      reason: !linkedCount ? '联动数据不足，方向不明' : '隔夜联动接近0，方向不明',
      techConfirmed: false
    };
  }

  if (cleanScore >= PREDICT_UP_THRESHOLD) {
    return {
      direction: 'up',
      confidence: cleanScore >= 65 ? 'high' : 'medium',
      reason: '',
      techConfirmed: tech.bullish
    };
  }

  if (cleanScore <= 41) {
    return {
      direction: 'down',
      confidence: cleanScore <= 35 ? 'high' : 'medium',
      reason: '',
      techConfirmed: tech.bearish
    };
  }

  let reason = '评分处于42-57之间，方向不明';
  if (!linkedCount) {
    reason = '联动数据不足，方向不明';
  } else if (Math.abs(cleanLinkedChange) < 0.5) {
    reason = '隔夜波动小，方向不明';
  }

  return {
    direction: 'neutral',
    confidence: 'low',
    reason,
    techConfirmed: false
  };
}

function forceDirectionForStats(score) {
  const cleanScore = Number(score || 0);
  if (cleanScore >= 50) {
    return {
      direction: 'up',
      confidence: 'low',
      reason: '低置信度强制归为预测涨，仅用于全量准确率参考'
    };
  }
  return {
    direction: 'down',
    confidence: 'low',
    reason: '低置信度强制归为预测跌，仅用于全量准确率参考'
  };
}

function directionForStats(classification, score) {
  if (classification.direction !== 'neutral') {
    return classification;
  }
  return forceDirectionForStats(score);
}

function confidenceForPrediction(score) {
  const cleanScore = Number(score || 0);
  if (cleanScore >= 65 || cleanScore <= 35) return 'high';
  if (cleanScore >= 58 || cleanScore <= 41) return 'medium';
  return 'low';
}

function isEffectivePrediction(classification) {
  return classification.direction === 'up' || classification.direction === 'down';
}

module.exports = {
  PREDICT_UP_THRESHOLD,
  PREDICT_DOWN_THRESHOLD,
  classifyPrediction,
  directionForStats,
  forceDirectionForStats,
  confidenceForPrediction,
  isEffectivePrediction
};
