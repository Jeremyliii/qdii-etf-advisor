import { useEffect, useMemo, useState } from 'react'
import { Play, ShieldCheck, XCircle } from 'lucide-react'
import { runBacktest } from '../api'

const ranges = [
  { value: 7, label: '7天' },
  { value: 14, label: '14天' },
  { value: 30, label: '30天' },
  { value: 60, label: '60天' }
]

function pct(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function directionLabel(value) {
  return value === 'up' ? '预测涨' : '预测跌'
}

function actualLabel(value) {
  return value === 'up' ? '实际涨' : '实际跌'
}

function confidenceLabel(value) {
  if (value === 'high') return '高'
  if (value === 'medium') return '中'
  return '低'
}

function MiniBar({ value }) {
  return (
    <div className="accuracy-bar" aria-label={`准确率 ${pct(value)}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
    </div>
  )
}

export default function HistoricalBacktest() {
  const [days, setDays] = useState(30)
  const [customDays, setCustomDays] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const stats = result?.stats || {}
  const allStats = result?.allStats || {}
  const lowImpact = result?.lowConfidenceImpact || {}
  const actionStats = result?.actionStats || []
  const rows = stats.recentPredictions || []
  const warning = Number(stats.accuracy || 0) > 0 && Number(stats.accuracy || 0) < 55

  const execute = async (nextDays = days) => {
    setLoading(true)
    try {
      setResult(await runBacktest({ days: nextDays }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    execute(30)
  }, [])

  const selectedDays = useMemo(() => Number(customDays || days), [customDays, days])

  return (
    <section className="section">
      <div className="section-head">
        <h2>预测准确率验证</h2>
        <span>验证系统每天的涨跌预测是否命中</span>
      </div>

      <div className="toolbar">
        <div className="segmented">
          {ranges.map((item) => (
            <button
              key={item.value}
              className={!customDays && days === item.value ? 'active' : ''}
              onClick={() => {
                setCustomDays('')
                setDays(item.value)
                execute(item.value)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="compact-input"
          min="7"
          max="120"
          type="number"
          placeholder="自定义天数"
          value={customDays}
          onChange={(event) => setCustomDays(event.target.value)}
        />
        <button className="icon-button wide" onClick={() => execute(selectedDays)} disabled={loading}>
          <Play size={16} />
          验证
        </button>
      </div>

      {warning && (
        <div className="warning-banner">
          当前预测模型准确率接近随机，建议谨慎参考，避免把预测当作买卖指令。
        </div>
      )}

      <div className="validation-summary">
        <div className="accuracy-hero primary-hero">
          <div className="metric-heading">
            <span>有效预测准确率</span>
            <small>中高置信度</small>
          </div>
          <strong>{pct(stats.accuracy)}</strong>
          <MiniBar value={stats.accuracy} />
          <div className="metric-strip">
            <div><span>预测</span><b>{stats.total || 0}</b></div>
            <div><span>正确</span><b>{stats.correct || 0}</b></div>
            <div><span>范围</span><b>{result?.days || selectedDays}天</b></div>
          </div>
        </div>

        <div className="accuracy-hero muted-hero">
          <div className="metric-heading">
            <span>全量准确率</span>
            <small>含低置信度</small>
          </div>
          <strong>{pct(allStats.accuracy)}</strong>
          <MiniBar value={allStats.accuracy} />
          <div className="metric-strip">
            <div><span>预测</span><b>{allStats.total || 0}</b></div>
            <div><span>正确</span><b>{allStats.correct || 0}</b></div>
            <div><span>低置信度</span><b>{lowImpact.total || 0}</b></div>
          </div>
          {!!lowImpact.total && (
            <p className="low-impact-note">
              低置信度预测准确率 {pct(lowImpact.accuracy)}，是整体准确率偏低的主要来源。
            </p>
          )}
        </div>
      </div>

      <div className="confusion-section">
        <div className="subsection-head">
          <h3>有效预测命中矩阵</h3>
          <span>只统计中高置信度样本</span>
        </div>
        <div className="confusion-grid">
          <div className="matrix-cell good">
            <span>预测涨且实际涨</span>
            <strong>{stats.truePositive || 0}</strong>
            <small>精确率 {pct(stats.upPrecision)}</small>
          </div>
          <div className="matrix-cell bad">
            <span>预测涨但实际跌</span>
            <strong>{stats.falsePositive || 0}</strong>
            <small>错误买入</small>
          </div>
          <div className="matrix-cell bad">
            <span>预测跌但实际涨</span>
            <strong>{stats.falseNegative || 0}</strong>
            <small>错过机会</small>
          </div>
          <div className="matrix-cell good">
            <span>预测跌且实际跌</span>
            <strong>{stats.trueNegative || 0}</strong>
            <small>精确率 {pct(stats.downPrecision)}</small>
          </div>
        </div>
      </div>

      <div className="stats-grid verify-stats">
        <div><span>平均单次收益</span><strong>{Number(stats.avgReturn || 0).toFixed(2)}%</strong></div>
        <div><span>累计收益</span><strong>{Number(stats.cumReturn || 0).toFixed(2)}%</strong></div>
        <div><span>预测涨精确率</span><strong>{pct(stats.upPrecision)}</strong></div>
        <div><span>预测跌精确率</span><strong>{pct(stats.downPrecision)}</strong></div>
        <div><span>有效预测</span><strong>{stats.total || 0}</strong></div>
        <div><span>低置信度参考</span><strong>{lowImpact.total || 0}</strong></div>
      </div>

      <div className="confusion-section">
        <div className="subsection-head">
          <h3>操作建议收益验证</h3>
          <span>如果按建议买入并持有约3个交易日</span>
        </div>
        <div className="action-stats-grid">
          {actionStats.map((item) => (
            <div key={item.action} className={`action-stat-card action-${item.action}`}>
              <span>{item.label}</span>
              <strong>{Number(item.avgReturn || 0).toFixed(2)}%</strong>
              <small>样本 {item.count} · 胜率 {pct(item.winRate)}</small>
              <em>最大 {Number(item.maxReturn || 0).toFixed(2)}% / 最小 {Number(item.maxLoss || 0).toFixed(2)}%</em>
            </div>
          ))}
        </div>
      </div>

      <div className="split-panels">
        <div>
          <h3>按板块准确率</h3>
          <div className="rank-list">
            {(stats.bySector || []).map((item) => (
              <div key={item.sector} className="rank-row">
                <span>{item.name || item.sector}</span>
                <strong>{pct(item.accuracy)}</strong>
                <MiniBar value={item.accuracy} />
                <small>{item.correct}/{item.total}</small>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>按评分区间全量准确率</h3>
          <div className="rank-list">
            {(allStats.byScoreRange || stats.byScoreRange || []).map((item) => (
              <div key={item.range} className="rank-row">
                <span>{item.range}</span>
                <strong>{pct(item.accuracy)}</strong>
                <MiniBar value={item.accuracy} />
                <small>{item.correct}/{item.total}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>美股信号日</th>
              <th>ETF</th>
              <th>预测</th>
              <th>置信度</th>
              <th>实际</th>
              <th>结果</th>
              <th>底层涨跌</th>
              <th>ETF涨跌</th>
              <th>方向分</th>
              <th>机会分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={`${item.date}-${item.symbol}`}>
                <td>{item.date}</td>
                <td>{item.usSignalDate || '-'}</td>
                <td>{item.name} {item.symbol}</td>
                <td className={item.predictDirection === 'up' ? 'text-up' : 'text-down'}>{directionLabel(item.predictDirection)}</td>
                <td><span className={`confidence-text ${item.confidence || 'low'}`}>{confidenceLabel(item.confidence)}</span></td>
                <td className={item.actualDirection === 'up' ? 'text-up' : 'text-down'}>{actualLabel(item.actualDirection)}</td>
                <td className={item.correct ? 'text-up' : 'text-down'}>
                  {item.correct ? <ShieldCheck size={15} /> : <XCircle size={15} />}
                </td>
                <td>{Number(item.linkedChange || 0).toFixed(2)}%</td>
                <td>{Number(item.actualChange || 0).toFixed(2)}%</td>
                <td>{item.directionScore ?? item.score}</td>
                <td>{item.opportunityScore ?? '-'}</td>
                <td>{item.actionLabel || item.action || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="12">暂无足够历史数据生成验证结果</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
