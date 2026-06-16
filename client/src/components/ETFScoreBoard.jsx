import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function ETFScoreBoard({ decisions, loading }) {
  const chartData = decisions.slice(0, 12).map((item) => ({
    name: item.symbol,
    directionScore: item.directionScore,
    opportunityScore: item.opportunityScore,
    label: item.name
  }))

  return (
    <section className="section">
      <div className="section-head">
        <h2>ETF 评分排行</h2>
        <span>按投资机会排序 Top 12</span>
      </div>
      {loading ? <div className="chart-skeleton" /> : (
        <div className="chart-panel">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#2d3748" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                contentStyle={{ background: '#111827', border: '1px solid #2d3748', borderRadius: 8 }}
                formatter={(value, name, props) => [`${value} 分`, `${props.payload.label} · ${name === 'directionScore' ? '方向预测' : '投资机会'}`]}
              />
              <Bar dataKey="directionScore" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opportunityScore" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
