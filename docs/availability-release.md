# Availability and rescheduling release

Local implementation only. No production migration, deployment or data changes were executed.

## Data and API contract

- Existing `availability`, `availabilityStart`, `availabilityEnd` and per-day `start/end` remain readable.
- New per-day `intervals` contains sorted nonoverlapping windows. `start/end` mirrors the first window, never the envelope across a break. Missing `intervals` uses the legacy window. An explicitly invalid/empty list fails closed.
- Inactive days retain their saved hours; only days in `availability` can be booked. Saving validates retained hours too.
- No production backfill. Existing lessons are not changed when a schedule is edited.
- `POST /api/teachers/application` authenticates the teacher and writes editable fields in a transaction. Stripe/promotion fields survive the merge. Moderation and `previousProfile` remain unchanged.
- `POST /api/lessons/{lessonId}/reschedule` supports request, accepted and rejected. It reads current user/parent links, lesson and schedule. Only the other side (or an administrator) can respond. Acceptance atomically moves the lesson and its locks. Existing cancellation/report/payment APIs are unchanged.
- `lessons/{lessonId}/scheduleOperations/{actorUid}_{requestId}` stores an operation fingerprint and notification snapshot. Clients cannot access these documents. A repeated identifier with different input is rejected.
- All new booking writers use quarter-hour lock coverage including off-grid starts. Transactional active-lesson queries protect legacy lessons without matching locks. These queries add reads proportional to the teacher's active lessons.
- No new environment variables or indexes are required: the active-lesson query already exists, and lock lookup uses one indexed field.
- Calendar dates use Europe/Warsaw. Nonexistent spring-forward times and lessons crossing an offset change are unavailable, because the existing wall-clock lock model cannot represent them unambiguously. Existing stored lessons are untouched. Repeated autumn times use the existing timezone resolver's occurrence.

## Write-path review

| Operation | Result |
| --- | --- |
| Teacher application/create/edit | Trusted API; direct browser application writes denied by final Rules |
| Admin approve/reject/restore | Existing Admin SDK route; approval validates schedule; restore retains snapshot |
| Teacher public identity | Existing name/initials/color/photo updates remain allowed |
| Reviews | Existing reviews/rating/count rules remain allowed |
| Admin feature/delete/catalog seed | Existing permissions remain allowed |
| Connect/promotion/synchronization/account finalization | Existing trusted server writes unchanged |
| Request/accept/reject reschedule | Trusted API; browser writes to dates, identities, duration and reschedule requests denied |
| Cancel requests, reports, completion | Existing paths remain allowed; cancelled/completed lessons cannot be reactivated directly |

## Deployment sequence (requires release approval)

Do not deploy the entire diff and Rules in arbitrary order. The current pre-change browser writes directly to Firestore; final Rules intentionally reject those writes. Merely waiting a few minutes does not prove all old tabs are gone.

1. Prepare a bridge release: server APIs, shared readers/validators and lock handling, plus clients using the APIs, with the existing single-window UI. Do not enable multi-window writes yet. Keep current Rules during this compatibility phase. Test against an isolated Firebase project first.
2. Verify all booking backend instances use the shared lock model. Drain earlier backend versions/in-flight requests. Keep paid Checkout/session idempotency and reconciliation available.
3. Ensure teachers and lesson participants use the bridge client before tightening Rules. A verified client-refresh/version rollout is a prerequisite. This repository does not currently guarantee that arbitrarily old open tabs refresh; without that operational prerequisite, a zero-disruption cutover is UNVERIFIED and release is blocked. Do not silently weaken final Rules to accommodate obsolete writes.
4. Deploy the tested Rules after API clients are in use. Verify application editing, identity, reviews, parent requests, cancellation, reports and admin moderation with isolated accounts.
5. Release the multi-window editor. Verify each available interval, breaks, end boundaries, first package booking and moving a lesson concurrently with a booking.

The bridge release is a deployment slice to prepare separately, not an implemented feature flag. This working tree is the final target implementation; it must not be deployed wholesale as step 1.

Rollback must retain the new readers and APIs once multi-window records exist. Do not roll back to a backend that interprets only one range, or restore permissive Rules as an automatic rollback.

## Verification

- Behavior tests execute actual validators, application API/builder, package booking and reschedule transaction callbacks using isolated mocks. Transaction tests model commit conflicts/retries and atomic failure, not production latency.
- Rules tests run in Firestore/Storage emulators with project `demo-runbee`; they cover both intended operations and bypass attempts.
- No real payments, refunds, transfers, payout operations, user mutations or emails are needed or allowed for QA.
- Full staging E2E, actual distributed contention/load, external Auth/Resend integration and rollout of old open clients require separate verification.
- In-app reschedule notifications are committed with the operation. Email delivery uses the existing dispatcher/outbox after commit. A failure before an email event is enqueued still relies on retrying the same operation; no stronger delivery guarantee is introduced here.

## Form redesign and isolated visual QA

- The application form now uses a desktop section sidebar and a compact mobile section selector. Five sections group profile identity, subjects/levels, description, lesson offer and weekly availability. Existing submission and moderation semantics remain intact.
- Styles are local to the form. Rate, duration, trial and package controls keep their existing values and handlers. Availability supports adding/removing individual intervals, retaining hours when a day is disabled, and inline conflict errors.
- Browser QA used the actual form/editor with mocked teacher/category/auth services in a temporary local preview. Saves and uploads were disabled; the preview did not initialize production Firebase.
- Checked light/dark layouts, desktop 1440/1920 and mobile 390 widths, section navigation, focus, day toggles, retained ranges, adding/removing ranges and overlap errors. No horizontal overflow was observed at the checked widths. This is visual/interaction QA, not a production-connected end-to-end test.
- Automated verification: 368 application tests and 29 Firestore/Storage emulator tests passed. Separate TypeScript checking and webpack production build passed. Build-time Firestore reads reported unavailable DNS in the sandbox; production data-dependent rendering remains unverified.
