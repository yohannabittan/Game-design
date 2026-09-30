#!/usr/bin/env python3
"""Token ledger: reads Claude Code's session logs for this repo and writes docs/usage/.

    python3 tools/usage.py            # update docs/usage/agents.csv and docs/usage/README.md

Every model call in a session log carries its usage (fresh input, cache writes, cache reads, output). Calls are
deduplicated by message id, grouped per agent (the orchestrator session, or one sub-agent), attributed to a game and
a role from the sub-agent's spawn description, and priced at API list prices. Rows already in agents.csv from
earlier containers are kept, so the ledger survives the container being reclaimed once it is committed.

The dollar figures are API-equivalent: what the same tokens would cost on the Claude API. On a subscription plan
the real cost is the plan; the figure is still the right yardstick for comparing builds and planning.
"""
import csv, glob, json, os, re, sys
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS = os.path.expanduser('~/.claude/projects/-home-user-Game-design')
OUT = os.path.join(ROOT, 'docs', 'usage')

# $ per million tokens: input, output, cache read, cache write 5 min, cache write 1 h (writes are 1.25x and 2x input).
# Source: the claude-api reference bundled with Claude Code (shared/models.md, shared/prompt-caching.md), 2026-09-30.
PRICES = {
    'claude-fable-5-1': (10, 50, 0.25, 12.5, 20),
    'claude-opus-5-5': (4, 20, 0.20, 5, 8),
    'claude-sonnet-5-5': (2, 10, 0.20, 2.5, 4),
    'claude-haiku-4-5-20251001': (1, 5, 0.10, 1.25, 2),
}
GAMES = [('gravity-golf', r'golf|gravity|hole'), ('ink', r'\bink\b|stencil'), ('recoil', r'recoil|backlot|gun'),
         ('launch', r'launch|mochi'), ('checkpoint', r'checkpoint')]
ROLES = [('review', r'^(fresh )?(review|re-?gate|gate|verify|re-?check|audit)'), ('shard', r'shard'),
         ('research', r'research|anatomy|investigat|explore|survey'), ('build', r'build|fix|resume|implement|layer|author|mechanic'),
         ('review', r'review|gate')]
FIELDS = ['session', 'agent', 'description', 'game', 'role', 'model', 'day', 'start', 'end', 'calls',
          'input', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'output', 'usd']


def classify(desc, table, default):
    d = desc.lower()
    return next((name for name, pat in table if re.search(pat, d)), default)


def read_log(path):
    """Usage per message id (streamed messages repeat; keep the largest output), plus first and last timestamps."""
    msgs, t0, t1 = {}, None, None
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get('message')
            if not isinstance(m, dict) or not m.get('usage'):
                continue
            ts = d.get('timestamp')
            if ts:
                t0 = min(t0, ts) if t0 else ts
                t1 = max(t1, ts) if t1 else ts
            key = m.get('id') or d.get('uuid')
            u = dict(m['usage'])
            # Sub-agent logs keep the stream's opening output count (a handful of tokens); estimate from what was
            # written instead, about 4 characters per token, and take the larger.
            written = len(json.dumps(m.get('content') or '', ensure_ascii=False)) // 4
            prev = msgs.get(key)
            if prev:
                written += prev[2]  # a message streamed over several log lines: one content block per line
                u['output_tokens'] = max(u.get('output_tokens') or 0, prev[1].get('output_tokens') or 0)
            msgs[key] = (m.get('model') or 'unknown', u, written, (ts or '')[:10] or (prev[3] if prev else ''))
    for key, (model, u, written, day) in msgs.items():
        u['output_tokens'] = max(u.get('output_tokens') or 0, written)
    return msgs, t0, t1


def rows_for(path, session, agent, desc, game, role):
    msgs, t0, t1 = read_log(path)
    by_model = defaultdict(lambda: defaultdict(int))
    for model, u, _, day in msgs.values():
        cc = u.get('cache_creation') or {}
        w1h = cc.get('ephemeral_1h_input_tokens', 0) or 0
        w5 = cc.get('ephemeral_5m_input_tokens')
        if w5 is None:
            w5 = (u.get('cache_creation_input_tokens') or 0) - w1h
        b = by_model[(model, day)]
        b['calls'] += 1
        b['input'] += u.get('input_tokens') or 0
        b['cache_write_5m'] += w5 or 0
        b['cache_write_1h'] += w1h
        b['cache_read'] += u.get('cache_read_input_tokens') or 0
        b['output'] += u.get('output_tokens') or 0
    out = []
    for (model, day), b in by_model.items():
        p = PRICES.get(model)
        usd = '' if not p else round((b['input'] * p[0] + b['output'] * p[1] + b['cache_read'] * p[2]
                                      + b['cache_write_5m'] * p[3] + b['cache_write_1h'] * p[4]) / 1e6, 2)
        out.append({'session': session, 'agent': agent, 'description': desc, 'game': game, 'role': role, 'model': model,
                    'day': day, 'start': t0 or '', 'end': t1 or '', 'usd': usd, **b})
    return out


