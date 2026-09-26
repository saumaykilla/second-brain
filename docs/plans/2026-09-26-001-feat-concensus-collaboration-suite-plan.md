---
title: Second Brain AI Collaboration Suite - Plan
type: feat
date: 2026-09-26
topic: Second Brain-collaboration-suite
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Second Brain AI Collaboration Suite - Plan

## Goal Capsule

- **Objective:** Build a phased collaboration suite for scaling knowledge-work companies, centered on meetings that can recall approved Notion content and prior company decisions.
- **Product authority:** This contract defines the intended product behavior and scope. The matching feature documents in `docs/` divide that behavior into implementation-sized capabilities.
- **Open blockers:** None. Implementation planning must resolve technical details without expanding the product scope.

---

## Product Contract

### Summary

Second Brain AI will combine native LiveKit meetings, approved Notion knowledge, company memory, collaboration, and decision follow-through in one company workspace.
The product will launch in phases, with trustworthy meeting memory first and broader collaboration capabilities following on the same foundation.

### Problem Frame

Teams often search Notion manually during meetings to recover earlier decisions, or they unknowingly solve problems that were already documented.
Meeting context, written knowledge, discussion history, and follow-up work are fragmented across tools, so participants lose time and repeat decisions.
The first customer segment is scaling knowledge-work teams of roughly 20–500 employees that already use Notion.

### Key Decisions

- **Own the meeting experience with LiveKit.** (session-settled: user-directed — chosen over integrating Zoom, Google Meet, and Microsoft Teams: a native meeting platform is the simpler initial path.) Governs R10–R14.
- **Build the full collaboration suite in phases.** (session-settled: user-directed — chosen over either a meeting-only product or an all-at-once launch: preserve the broader product while keeping meeting memory as the foundation.) Governs R20–R23.
- **Share approved knowledge company-wide.** (session-settled: user-directed — chosen over mirroring per-user Notion permissions: administrators explicitly approve the sources available to active company members.) Governs R5–R9.
- **Begin with a reactive meeting agent.** (session-settled: user-directed — chosen over proactive interjections: direct requests make trust and relevance easier to establish.) Governs R13–R15.
- **Retain transcripts, not raw media.** (session-settled: user-directed — chosen over storing audio and video recordings: searchable memory does not require permanent raw media.) Governs R16–R18.

### Actors

- A1. **Company administrator:** Creates the company workspace, invites members, assigns roles, approves Notion sources, and controls company settings.
- A2. **Company member:** Uses meetings, company knowledge, collaboration, and assigned decision or action work.
- A3. **Meeting organizer:** Creates an instant or scheduled meeting and selects participating company members.
- A4. **Meeting participant:** Joins a meeting, speaks with other participants, uses the meeting thread, and asks CC for company context.
- A5. **CC assistant:** Retrieves approved knowledge, answers with citations, creates meeting records, and supports company-wide knowledge questions.
- A6. **Notion workspace:** Supplies administrator-approved company content and subsequent content changes.

### Requirements

**Company access and administration**

- R1. Each customer operates in an isolated company workspace containing its members, knowledge sources, meetings, collaboration, and records.
- R2. Company membership is invitation-only and members sign in with Google.
- R3. Administrators can invite or remove members, assign supported roles, and manage company settings.
- R4. The initial meeting experience admits authenticated members of the hosting company only.

**Notion knowledge**

- R5. An administrator can connect a Notion workspace and disconnect it later.
- R6. An administrator explicitly selects which Notion pages and databases become approved company knowledge.
- R7. Approved content is imported initially and remains aligned with edits, additions, removals, and revoked selections.
- R8. All active company members can retrieve content from approved sources, while content from unapproved sources remains unavailable.
- R9. Retrieved Notion knowledge retains enough source identity for users to open and verify the original content.

**Meetings and live memory**

- R10. Members can create instant or scheduled meetings and invite other company members.
- R11. Participants can join a LiveKit room with audio, video, screen sharing, and participant controls.
- R12. Each meeting has a persistent thread for participant messages, assistant responses, and follow-up discussion.
- R13. CC listens during a meeting but responds only when directly addressed in the initial meeting-memory phase.
- R14. When asked for company context, CC searches approved Notion knowledge and prior meeting memory before answering.
- R15. CC provides source citations with grounded answers and clearly states when the available knowledge does not support an answer.

**Meeting records and durable memory**

- R16. Second Brain AI stores a meeting transcript and discards raw audio and video after processing.
- R17. A completed meeting produces a structured record containing a summary, key decisions, action items, transcript, and supporting citations.
- R18. Approved meeting records become searchable company memory for future meetings and the company assistant.

**Knowledge access and collaboration**

- R19. Members can ask a company-wide assistant questions across approved Notion content and prior meeting memory and receive cited answers.
- R20. The broader suite includes company channels and direct messages with real-time delivery and history.
- R21. Collaboration surfaces can reference meetings, meeting records, approved knowledge, decisions, and action items without duplicating their authoritative content.

**Decisions and actions**

- R22. The advanced decision system tracks decisions and action items with owners, status, reminders, source history, and links to the meetings or knowledge that created them.
- R23. Delivery is phased and only one registered feature is implementation-active at a time, beginning with the platform foundation.

### Key Flows

- F1. **Company onboarding**
  - **Trigger:** A company administrator starts a new Second Brain AI workspace.
  - **Actors:** A1, A6.
  - **Steps:** The administrator signs in with Google, establishes the company, connects Notion, approves initial sources, and invites members.
  - **Outcome:** Invited members can access an isolated workspace backed by approved company knowledge.
  - **Covers:** R1–R9.

