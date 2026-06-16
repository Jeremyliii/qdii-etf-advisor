import { SlidersHorizontal } from 'lucide-react'

export default function StrategyConfig({ config, setConfig, decisions }) {
  const buyCount = decisions.filter((item) => ['strong_buy', 'buy_dip', 'accumulate'].includes(item.action)).length
  const riskCount = decisions.filter((item) => ['no_chase', 'avoid'].includes(item.action)).length

  const update = (key, value) => {
    setConfig({ ...config, [key]: Number(value) })
  }

  return (
    <section className="section config-section">
      <div className="section-head">
        <h2>策略参数</h2>
        <span><SlidersHorizontal size={16} /> 本地生效</span>
      </div>
      <div className="config-grid">
        <label className="range-control">
          <span>旧买入阈值 <strong>{config.buyThreshold}</strong></span>
          <input type="range" min="50" max="90" value={config.buyThreshold} onChange={(event) => update('buyThreshold', event.target.value)} />
        </label>
        <label className="range-control">
          <span>旧卖出阈值 <strong>{config.sellThreshold}</strong></span>
          <input type="range" min="10" max="55" value={config.sellThreshold} onChange={(event) => update('sellThreshold', event.target.value)} />
        </label>
        <label className="range-control">
          <span>回测资金 <strong>¥{Number(config.initialCash).toLocaleString()}</strong></span>
          <input type="range" min="10000" max="1000000" step="10000" value={config.initialCash} onChange={(event) => update('initialCash', event.target.value)} />
        </label>
      </div>

      <div className="stats-grid">
        <div><span>可买/建仓</span><strong>{buyCount}</strong></div>
        <div><span>不追/回避</span><strong>{riskCount}</strong></div>
        <div><span>溢价红线</span><strong>3%</strong></div>
      </div>
    </section>
  )
}
