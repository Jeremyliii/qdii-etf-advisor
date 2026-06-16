import urllib.request


def _market_prefix(code: str) -> str:
    if code.startswith(("5", "6", "9")):
        return "sh"
    if code.startswith("8"):
        return "bj"
    return "sz"


def _to_float(value, default=0):
    try:
        return float(value) if value not in ("", None, "-") else default
    except (TypeError, ValueError):
        return default


def _to_int(value, default=0):
    try:
        return int(float(value)) if value not in ("", None, "-") else default
    except (TypeError, ValueError):
        return default


def tencent_quote(codes: list[str]) -> dict[str, dict]:
    """
    批量拉取腾讯财经实时行情。
    字段校准来自 SKILL.md V3.2.2：43=振幅%，46=PB。
    """
    clean_codes = [str(c).strip() for c in codes if str(c).strip()]
    if not clean_codes:
        return {}

    prefixed = [f"{_market_prefix(code)}{code}" for code in clean_codes]
    url = "https://qt.gtimg.cn/q=" + ",".join(prefixed)
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    resp = urllib.request.urlopen(req, timeout=10)
    data = resp.read().decode("gbk")

    result = {}
    for line in data.strip().split(";"):
        if not line.strip() or "=" not in line or '"' not in line:
            continue
        key = line.split("=")[0].split("_")[-1]
        vals = line.split('"')[1].split("~")
        if len(vals) < 53:
            continue
        code = key[2:]
        result[code] = {
            "name": vals[1],
            "price": _to_float(vals[3]),
            "last_close": _to_float(vals[4]),
            "prev_close": _to_float(vals[4]),
            "open": _to_float(vals[5]),
            "change_amt": _to_float(vals[31]),
            "change_pct": _to_float(vals[32]),
            "high": _to_float(vals[33]),
            "low": _to_float(vals[34]),
            "volume": _to_int(vals[36]),
            "amount_wan": _to_float(vals[37]),
            "amount": _to_float(vals[37]) * 10000,
            "turnover_pct": _to_float(vals[38]),
            "pe_ttm": _to_float(vals[39]),
            "amplitude_pct": _to_float(vals[43]),
            "mcap_yi": _to_float(vals[44]),
            "float_mcap_yi": _to_float(vals[45]),
            "pb": _to_float(vals[46]),
            "limit_up": _to_float(vals[47]),
            "limit_down": _to_float(vals[48]),
            "vol_ratio": _to_float(vals[49]),
            "pe_static": _to_float(vals[52]),
        }
    return result


def check_tencent() -> bool:
    try:
        return bool(tencent_quote(["513100"]).get("513100", {}).get("price"))
    except Exception:
        return False
