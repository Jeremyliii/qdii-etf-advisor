#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QDII ETF daily WeChat push via OpenClaw."""

import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

API_BASE = os.environ.get("QDII_API_BASE", "http://127.0.0.1:3002")
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "/home/ubuntu/.npm-global/bin/openclaw")
OPENCLAW_CHANNEL = os.environ.get("OPENCLAW_CHANNEL", "openclaw-weixin")
OPENCLAW_TARGET = os.environ.get("OPENCLAW_TARGET", "")
OPENCLAW_ACCOUNT = os.environ.get("OPENCLAW_ACCOUNT", "3f6612e366d1-im-bot")
OPENCLAW_STATE_DIR = Path(os.environ.get("OPENCLAW_STATE_DIR", "/home/ubuntu/.openclaw"))
WEIXIN_PLUGIN_DIR = Path(os.environ.get(
    "WEIXIN_PLUGIN_DIR",
    "/home/ubuntu/.openclaw/npm/projects/tencent-weixin-openclaw-weixin-7783ac86ba/node_modules/@tencent-weixin/openclaw-weixin",
))
NODE_BIN = os.environ.get("NODE_BIN", "/usr/bin/node")
FALLBACK_FILE = Path(os.environ.get("QDII_PUSH_FALLBACK", "/tmp/qdii_msg.txt"))
PUBLIC_URL = os.environ.get("QDII_PUBLIC_URL", "http://81.70.43.226:8172")


