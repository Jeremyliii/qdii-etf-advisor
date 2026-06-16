import json
import re

import requests

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"


def _fallback_analysis(us_data, news_list):
    changes = [
        info.get("change_pct", 0)
        for info in us_data.values()
        if isinstance(info, dict) and isinstance(info.get("change_pct"), (int, float))
    ]
    avg = sum(changes) / len(changes) if changes else 0
    score = max(-100, min(100, round(avg * 18)))
    if score >= 35:
        label = "乐观"
        action = "适量买入"
    elif score <= -35:
        label = "悲观"
        action = "谨慎减仓"
    elif score > 10:
        label = "偏乐观"
        action = "小仓试探"
    elif score < -10:
        label = "偏悲观"
        action = "观望"
    else:
        label = "中性"
        action = "观望"

    return {
        "sentiment_score": score,
        "market_sentiment": label,
        "summary": "DeepSeek 未配置或暂时不可用，当前使用行情均值生成基础情绪判断。请重点检查 QDII 溢价，溢价超过 3% 不追买。",
        "sector_scores": {
            "nasdaq100": {"score": score, "outlook": "跟随纳指和大型科技股隔夜表现。"},
            "nasdaq_tech": {"score": score, "outlook": "关注 AI、软件和硬件龙头的延续性。"},
            "sp500": {"score": round(score * 0.8), "outlook": "宽基弹性低于纳指，适合作为低波动替代。"},
            "semiconductor": {"score": round(score * 1.1), "outlook": "半导体弹性更高，需控制溢价和回撤。"},
            "china_internet": {"score": 0, "outlook": "中概互联网更多受港股和政策预期影响。"},
            "consumer": {"score": round(score * 0.6), "outlook": "消费链条关注苹果、亚马逊和特斯拉表现。"},
            "tesla": {"score": round(score * 0.7), "outlook": "特斯拉链条波动较高，仓位不宜过重。"},
            "hk_tech": {"score": 0, "outlook": "港股科技需结合恒生科技早盘表现。"},
            "europe": {"score": 0, "outlook": "欧洲资产与美股联动较弱。"},
            "japan": {"score": 0, "outlook": "日经资产需结合日元和日本市场表现。"},
            "hk": {"score": 0, "outlook": "恒生指数关注港股早盘趋势。"},
        },
        "key_events": [{"event": news_list[0]["title"] if news_list else "暂无关键新闻", "impact": "中性", "sectors": ["nasdaq100"]}],
        "risk_alerts": ["QDII 溢价高于 3% 时避免追涨", "外部数据源失败时请人工核对行情"],
        "action": action,
        "confidence": 0.45,
    }


def _extract_json(text):
    content = text.strip()
    content = re.sub(r"^```(?:json)?", "", content).strip()
    content = re.sub(r"```$", "", content).strip()
    return json.loads(content)


def analyze_overnight(us_data, news_list, api_key):
    """用 DeepSeek 分析隔夜美股和新闻，输出结构化投资建议。"""
    if not api_key:
        return _fallback_analysis(us_data, news_list)

    market_lines = []
    for ticker, info in us_data.items():
        if isinstance(info, dict) and "close" in info:
            change = info.get("change_pct", 0)
            direction = "上涨" if change > 0 else "下跌" if change < 0 else "持平"
            market_lines.append(f"{info.get('name', ticker)}({ticker}): {info.get('close', 0)}，{direction} {change:+.2f}%")

    news_lines = [f"- {n['title']}" for n in news_list[:20]]
    prompt = f"""你是一个专业的跨境 ETF 投资顾问。请根据以下隔夜美股数据和新闻，给出今日 A 股市场 QDII ETF 的投资建议。

隔夜美股收盘：
{chr(10).join(market_lines)}

最新财经新闻：
{chr(10).join(news_lines)}

请只返回 JSON，不要添加解释文字。格式：
{{
  "sentiment_score": 0,
  "market_sentiment": "中性",
  "summary": "2-3 句话概括",
  "sector_scores": {{
    "nasdaq100": {{ "score": 0, "outlook": "一句话" }},
    "nasdaq_tech": {{ "score": 0, "outlook": "一句话" }},
    "sp500": {{ "score": 0, "outlook": "一句话" }},
    "semiconductor": {{ "score": 0, "outlook": "一句话" }},
    "china_internet": {{ "score": 0, "outlook": "一句话" }},
    "consumer": {{ "score": 0, "outlook": "一句话" }},
    "tesla": {{ "score": 0, "outlook": "一句话" }},
    "hk_tech": {{ "score": 0, "outlook": "一句话" }}
  }},
  "key_events": [
    {{ "event": "事件描述", "impact": "利好/利空/中性", "sectors": ["nasdaq100"] }}
  ],
  "risk_alerts": ["风险1", "风险2"],
  "action": "积极买入/适量买入/观望/谨慎减仓/清仓避险",
  "confidence": 0.7
}}"""

    try:
        resp = requests.post(
            DEEPSEEK_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "deepseek-v4-flash",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 900,
                "temperature": 0.1,
            },
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        return _extract_json(content)
    except Exception as e:
        fallback = _fallback_analysis(us_data, news_list)
        fallback["error"] = str(e)
        return fallback
