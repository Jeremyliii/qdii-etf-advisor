from mootdx.quotes import Quotes
import pandas as pd
import requests

from .common import em_get


def _market_prefix(symbol: str) -> str:
    return "1" if str(symbol).startswith(("5", "6")) else "0"


def _tencent_prefix(symbol: str) -> str:
    return "sh" if str(symbol).startswith(("5", "6")) else "sz"


def _mootdx_kline(symbol: str, days: int) -> list[dict]:
    client = Quotes.factory(market="std")
    all_dfs = []
    start = 0
    remaining = int(days)

    while remaining > 0:
        batch = min(800, remaining)
        df = client.bars(symbol=symbol, category=4, offset=batch, start=start)
        if df is None or df.empty:
            break
        all_dfs.append(df)
        if len(df) < batch:
            break
        start += batch
        remaining -= len(df)

    if not all_dfs:
        return []

    full = pd.concat(all_dfs).reset_index(drop=True)
    full = full.drop_duplicates(subset=["datetime"]).sort_values("datetime")
    records = []
    for _, row in full.iterrows():
        records.append({
            "date": str(row.get("datetime", ""))[:10],
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row["vol"]),
            "amount": float(row.get("amount", 0)),
        })
    return records[-int(days):]


def _eastmoney_kline(symbol: str, days: int) -> list[dict]:
    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": f"{_market_prefix(symbol)}.{symbol}",
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        "klt": "101",
        "fqt": "1",
        "beg": "0",
        "end": "20500101",
        "lmt": str(int(days)),
    }
    r = em_get(url, params=params, headers={"Referer": "https://quote.eastmoney.com/"}, timeout=20)
    r.raise_for_status()
    payload = r.json()
    klines = (((payload or {}).get("data") or {}).get("klines") or [])
    records = []
    for line in klines:
        parts = str(line).split(",")
        if len(parts) < 7:
            continue
        records.append({
            "date": parts[0],
            "open": float(parts[1]),
            "close": float(parts[2]),
            "high": float(parts[3]),
            "low": float(parts[4]),
            "volume": int(float(parts[5])),
            "amount": float(parts[6]),
        })
    return records[-int(days):]


def _tencent_kline(symbol: str, days: int) -> list[dict]:
    market_symbol = f"{_tencent_prefix(symbol)}{symbol}"
    url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
    params = {"param": f"{market_symbol},day,,,{int(days)},qfq"}
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://gu.qq.com/",
    }
    r = requests.get(url, params=params, headers=headers, timeout=20)
    r.raise_for_status()
    payload = r.json()
    node = ((payload.get("data") or {}).get(market_symbol) or {})
    rows = node.get("qfqday") or node.get("day") or []
    records = []
    for row in rows:
        if len(row) < 6:
            continue
        records.append({
            "date": str(row[0])[:10],
            "open": float(row[1]),
            "close": float(row[2]),
            "high": float(row[3]),
            "low": float(row[4]),
            "volume": int(float(row[5])),
            "amount": 0.0,
        })
    return records[-int(days):]


def get_etf_kline(symbol, days=500):
    """ETF daily K line. Prefer mootdx, fall back to Eastmoney history."""
    if not symbol:
        return []

    days = int(days)
    try:
        records = _mootdx_kline(symbol, days)
        if records:
            return records
    except Exception:
        pass

    try:
        records = _tencent_kline(symbol, days)
        if records:
            return records
    except Exception:
        pass

    return _eastmoney_kline(symbol, days)