def collect():
    rows = []
    for main in glob.glob(os.path.join(LOGS, '*.jsonl')):
        session = os.path.basename(main)[:-6]
        rows += rows_for(main, session, 'orchestrator', 'Orchestrator session (docs, PRDs, merges, reviews dispatched)', 'library', 'orchestrate')
        for sub in glob.glob(os.path.join(LOGS, session, 'subagents', 'agent-*.jsonl')):
            agent = os.path.basename(sub)[6:-6]
            meta = {}
            try:
                meta = json.load(open(sub[:-6] + '.meta.json'))
            except (OSError, ValueError):
                pass
            desc = meta.get('description', '')
            rows += rows_for(sub, session, agent, desc, classify(desc, GAMES, 'library'), classify(desc, ROLES, 'other'))
    return rows


def merge(rows):
    path = os.path.join(OUT, 'agents.csv')
    keep = {}
    if os.path.exists(path):
        for r in csv.DictReader(open(path, encoding='utf-8')):
            keep[(r['session'], r['agent'], r['model'], r.get('day', ''))] = r
    for r in rows:
        keep[(r['session'], r['agent'], r['model'], r['day'])] = r
    merged = sorted(keep.values(), key=lambda r: (r.get('day', ''), r['start'], r['agent']))
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in merged:
            w.writerow({k: r.get(k, '') for k in FIELDS})
    return merged


def num(r, k):
    try:
        return float(r.get(k) or 0)
    except ValueError:
        return 0.0


def mtok(x):
    return f'{x / 1e6:,.1f}M'


def table(title, rows, key):
    agg = defaultdict(lambda: [0.0, 0.0, 0.0, 0])
    for r in rows:
        a = agg[key(r)]
        a[0] += num(r, 'usd')
        a[1] += num(r, 'output')
        a[2] += num(r, 'input') + num(r, 'cache_write_5m') + num(r, 'cache_write_1h') + num(r, 'cache_read')
        a[3] += 1
    total = sum(a[0] for a in agg.values()) or 1
    lines = [f'### {title}', '', '| | API-equivalent | Share | Output tokens | Input tokens (incl. cache) | Rows |', '| --- | --- | --- | --- | --- | --- |']
    for k, a in sorted(agg.items(), key=lambda kv: -kv[1][0]):
        lines.append(f'| {k} | ${a[0]:,.2f} | {100 * a[0] / total:.0f}% | {mtok(a[1])} | {mtok(a[2])} | {a[3]} |')
    return lines + ['']


def report(rows):
    total = sum(num(r, 'usd') for r in rows)
    days = sorted({r['day'] for r in rows if r.get('day')})
    per = defaultdict(lambda: {'usd': 0.0, 'output': 0.0})
    for r in rows:
        a = per[(r['description'] or r['agent'], r['game'], r['role'], r['model'])]
        a['usd'] += num(r, 'usd'); a['output'] += num(r, 'output')
    top = sorted(per.items(), key=lambda kv: -kv[1]['usd'])[:12]
    lines = [
        '# Token usage',
        '',
        f'Generated by `tools/usage.py` on {datetime.now().strftime("%Y-%m-%d %H:%M")} from the Claude Code session logs; raw rows in `agents.csv`.',
        '',
        f'**Total so far: ${total:,.2f} API-equivalent** across {len(rows)} agent rows, {days[0] if days else "-"} to {days[-1] if days else "-"}.',
        '',
        'Dollars are what the same tokens would cost on the Claude API at list prices (see `PRICES` in the script). On a',
        'subscription plan the real cost is the plan; use these figures to compare builds and plan, not as a bill.',
        'The orchestrator row is this conversation itself (writing docs and PRDs, reading reports, dispatching agents).',
        'Sub-agent output tokens are estimated from what they wrote (about 4 characters per token): their logs keep only',
        'the opening count of each streamed reply. Input and cache tokens are exact.',
        '',
    ]
    lines += table('By game', rows, lambda r: r['game'])
    lines += table('By role', rows, lambda r: r['role'])
    lines += table('By model', rows, lambda r: r['model'])
    lines += table('By day', rows, lambda r: r.get('day') or 'unknown')
    lines += ['### Most expensive agents', '', '| Agent | Game | Role | Model | API-equivalent | Output tokens |', '| --- | --- | --- | --- | --- | --- |']
    for (desc, game, role, model), a in top:
        lines.append(f"| {desc} | {game} | {role} | {model} | ${a['usd']:,.2f} | {mtok(a['output'])} |")
    with open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    return total


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    rows = merge(collect())
    print(f'{len(rows)} rows, ${report(rows):,.2f} API-equivalent; wrote docs/usage/agents.csv and README.md')
    sys.exit(0)
