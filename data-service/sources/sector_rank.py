from sources.common import UA, em_get


def get_sector_rank(top_n: int = 20) -> dict:
    """全市场行业板块涨跌排名，东财 push2: fs=m:90+t:2。"""
    url = "https://push2.eastmoney.com/api/qt/clist/get"
    params = {
        "pn": "1",
        "pz": "100",
        "po": "1",
        "np": "1",
        "fltt": "2",
        "invt": "2",
        "fs": "m:90+t:2",
        "fields": "f2,f3,f4,f8,f9,f12,f14,f20,f23,f104,f105,f128",
    }
    r = em_get(url, params=params, headers={"User-Agent": UA}, timeout=15)
    data = r.json()
    items = data.get("data", {}).get("diff", [])
    if not items:
        return {"top": [], "bottom": [], "total": 0}

    rows = []
    for index, item in enumerate(items):
        rows.append({
            "rank": index + 1,
            "code": item.get("f12", ""),
            "name": item.get("f14", ""),
            "price": item.get("f2", 0),
            "change_pct": item.get("f3", 0),
            "change_amt": item.get("f4", 0),
            "turnover_pct": item.get("f8", 0),
            "pe": item.get("f9", 0),
            "total_mcap": item.get("f20", 0),
            "pb": item.get("f23", 0),
            "up_count": item.get("f104", 0),
            "down_count": item.get("f105", 0),
            "leader": item.get("f128", ""),
        })

    return {
        "top": rows[:top_n],
        "bottom": rows[-top_n:],
        "total": len(rows),
    }
