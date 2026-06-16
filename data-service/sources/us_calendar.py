import datetime

from .common import em_get


def get_economic_calendar(days=2):
    """Fetch near-term global economic events from EastMoney."""
    today = datetime.date.today()
    end = today + datetime.timedelta(days=max(1, int(days or 2)))
    url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
    params = {
        "reportName": "RPT_ECONOMICVALUE_HDAY",
        "columns": "ALL",
        "filter": f"(TRADE_DATE>='{today:%Y-%m-%d}')(TRADE_DATE<='{end:%Y-%m-%d}')",
        "pageSize": "50",
        "sortColumns": "TRADE_DATE",
        "sortTypes": "1",
    }
    try:
        data = em_get(url, params=params).json()
        result = data.get("result") or {}
        rows = result.get("data", []) or []
    except Exception as exc:
        return {
            "events": [],
            "high_impact_today": False,
            "event_count": 0,
            "error": str(exc),
        }

    events = []
    high_impact = False
    for item in rows:
        importance = _to_int(item.get("IMPORTANCE") or item.get("STAR"))
        event = {
            "time": item.get("TRADE_DATE") or item.get("DATE") or "",
            "country": item.get("COUNTRY") or item.get("REGION") or "",
            "event": item.get("ECONOMIC_EVENT") or item.get("INDICATOR_NAME") or item.get("EVENT") or "",
            "importance": importance,
            "forecast": item.get("FORECAST") or "",
            "previous": item.get("PREVIOUS") or "",
        }
        if event["event"]:
            events.append(event)
        if importance >= 3:
            high_impact = True

    return {
        "events": events,
        "high_impact_today": high_impact,
        "event_count": len(events),
    }


def _to_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default