- F2. **Knowledge synchronization**
  - **Trigger:** An approved Notion source is added, changed, removed, or deselected.
  - **Actors:** A1, A5, A6.
  - **Steps:** Second Brain AI detects the source state, updates searchable company knowledge, preserves provenance, and removes knowledge that is no longer approved.
  - **Outcome:** Retrieval reflects the currently approved Notion corpus.
  - **Covers:** R5–R9.

- F3. **Create and run a meeting**
  - **Trigger:** A member creates an instant or scheduled meeting.
  - **Actors:** A2, A3, A4, A5.
  - **Steps:** The organizer selects members, participants join the LiveKit room, meeting media and the thread operate in real time, and CC listens.
  - **Outcome:** Company members complete a native meeting with a persistent discussion context.
  - **Covers:** R4, R10–R13.

- F4. **Ask CC during a meeting**
  - **Trigger:** A participant directly addresses CC with a company-context question.
  - **Actors:** A4, A5.
  - **Steps:** CC searches approved Notion and prior meeting memory, evaluates available support, and gives a concise cited answer or an explicit no-answer response.
  - **Outcome:** Participants recover verifiable context without manually searching multiple records.
  - **Covers:** R13–R15.

- F5. **Complete a meeting**
  - **Trigger:** A meeting ends.
  - **Actors:** A4, A5.
  - **Steps:** Second Brain AI finalizes the transcript, discards raw media, creates the structured meeting record, and makes eligible record content searchable.
  - **Outcome:** The company gains a cited, durable record that improves future recall.
  - **Covers:** R16–R18.

- F6. **Ask the company assistant**
  - **Trigger:** A member asks a question outside a live meeting.
  - **Actors:** A2, A5.
  - **Steps:** The assistant searches the same approved knowledge corpus, answers with citations, and links to original records.
  - **Outcome:** Members can retrieve company knowledge without waiting for a meeting.
  - **Covers:** R8, R9, R15, R18, R19.

- F7. **Follow through on a decision**
  - **Trigger:** A meeting record or member creates a decision or action item.
  - **Actors:** A1, A2, A5.
  - **Steps:** The item receives an owner and status, retains source history, appears in relevant collaboration surfaces, and generates reminders when required.
  - **Outcome:** Decisions remain traceable and action work remains visible after the meeting.
  - **Covers:** R21, R22.

### Acceptance Examples

- AE1. **Covers R6–R9.** Given an administrator approves two Notion pages, when sync completes, then members can retrieve those pages with source links and cannot retrieve an unapproved sibling page.
- AE2. **Covers R7.** Given an approved Notion page is edited or removed, when synchronization processes the change, then future retrieval reflects the edit or no longer returns the removed content.
- AE3. **Covers R13–R15.** Given a participant directly asks CC about a documented prior decision, when relevant approved evidence exists, then CC answers concisely and cites the supporting Notion or meeting sources.
- AE4. **Covers R15.** Given a participant asks CC a question unsupported by approved knowledge, when retrieval finds no reliable evidence, then CC states that it cannot verify an answer and does not invent one.
- AE5. **Covers R16–R18.** Given a meeting ends, when post-meeting processing succeeds, then participants can open the transcript, summary, decisions, action items, and citations while no raw recording remains stored.
- AE6. **Covers R4, R10, R11.** Given a person is not an active company member, when they attempt to join a meeting link, then they cannot enter the room.
- AE7. **Covers R19.** Given a member asks the company assistant about a prior meeting and a Notion policy, when both contain relevant evidence, then the answer distinguishes and links both source types.
- AE8. **Covers R22.** Given an action item has an owner and due state, when its status changes, then the current state and originating meeting remain visible in its history.

### Success Criteria

- Users can obtain correct, cited answers from approved Notion and prior meeting knowledge during live meetings.
- Administrators can determine exactly which Notion sources are available to the company.
- Unsupported questions produce transparent no-answer responses rather than ungrounded claims.
- Every completed meeting yields a usable structured record without retaining raw media.
- The first delivery phase establishes reusable company, knowledge, meeting, and memory foundations for later collaboration features.

### Scope Boundaries

**Deferred for later**

- Proactive CC interjections and configurable proactive behavior.
- External guests and public meeting links.
- Google Calendar scheduling and additional knowledge connectors.
- Channels, direct messages, and the decision/action system follow the meeting-memory foundation according to their registered priority.

**Outside this product's initial identity**

- Integrating Zoom, Google Meet, or Microsoft Teams as the primary meeting experience.
- Mirroring every user's granular Notion permissions in the first release.
- Retaining raw meeting audio or video as a permanent system record.

### Dependencies / Assumptions

- MongoDB remains the system of record for application data and memory documents.
- The Node.js API owns business logic, authorization, integration orchestration, and data access.
- The Next.js application owns user-facing routes and client state.
- AWS hosts production infrastructure and supporting services.
- LiveKit provides real-time meeting media and agent participation.
- Notion remains an external source; synchronized content and retrieval artifacts must be traceable back to approved source records.
- The original `saumaykilla/Second Brain-ai` repository is a product and UX reference, not an architecture to copy unchanged.

### Sources / Research

- Product reference: `https://github.com/saumaykilla/Second Brain-ai`
- Repository architecture and operating constraints: `AGENTS.md`
