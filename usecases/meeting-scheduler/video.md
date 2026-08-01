# Video script — meeting-scheduler (80s)

## Hook (0-10s)

**Screen:** An email thread: "Tue or Wed?" → *2 days pass* (timestamp jump) → "Thursday?" → "Fri am?" → *3 days* → "Perfect."
**VO:** "Six sentences. Five days. This is the easiest hard problem in software — a conversation that must stay coherent across days of silence without costing a cent. Watch one run do the whole thing."

## The file (10-26s)

**Screen:** `usecases/meeting-scheduler/agent.js`. Highlight the identity loop: "After every email you send, call ask_human... The run parks at zero cost until the organizer relays the reply." Then "propose only slots it returned", then `{ maxSteps: 30, maxCost: 1.0 }`.
**VO:** "No state machine. The negotiation is one run: propose, park, read the reply, counter, park again. It can only offer slots the calendar tool actually returned — and it gives up gracefully after four rounds."

## Deploy + round one (26-40s)

**Screen:** `npm run deploy meeting-scheduler`, then the schedule-meeting curl — the request visibly hangs. Trace: `check_calendar` → 3 slots, `send_email` → proposal with two options, then **parked · $0/hr**, question: "reply from jordan@guestco.example?"
**VO:** "One curl. It checks the calendar, emails two options, and parks. The meter reads zero. It will read zero for as long as Jordan takes."

## Money shot — resume after days (40-68s)

**Screen:** On-screen: "2 days later". Paste into the dashboard: "None of those work — Thursday?". Trace resumes mid-run: `check_calendar` again → `send_email` counter-offer → parks again. "3 days later": paste "Friday 9:30 works!". Trace: confirmation email → memory write `status: booked`. The original curl, still the same run, returns: `BOOKED Fri 2026-08-07 09:30-10:15 PT`.
**VO:** "Two days later, paste the reply — the run wakes up mid-conversation, every round still in context, counters, parks again. Deploy the agent twice in between; it doesn't care. Five days after the curl started... it returns. Booked."

## CTA (68-80s)

**Screen:** README catalog, meeting-scheduler row.
**VO:** "meeting-scheduler, from oncell-cookbook. Point the stubs at your calendar and your email, and let one run be patient for you. Link below."
