# Second Brain — 1-minute demo script

**What it is (one line):** Second Brain is long-horizon memory for a software team —
it remembers what you tried, what failed, and why, and stops you before you repeat a
dead end, *with the proof*.

**Setup:** open the deployed app. No login, no config — it runs on the seeded **Orbit**
project (a team task app with six weeks of history). Have these tabs/paths ready:
`/` · `/check` · `/ask` · `/lab` · `/impact` · `/graph`.

> Everything below works on the deployed URL with zero setup — the data is seeded.

---

## The 60-second run (4 beats)

### 0:00 – 0:12 · The memory (Timeline) — page `/`
> "This is Orbit's project memory — six weeks of decisions and attempts. Red rows are
> **dead ends** the team already hit; green are current decisions."

- Click the **WebSockets** row to expand it. Point at: **14 hours spent**, blocker
  *"Serverless functions time out after 10 seconds, which drops every open WebSocket
  connection,"* evidence *"WebSocket closed 1006 after 10s,"* and *"what we did instead:
  Server-Sent Events."*

### 0:12 – 0:30 · Warn before repeating — page `/check`
> "Now a new engineer doesn't know that history and proposes the same thing."

- Paste: **`Let's add socket.io so the task board shows live updates for the whole team.`**
- Hit **Check for dead ends**. It returns the WebSockets dead end with **~91% match**,
  the blocker, the evidence, the SSE alternative, and **"14 hours saved."**
> "It warns with proof — the reason, the evidence, and the hours it just saved."
- (Optional, 2s) Paste `Add CSV export for invoices` → **no match.** "A genuinely new
  idea doesn't get warned."

### 0:30 – 0:42 · Cited answers, no stale decisions — page `/ask`
> "You can also just ask it."

- Ask: **`What authentication does Orbit use now?`**
- It answers **Better Auth (current)** and cites it, and shows **JWT** and **sessions**
  as **superseded** — it never presents an old decision as the current one.

### 0:42 – 0:52 · A dead end can reopen — page `/` (or `/graph`)
> "Memory reasons over time. When the team later moved realtime to **AWS App Runner** —
> a long-running service — that satisfies the WebSockets dead end's condition."

- On `/graph`, point at the dashed green **`unblocks`** edge from **App Runner → the
  WebSockets attempt**. "So that dead end becomes *revisitable*, not a permanent no."

### 0:52 – 1:00 · It measures itself — pages `/lab` + `/impact`
> "And the system that does all this is versioned and measured."

- `/lab`: three harness versions — **v1 baseline**, **v2 rejected** *(precision dropped
  0.83 → 0.74, reason recorded)*, **v3 active at 0.96**. "It only promotes a change when
  the eval score improves without losing precision."
- `/impact`: **4 warnings sent, 34 hours saved**, and the **precision trend** climbing to
  v3. "Proof it's actually working."

---

## The four use cases (what each beat proves)

1. **Warn with proof** — `/check`: repeating a failed approach returns the dead end,
   blocker, evidence, alternative, and hours saved. A new idea does not warn.
2. **Cited answers** — `/ask`: answers cite the attempt/decision and never present a
   superseded decision as current.
3. **Reopen on condition** — `/` and `/graph`: a later decision (App Runner) makes a dead
   end revisitable via the `unblocks` edge.
4. **Measured self-improvement** — `/lab` + `/impact`: versioned harness, promote only on
   an eval win, with a hours-saved and precision trend.

## Exact inputs to paste (copy/paste ready)

- Check (match): `Let's add socket.io so the task board shows live updates for the whole team.`
- Check (no match): `Add CSV export for invoices`
- Ask (current vs superseded): `What authentication does Orbit use now?`
- Ask (why rejected): `Why didn't we use Postgres for search?`

## Recording tips

- Record at 1280×800+; the layout is a left "Index" nav + main column.
- Pre-load each tab so pages are warm (first load may fetch briefly).
- If you want live numbers on `/lab`, click **Run reflection** — it runs the real
  40-case eval and reports the result inline (it does not persist without a database,
  which is fine for the demo; the version history is already seeded).
- The whole story works on the seeded Orbit data with **no environment variables**.
  Setting `MONGODB_URI` + model keys later switches it from seeded data to live data.