def fetch_json(path, timeout=120):
    req = Request(f"{API_BASE}{path}", headers={"User-Agent": "qdii-wechat-push/1.1"})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_json(path, payload, timeout=120):
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        f"{API_BASE}{path}",
        data=body,
        headers={"User-Agent": "qdii-wechat-push/1.1", "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fmt_pct(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = 0.0
    arrow = "📈" if value >= 0 else "📉"
    return f"{arrow} {value:+.2f}%"


def fmt_range(values):
    if not values:
        return "0.00%~0.00%"
    low, high = values
    return f"{float(low):+.2f}%~{float(high):+.2f}%"


def fmt_price(value, prefix=""):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return "-"
    return f"{prefix}{value:.0f}" if abs(value) >= 1000 else f"{prefix}{value:.2f}"


def pick_us_line(us_data, key, label, prefix=""):
    item = us_data.get(key) or {}
    if not item:
        return f"  {label}: -"
    return f"  {label}: {fmt_price(item.get('close'), prefix)} {fmt_pct(item.get('change_pct'))}"


def classify(decisions):
    groups = {
        "strong_buy": [],
        "buy_dip": [],
        "accumulate": [],
        "no_chase": [],
        "avoid": [],
        "hold": [],
    }
    for item in decisions:
        action = str(item.get("action", "hold")).lower()
        if action not in groups:
            action = "hold"
        groups[action].append(item)
    for action, items in groups.items():
        reverse = action not in {"avoid", "no_chase"}
        items.sort(key=lambda x: float(x.get("opportunityScore") or x.get("score") or 0), reverse=reverse)
    return groups


def etf_line(item):
    direction_score = int(round(float(item.get("directionScore") or 50)))
    opportunity_score = int(round(float(item.get("opportunityScore") or item.get("score") or 0)))
    linked = float(item.get("linkedChange") or 0)
    return (
        f"  {item.get('name','-')}({item.get('symbol','-')}) "
        f"方向{direction_score} 机会{opportunity_score} 联动{linked:+.2f}%"
    )


def ai_summary(ai):
    if not isinstance(ai, dict):
        return "中性\n  AI 分析暂不可用"
    sentiment = ai.get("market_sentiment") or ai.get("sentiment") or ai.get("action") or "中性"
    text = ai.get("summary") or ai.get("reasoning") or ai.get("comment") or ""
    if not text:
        events = ai.get("key_events") or []
        if events and isinstance(events, list):
            first = events[0]
            text = first.get("event") if isinstance(first, dict) else str(first)
    if ai.get("error") and not text:
        text = "AI 接口暂不可用，使用行情和技术指标生成保守信号"
    return f"{sentiment}\n  {text or '暂无额外说明'}"


def prediction_lines():
    try:
        payload = fetch_json("/api/prediction")
        prediction = payload.get("prediction") or {}
        ups = prediction.get("ups") or []
        downs = prediction.get("downs") or []
    except Exception:
        return ["🔮 明日预测", "  预测接口暂不可用"]

    try:
        backtest = post_json("/api/backtest", {"days": 30}, timeout=180)
        accuracy = backtest.get("stats", {}).get("accuracy")
    except Exception:
        accuracy = None

    lines = ["🔮 明日预测"]
    if ups:
        text = " ".join(f"{x.get('name')}({fmt_range(x.get('estimatedRange'))})" for x in ups[:3])
        lines.append(f"  📈 预测上涨: {text}")
    else:
        lines.append("  📈 预测上涨: 暂无")
    if downs:
        text = " ".join(f"{x.get('name')}({fmt_range(x.get('estimatedRange'))})" for x in downs[:3])
        lines.append(f"  📉 预测下跌: {text}")
    else:
        lines.append("  📉 预测下跌: 暂无")
    if accuracy is not None:
        lines.append(f"  预测准确率近30天: {float(accuracy):.1f}%")
    return lines


def us_prediction_lines(decision_payload=None):
    lines = []
    verification = (decision_payload or {}).get("usPredictionVerification") or {}
    if verification.get("available"):
        hit = "命中" if verification.get("hit") else "未命中"
        lines += [
            "🔭 昨日美股预测验证",
            f"  预测: {verification.get('predictionText', '-')}({verification.get('score', '-')}分) → 实际: {float(verification.get('actualChange') or 0):+.2f}% {hit}",
        ]
        if verification.get("multiplier", 1) > 1:
            lines.append("  双重确认加成已生效")
        elif verification.get("multiplier", 1) < 1:
            lines.append("  预测反向，今日信号已打折")

    try:
        payload = fetch_json("/api/us-prediction")
        prediction = payload.get("prediction") or {}
        lines += [
            "🔭 今晚美股预测",
            f"  综合评分: {prediction.get('score', '-')} / 100 {prediction.get('directionText', '-')}",
            f"  置信度: {prediction.get('confidenceText', prediction.get('confidence', '-'))}",
        ]
        components = prediction.get("components") or {}
        lines.append(
            "  "
            f"技术{float(components.get('technicalScore') or 0):.0f} | "
            f"VIX{float(components.get('vixScore') or 0):.0f} | "
            f"跨市场{float(components.get('crossScore') or 0):.0f} | "
            f"AI{float(components.get('aiScore') or 0):.0f}"
        )
        reasons = prediction.get("reasoning") or []
        if reasons:
            lines.append(f"  关键因素: {str(reasons[0])[:60]}")
    except Exception as exc:
        lines += ["🔭 今晚美股预测", f"  预测接口暂不可用: {exc}"]
    return lines


def build_message():
    data = fetch_json("/api/decisions")
    decisions = data.get("decisions") or []
    us_data = data.get("usData") or {}
    ai = data.get("aiAnalysis") or {}
    groups = classify(decisions)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    date_label = ""
    for key in (".NDX", ".INX", "NVDA"):
        if isinstance(us_data.get(key), dict) and us_data[key].get("data_date_label"):
            date_label = us_data[key]["data_date_label"]
            break

    lines = [
        f"📊 QDII ETF 每日决策 {now}",
        "==============================",
        "",
        "🌙 隔夜美股",
        pick_us_line(us_data, ".NDX", "纳斯达克100"),
        pick_us_line(us_data, ".INX", "标普500"),
        pick_us_line(us_data, "NVDA", "英伟达", "$"),
    ]

    vix = us_data.get("^VIX") or us_data.get("VIX") or {}
    if vix:
        lines.append(f"  VIX: {fmt_price(vix.get('close'))}")
    if date_label:
        lines.append(f"  数据日期: {date_label}")

    lines += ["", f"🤖 AI: {ai_summary(ai)}", ""]

    lines += us_prediction_lines(data)
    lines.append("")

    buy_like = groups["strong_buy"] + groups["buy_dip"] + groups["accumulate"]
    avoid_like = groups["no_chase"] + groups["avoid"]
    holds = groups["hold"]

    lines.append(f"🟢 买入/建仓 ({len(buy_like)}只)")
    lines.extend(etf_line(x) for x in buy_like[:6])
    if not buy_like:
        lines.append("  暂无")

    lines += ["", f"🟡 不追/回避 ({len(avoid_like)}只)"]
    lines.extend(etf_line(x) for x in avoid_like[:6])
    if not avoid_like:
        lines.append("  暂无")

    lines += ["", *prediction_lines()]

    lines += ["", f"📋 观望: {len(holds)}只"]
    if holds:
        top_holds = "、".join(
            f"{x.get('name','-')}({int(round(float(x.get('opportunityScore') or x.get('score') or 0)))}分)"
            for x in holds[:5]
        )
        lines.append(f"  {top_holds}")

    lines += ["", f"🔗 {PUBLIC_URL}", "⚠️ 仅供参考，不构成投资建议"]
    return "\n".join(lines)


def save_fallback(message, error):
    FALLBACK_FILE.write_text(message + "\n\n--- OpenClaw send error ---\n" + str(error) + "\n", encoding="utf-8")


def normalize_weixin_target(target):
    return target.removeprefix("channel:").removeprefix("group:")


def send_message_direct(message):
    """Send through the Weixin bot HTTP API and validate the business response."""
    if not OPENCLAW_TARGET:
        raise RuntimeError("OPENCLAW_TARGET is empty")
    target = normalize_weixin_target(OPENCLAW_TARGET)
    script = f"""
import fs from 'node:fs';

const accountId = process.env.OPENCLAW_ACCOUNT;
const stateDir = process.env.OPENCLAW_STATE_DIR;
const to = process.env.OPENCLAW_TARGET;
const text = process.env.WECHAT_MESSAGE || '';
const accountPath = `${{stateDir}}/openclaw-weixin/accounts/${{accountId}}.json`;
const tokenPath = `${{stateDir}}/openclaw-weixin/accounts/${{accountId}}.context-tokens.json`;
const account = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const contextToken = tokens[to];

function buildBody(contextToken, label) {{
  const msg = {{
    from_user_id: '',
    to_user_id: to,
    client_id: `qdii-${{label}}-${{Date.now()}}`,
    message_type: 2,
    message_state: 2,
    item_list: [{{ type: 1, text_item: {{ text }} }}],
  }};
  if (contextToken) msg.context_token = contextToken;
  return {{
    msg,
    base_info: {{ sdk_version: 'openclaw-qdii-push' }},
  }};
}}

async function post(body) {{
  const resp = await fetch(`${{account.baseUrl.replace(/\\/$/, '')}}/ilink/bot/sendmessage`, {{
    method: 'POST',
    headers: {{
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      Authorization: `Bearer ${{account.token}}`,
      'iLink-App-Id': 'bot',
      'iLink-App-ClientVersion': '1',
      'X-WECHAT-UIN': '12345678',
    }},
    body: JSON.stringify(body),
  }});
  const raw = await resp.text();
  let data = {{}};
  try {{ data = raw ? JSON.parse(raw) : {{}}; }} catch {{ data = {{ raw }}; }}
  return {{ ok: resp.ok, status: resp.status, data, raw }};
}}

let first = await post(buildBody(contextToken, 'ctx'));
if (first.ok && (!first.data || Object.keys(first.data).length === 0)) {{
  console.log('direct send ok with context');
  process.exit(0);
}}

if (first.data && first.data.errcode === -14) {{
  const second = await post(buildBody('', 'noctx'));
  if (second.ok && (!second.data || Object.keys(second.data).length === 0)) {{
    console.log('direct send ok without context after session timeout');
    process.exit(0);
  }}
  console.error(`direct send retry failed status=${{second.status}} body=${{second.raw}}`);
  process.exit(3);
}}

console.error(`direct send failed status=${{first.status}} body=${{first.raw}}`);
process.exit(2);
"""
    env = os.environ.copy()
    env.update({
        "OPENCLAW_ACCOUNT": OPENCLAW_ACCOUNT,
        "OPENCLAW_STATE_DIR": str(OPENCLAW_STATE_DIR),
        "OPENCLAW_TARGET": target,
        "WECHAT_MESSAGE": message,
    })
    return subprocess.run(
        [NODE_BIN, "--input-type=module", "-e", script],
        text=True,
        capture_output=True,
        timeout=120,
        env=env,
    )


def send_message_cli(message):
    if not OPENCLAW_TARGET:
        raise RuntimeError("OPENCLAW_TARGET is empty")
    target = normalize_weixin_target(OPENCLAW_TARGET)
    cmd = [
        OPENCLAW_BIN,
        "message",
        "send",
        "--channel",
        OPENCLAW_CHANNEL,
        "--account",
        OPENCLAW_ACCOUNT,
        "--target",
        target,
        "-m",
        message,
    ]
    return subprocess.run(cmd, text=True, capture_output=True, timeout=90)


def send_message(message):
    direct = send_message_direct(message)
    if direct.returncode == 0:
        return direct

    cli = send_message_cli(message)
    cli.stdout = (direct.stdout or "") + "\n--- cli fallback ---\n" + (cli.stdout or "")
    cli.stderr = (direct.stderr or "") + "\n--- cli fallback ---\n" + (cli.stderr or "")
    return cli


def main():
    try:
        message = build_message()
    except Exception as exc:
        message = "QDII ETF 每日决策生成失败"
        save_fallback(message, f"build failed: {exc}")
        print(f"build failed; saved to {FALLBACK_FILE}: {exc}")
        return 1

    try:
        result = send_message(message)
    except Exception as exc:
        save_fallback(message, exc)
        print(f"send failed; saved to {FALLBACK_FILE}: {exc}")
        return 1

    if result.returncode != 0:
        error = textwrap.dedent(f"""
        returncode={result.returncode}
        stdout={result.stdout}
        stderr={result.stderr}
        """).strip()
        save_fallback(message, error)
        print(f"send failed; saved to {FALLBACK_FILE}")
        print(error)
        return result.returncode

    print("send ok")
    if result.stdout.strip():
        print(result.stdout.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
