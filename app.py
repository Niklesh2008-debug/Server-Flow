import heapq, random, time
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)
S = {}                                              # simulation state (wiped by reset)
G = dict(user="", demos=0, processed=0, added=0)    # lifetime counters (profile page)

def reset():
    S.update(servers=[dict(id=i, cap=c, q=q, cost=r, done=0) for i, c, q, r in
                      [("S1", 10, 2, 20), ("S2", 8, 5, 35), ("S3", 12, 1, 25)]],
             heap=[], hist=[], last=None, sn=3, rn=0, ids=set())
    for p, c in [(5, 20), (2, 10), (9, 30), (6, 15), (3, 25)]:
        add_request(p, c)

def add_request(p, c, rid=None):
    if rid:
        if rid in S["ids"]: return "Request ID already exists"
    else:
        while True:
            S["rn"] += 1; rid = f"R{S['rn']}"
            if rid not in S["ids"]: break
    S["ids"].add(rid)
    r = dict(id=rid, p=p, cost=c, seq=len(S["ids"]))
    # PRIORITY QUEUE (heapq): min-heap, so priority is negated -> highest priority pops first.
    # seq breaks ties so equal priorities are served in arrival order (FIFO).
    heapq.heappush(S["heap"], (-p, r["seq"], r))    # O(log R)

def err(m): return jsonify(error=m), 400

def route():
    if not S["servers"]: return "No servers available"
    if not S["heap"]: return "Request queue is empty"
    _, _, r = heapq.heappop(S["heap"])              # 1. extract highest priority: O(log R)
    # 2-3. evaluate every server and compute its greedy score: O(S)
    ev = [dict(id=s["id"], q=s["q"], cost=s["cost"], score=s["q"] + s["cost"],
               ok=s["q"] < s["cap"]) for s in S["servers"]]
    ok = [e for e in ev if e["ok"]]                 # feasibility: server must have capacity left
    if not ok:
        heapq.heappush(S["heap"], (-r["p"], r["seq"], r))   # put request back
        return "No available servers - all are at full capacity"
    # 4. GREEDY CHOICE: best score *right now* (ties -> lower queue, then lower cost).
    #    Locally optimal for this request; no guarantee of a globally optimal distribution.
    best = min(ok, key=lambda e: (e["score"], e["q"], e["cost"]))
    srv = next(s for s in S["servers"] if s["id"] == best["id"])
    before = srv["q"]; srv["q"] += 1; srv["done"] += 1      # 5-6. assign + update server
    G["processed"] += 1
    S["hist"].append(dict(time=time.strftime("%H:%M:%S"), req=r["id"], p=r["p"], server=srv["id"],
                          score=best["score"], before=before, after=srv["q"]))  # 7. record
    S["last"] = dict(req=r, evals=ev, chosen=srv["id"])
    return None

def snap(**x):
    sv = [dict(s, pct=round(100 * s["q"] / s["cap"]),
               status="Full" if s["q"] >= s["cap"] else "Online") for s in S["servers"]]
    q = [dict(r, pos=i + 1) for i, (_, _, r) in enumerate(sorted(S["heap"]))]
    n = len(sv); pcts = [s["pct"] for s in sv]
    m = dict(total=len(S["hist"]) + len(q), processed=len(S["hist"]), pending=len(q),
             active=sum(s["status"] == "Online" for s in sv),
             avg_q=round(sum(s["q"] for s in sv) / n, 1) if n else 0,
             avg_cost=round(sum(s["cost"] for s in sv) / n, 1) if n else 0,
             eff=round(100 - (max(pcts) - min(pcts))) if n else 0)   # load-balance score
    return jsonify(servers=sv, queue=q, hist=S["hist"], last=S["last"], metrics=m,
                   profile=dict(G), **x)

@app.route("/")
def index(): return render_template("index.html")

@app.get("/api/state")
def state(): return snap()

@app.post("/api/login")                              # demo login: no password, no real auth
def login():
    u = (request.get_json() or {}).get("username", "").strip()
    if not u: return err("Enter a username")
    G["user"] = u
    return jsonify(ok=True, user=u)

@app.post("/api/server")
def server():
    d = request.get_json()
    if d.get("action") == "remove":
        if not S["servers"]: return err("No servers to remove")
        i = d.get("id")
        S["servers"] = [s for s in S["servers"] if s["id"] != i] if i else S["servers"][:-1]
        return snap()
    try: cap, q, cost = int(d["cap"]), int(d["q"]), int(d["cost"])
    except Exception: return err("Enter valid numbers")
    if cap < 1 or cost < 1 or q < 0 or q > cap: return err("Invalid capacity / queue / cost")
    taken = {s["id"] for s in S["servers"]}
    sid = (d.get("id") or "").strip().upper()
    if sid in taken: return err("Server ID already exists")
    while not sid:
        S["sn"] += 1
        if f"S{S['sn']}" not in taken: sid = f"S{S['sn']}"
    S["servers"].append(dict(id=sid, cap=cap, q=q, cost=cost, done=0))
    G["added"] += 1
    return snap()

@app.post("/api/request")
def req():
    d = request.get_json()
    if d.get("generate"):
        for _ in range(int(d["generate"])): add_request(random.randint(1, 10), random.randint(5, 35))
        return snap()
    try: p, c = int(d["p"]), int(d["cost"])
    except Exception: return err("Enter valid numbers")
    if not 1 <= p <= 10 or c < 1: return err("Priority must be 1-10 and cost must be > 0")
    e = add_request(p, c, (d.get("id") or "").strip().upper() or None)
    return err(e) if e else snap()

@app.post("/api/route")
def route_ep():
    e = route()
    return err(e) if e else snap()

@app.post("/api/reset")
def reset_ep():
    reset(); return snap()

@app.post("/api/demo")                               # loads sample data; the UI then routes step by step
def demo():
    reset(); G["demos"] += 1
    return snap()

reset()
if __name__ == "__main__":
    app.run(debug=True)
