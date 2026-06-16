import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { addPosition, deletePosition, fetchPortfolio, savePortfolio } from '../api'

export default function Portfolio({ decisions }) {
  const [portfolio, setPortfolio] = useState({ cash: 100000, positions: [], transactions: [] })
  const [form, setForm] = useState({ symbol: '513100', shares: 100, cost: 1 })

  const selected = useMemo(() => decisions.find((item) => item.symbol === form.symbol), [decisions, form.symbol])

  const load = async () => {
    setPortfolio(await fetchPortfolio())
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    const payload = {
      symbol: form.symbol,
      name: selected?.name || form.symbol,
      shares: Number(form.shares),
      cost: Number(form.cost)
    }
    setPortfolio(await addPosition(payload))
  }

  const updateCash = async (value) => {
    const next = { ...portfolio, cash: Number(value || 0) }
    setPortfolio(next)
    await savePortfolio(next)
  }

  const totalCost = portfolio.positions.reduce((sum, item) => sum + Number(item.shares) * Number(item.cost), 0)

  return (
    <section className="section">
      <div className="portfolio-layout">
        <form className="position-form" onSubmit={submit}>
          <label>
            现金
            <input type="number" value={portfolio.cash} onChange={(event) => updateCash(event.target.value)} />
          </label>
          <label>
            标的
            <select value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })}>
              {(decisions.length ? decisions : [{ symbol: '513100', name: '纳指ETF' }]).map((item) => (
                <option key={item.symbol} value={item.symbol}>{item.symbol} {item.name}</option>
              ))}
            </select>
          </label>
          <label>
            份额
            <input type="number" step="100" value={form.shares} onChange={(event) => setForm({ ...form, shares: event.target.value })} />
          </label>
          <label>
            成本
            <input type="number" step="0.001" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} />
          </label>
          <button className="icon-button wide" type="submit">
            <Plus size={16} />
            添加
          </button>
        </form>

        <div className="stats-grid portfolio-stats">
          <div><span>现金</span><strong>¥{Number(portfolio.cash || 0).toLocaleString()}</strong></div>
          <div><span>持仓成本</span><strong>¥{Math.round(totalCost).toLocaleString()}</strong></div>
          <div><span>持仓数量</span><strong>{portfolio.positions.length}</strong></div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>代码</th><th>名称</th><th>份额</th><th>成本</th><th>金额</th><th></th></tr>
          </thead>
          <tbody>
            {portfolio.positions.map((item) => (
              <tr key={item.id}>
                <td>{item.symbol}</td>
                <td>{item.name}</td>
                <td>{Number(item.shares).toLocaleString()}</td>
                <td>{Number(item.cost).toFixed(3)}</td>
                <td>¥{Math.round(Number(item.shares) * Number(item.cost)).toLocaleString()}</td>
                <td>
                  <button className="icon-only" onClick={async () => setPortfolio(await deletePosition(item.id))} title="删除">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
