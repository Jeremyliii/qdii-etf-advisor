import { useState } from 'react'
import { AlertTriangle, CircleDollarSign, Flame, PauseCircle, ShieldAlert, TrendingDown } from 'lucide-react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

const groups = [
  { key: 'strong_buy', label: '强烈买入', icon: Flame, hint: '方向看涨且机会好' },
  { key: 'buy_dip', label: '逢低买入', icon: TrendingDown, hint: '预测跌，但低开可能是买点' },
  { key: 'accumulate', label: '可以建仓', icon: CircleDollarSign, hint: '方向不明，但位置有吸引力' },
  { key: 'no_chase', label: '不追高', icon: AlertTriangle, hint: '预测涨，但买入性价比差' },
  { key: 'avoid', label: '回避', icon: ShieldAlert, hint: '方向和机会都不佳' },
  { key: 'hold', label: '观望', icon: PauseCircle, hint: '没有明确动作' }
]

function premiumLabel(item) {
  const premiumAvailable = item.premiumAvailable && Number.isFinite(Number(item.estimatedPremium))
  if (!premiumAvailable) return '溢价暂无可靠数据'

  const value = Number(item.estimatedPremium).toFixed(2)
  if (item.premiumSource === 'eastmoney_latest_nav') {
    return `最新净值溢价率 ${value}%`
  }
  return `估算溢价率 ${value}%`
}

function scoreText(score, type) {
  const value = Number(score || 0)
  if (type === 'direction') {
    if (value >= 55) return '预测上涨'
    if (value <= 45) return '预测下跌'
    return '方向不明'
  }
  if (value >= 75) return '机会很好'
  if (value >= 60) return '有吸引力'
  if (value >= 45) return '机会一般'
  if (value >= 30) return '机会偏差'
  return '机会很差'
}

function DecisionCard({ item }) {
  const premiumAvailable = item.premiumAvailable && Number.isFinite(Number(item.estimatedPremium))
  const premiumClass = premiumAvailable && Number(item.estimatedPremium) > 3 ? 'premium danger' : 'premium'
  const directionScore = Number(item.directionScore ?? item.score ?? 50)
  const opportunityScore = Number(item.opportunityScore ?? item.score ?? 50)

  return (
    <article className={`decision-card action-${item.action}`}>
      <div className="decision-card-head">
        <div>
          <strong>{item.name}</strong>
          <span>{item.symbol} · {item.tracking}</span>
        </div>
        <div className="action-badge">{item.actionLabel || '观望'}</div>
      </div>

      <div className="dual-score-grid">
        <div className="score-box direction-box">
          <span>方向预测</span>
          <strong>{directionScore}/100</strong>
          <small>{scoreText(directionScore, 'direction')}</small>
          <i style={{ width: `${Math.max(0, Math.min(100, directionScore))}%` }} />
        </div>
        <div className="score-box opportunity-box">
          <span>投资机会</span>
          <strong>{opportunityScore}/100</strong>
          <small>{scoreText(opportunityScore, 'opportunity')}</small>
          <i style={{ width: `${Math.max(0, Math.min(100, opportunityScore))}%` }} />
        </div>
      </div>

      <div className="why-block">
        <b>{item.actionReason || '没有明确的买卖信号'}</b>
        {(item.reasons || []).slice(0, 5).map((reason) => <p key={reason}>· {reason}</p>)}
        {item.actionTip && <p className="tip-line">建议: {item.actionTip}</p>}
      </div>

      <div className="decision-meta">
        <span>联动 {Number(item.linkedChange || 0).toFixed(2)}%</span>
        <span className={premiumClass}>{premiumLabel(item)}</span>
      </div>
    </article>
  )
}

function DecisionScatter({ decisions }) {
  const points = decisions.map((item) => ({
    x: Number(item.directionScore || 50),
    y: Number(item.opportunityScore || 50),
    z: 80,
    name: item.name,
    symbol: item.symbol,
    action: item.actionLabel || item.action
  }))

  return (
    <section className="section">
      <div className="section-head">
        <h2>方向-机会二维图</h2>
        <span>横轴方向预测，纵轴投资机会</span>
      </div>
      <div className="scatter-panel">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="#263244" />
            <XAxis type="number" dataKey="x" name="方向预测" domain={[0, 100]} stroke="#94a3b8" />
            <YAxis type="number" dataKey="y" name="投资机会" domain={[0, 100]} stroke="#94a3b8" />
            <ZAxis type="number" dataKey="z" range={[70, 70]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#111827', border: '1px solid #2d3748', borderRadius: 8 }}
              formatter={(value, name) => [value, name]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload
                return item ? `${item.name} ${item.symbol} · ${item.action}` : ''
              }}
            />
            <Scatter data={points} fill="#38bdf8" />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="quadrant-label q1">强烈买入</div>
        <div className="quadrant-label q2">逢低买入</div>
        <div className="quadrant-label q3">不追高</div>
        <div className="quadrant-label q4">回避</div>
      </div>
    </section>
  )
}

export default function TodayDecisions({ grouped, loading }) {
  const [expanded, setExpanded] = useState({})
  const allItems = groups.flatMap((group) => grouped[group.key] || [])

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>今日操作建议</h2>
          <span>预测方向和买入机会分开判断</span>
        </div>
        {loading ? <div className="skeleton-line tall" /> : (
          <div className="action-groups">
            {groups.map((group) => {
              const Icon = group.icon
              const items = grouped[group.key] || []
              const collapsed = group.key === 'hold' && !expanded[group.key] && items.length > 8
              const visibleItems = collapsed ? items.slice(0, 8) : items
              return (
                <article className={`action-group ${group.key}-group`} key={group.key}>
                  <div className="group-title">
                    <Icon size={17} />
                    <strong>{group.label}</strong>
                    <span>{items.length}</span>
                    <small>{group.hint}</small>
                  </div>
                  <div className="decision-card-list">
                    {visibleItems.map((item) => <DecisionCard key={item.symbol} item={item} />)}
                    {!items.length && <div className="empty-state">暂无</div>}
                  </div>
                  {collapsed && (
                    <button className="text-action" onClick={() => setExpanded({ ...expanded, [group.key]: true })}>
                      展开全部 ({items.length}只)
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
      {!loading && <DecisionScatter decisions={allItems} />}
    </>
  )
}
