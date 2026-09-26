# ProjectBrain screen designs

Desktop references for the Orbit project. The visual direction is a lab notebook: warm paper, a beige index, a red margin line, and serif page titles.

Color marks:

- Red: failed or abandoned dead end
- Amber: revisitable dead end
- Green: current decision

Navigation: Timeline, Ask, Check, Graph, Lab, Impact.

| File | Route | What it shows |
| --- | --- | --- |
| `01-timeline.png` | `/` | Six weeks of Orbit. Dead ends, superseded decisions, and the WebSockets attempt after it becomes revisitable. |
| `02-dead-end-detail.png` | `/attempts/websockets` | Goal, approach, blocker, log evidence, conditions, the SSE alternative, 14 hours, and the App Runner note. |
| `03-ask.png` | `/ask` | Why Postgres search was rejected, with the attempt and the current Atlas Search decision. The side note is current auth. The superseded line is JWT. |
| `04-check-match.png` | `/check` | A socket.io plan matches the WebSockets dead end at 92 percent, with evidence, the alternative, and hours. |
| `05-check-none.png` | `/check` | A new idea that does not match a stored dead end. |
| `06-graph.png` | `/graph` | Three chains: sessions to JWT to Better Auth, App Runner unblocks WebSockets which led to SSE, Postgres LIKE led to Atlas Search. The middle auth card is the JWT decision. |
| `07-harness-lab.png` | `/lab` | v1 at 0.68, a rejected drop in precision, active v4 at 0.89, the diff, and Run reflection. |
| `08-impact.png` | `/impact` | 6 warnings, 41 hours saved from helpful warnings, precision from 0.68 to 0.89. |
| `09-slack-warning.png` | Slack thread | Sam states the socket.io intent. ProjectBrain replies in the thread with the dead end, the proof, and 14 hours. |
