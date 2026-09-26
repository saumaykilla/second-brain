# f-ui-02 — LiveKit Meeting Room

## Goal

Deliver a dependable native meeting room for authenticated company participants using LiveKit.

## User-visible behavior

Invited members join a Second Brain AI meeting with audio, video, screen sharing, participant controls, and a persistent meeting thread.

## Scope / out of scope

In scope:

- Secure room joining for invited members.
- Microphone, camera, speaker, and screen-sharing controls.
- Responsive participant and screen-share layouts.
- Participant list, speaking, muted, disconnected, and reconnecting states.
- Persistent meeting thread linked to the meeting.
- Visible CC presence when the assistant is enabled.
- Leave and organizer-end controls.

Out of scope:

- External guests, dial-in, webinars, or public streaming.
- Permanent raw audio/video recording.
- AI retrieval behavior and post-meeting processing.
- Background effects or advanced production controls.

## Acceptance criteria

- Only an authenticated invited member receives access to the LiveKit room.
- Participants can publish and receive permitted audio, video, screen share, and reliable thread messages.
- The UI handles camera-off, muted, screen-sharing, reconnecting, and participant-leave states.
- The active screen share receives visual priority without making meeting controls inaccessible.
- Meeting-thread messages persist and remain available after the room ends.
- CC is clearly distinguishable from human participants.
- Leaving a room does not end it for everyone; an authorized organizer can end the meeting.
- The room remains usable at supported desktop and mobile widths.

## Verification steps

1. Run frontend and token-authorization tests.
2. Join the same test meeting with at least two authenticated participants.
3. Exercise microphone, camera, screen sharing, thread messaging, reconnect, leave, and end controls.
4. Attempt joining as an uninvited member and from another company.
5. Verify thread persistence after leaving and re-entering.
6. Exercise the room at desktop and mobile viewport widths in a browser.

## Dependencies

- `f-aws-01` Platform Foundation and Environments.
- `f-be-01` Company Identity and Membership.
- `f-ui-01` App Shell and Company Administration.
- `f-be-03` Meeting Scheduling and Lifecycle.

## Open questions

- Which LiveKit regions and quality presets should be used initially?
- Should meeting-thread messages also be delivered over LiveKit data channels for lower perceived latency?
- Which organizer controls beyond ending the meeting are required?
