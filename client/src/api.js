async function readJson(response) {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  return data
}

export async function fetchMarket() {
  return readJson(await fetch('/api/us-market'))
}

export async function fetchDecisions(config = {}) {
  const params = new URLSearchParams()
  if (config.buyThreshold) params.set('buyThreshold', config.buyThreshold)
  if (config.sellThreshold) params.set('sellThreshold', config.sellThreshold)
  return readJson(await fetch(`/api/decisions?${params.toString()}`))
}

export async function runBacktest(payload) {
  return readJson(await fetch('/api/backtest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }))
}

export async function fetchPrediction(config = {}) {
  const params = new URLSearchParams()
  if (config.buyThreshold) params.set('buyThreshold', config.buyThreshold)
  if (config.sellThreshold) params.set('sellThreshold', config.sellThreshold)
  return readJson(await fetch(`/api/prediction?${params.toString()}`))
}

export async function fetchUSPrediction(refresh = false) {
  return readJson(await fetch(`/api/us-prediction${refresh ? '?refresh=1' : ''}`))
}

export async function fetchPortfolio() {
  return readJson(await fetch('/api/portfolio'))
}

export async function savePortfolio(payload) {
  return readJson(await fetch('/api/portfolio', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }))
}

export async function addPosition(payload) {
  return readJson(await fetch('/api/portfolio/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }))
}

export async function deletePosition(id) {
  return readJson(await fetch(`/api/portfolio/positions/${id}`, { method: 'DELETE' }))
}
