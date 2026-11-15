# SDD ledger — plan: docs/superpowers/plans/2026-11-15-camera-policy.md

Task 1: complete in 7d9be6d; 7 controller tests and real-input static replay.
Task 2: complete in 7d9be6d; 3 fade tests and declared static renders.
Task 3: in progress; baseline 7d9be6d verified remote.
Ruling: standing user authorization covers main and ordinary origin/main sync; keep QA source only until acceptance.
Ruling: existing plan omits unresolved terrain and multi-obstacle cases; add those tests and a bounded continuous QA sequence before any native/production promotion.
Pre-flight: controller occlusion state feeds fade; terrain cannot be made visible by fading scenery, and root selection must exclude actors and feedback.
Browser plugin not available; use installed headless Playwright.

Task 3 evidence: /tmp/tidelands-camera-continuous-red-20261115.log reproduces missing ridge convergence, adjacent-wall progress and explicit roots. Minimal changes pass all13 camera tests in /tmp/tidelands-camera-continuous-green-20261115.log.
Task 3 bounded motion: dist/camera-policy-motion-2026-11-15 complete12 sequences/2880 frames, 6 candidate sequences with0 inside/recovery/terrain/unresolved and0 sampled full-body out-of-frame poses, max turns1.17/2.66/2.46 degrees. Full HDR30 valid GPU queries each, cold compile spikes and higher controller CPU retained. Native ordinary-input short path now running; do not promote from fixture evidence.
Ruling: adjacent blockers need only bounded neighboring corners at this stage, not a global routing framework. The synthetic connected-wall test failed before the change and now passes. Full-world trap-free routing is not claimed.

Native first attempt retained: 7403 ordinary-input frames,0 inside/recovery/terrain/unresolved, max2.85degrees, save/reload exact, but failed console gate: QA helpers imported root Three.js separately from the extracted package Three.js. Fix response-only root vendor import to re-export the extracted module; do not suppress warning or modify production. Retry into a new R2 output.

Final reviewer: /root/camera_policy_review (fresh gpt-6-astra, read-only) found two Important QA issues and no deterministic blocker in controller/static roots. Fixed route error collection/abort and report-finally cleanup; fixed storage-only recovery claim by actual paused UI export/full JSON comparison. Four regression tests RED missing guards then GREEN; /tmp/tidelands-camera-qa-review-{red,green}-20261115.log. Native R2 console clean,7465frames/0 camera violations/max3.91degrees; its reloadExact is storage-byte preservation only. Separate actual restore proof in dist/camera-policy-restore-2026-11-15 complete, exported live JSON exact. Narrow full path now uses strengthened gates.
Ruling: synchronize real start/pause UI button handlers to prevent an intervening simulation frame during restore/export; do not inject state, clock or closed-over values. This makes the exact JSON check diagnostic instead of tolerating changed fields.

Final: fixed QA route callback/report-loss and storage-only restore proof — guard tests RED→GREEN; canonical cooldown-reset case RED→GREEN; final suite456/456.
Production: preserved rejected7560f4b0 package; first production tower intent test RED after synthetic hundred-metre focus teleport. Explicit state-load/focus-transition reset then GREEN456/456, ordinary movement still bounded.
Task3: complete — native candidate paths and final raw R2 archive0eb90b4e,217inputs/218entries,1280/390 real controls and canonical live-export recovery, console empty/GL0. Packaging7/7.
Final: minor (deferred): visible local dither opening, complex enclosed terrain/all-world routing, real devices, whole-video/audio review and full-world performance remain quality work; no full3A claim.
Next: full playable-region foreground/midground/background and motion/sound differences; stop repeating this bounded camera group.
