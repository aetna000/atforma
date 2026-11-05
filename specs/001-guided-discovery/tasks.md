# Tasks: Guided discovery

## Done (release-1 slice)

- [x] T001 Agent skills as data: `agent-skills/discovery/SKILL.md` (behaviour), `topics.json` (7 topics, order, prerequisites, beginner wording, why, if-unsure assumption, what each feeds)
- [x] T002 Workflow skills `agent-skills/workflows/workflows.json`: knowledge assistant, document processing, prediction/forecasting, agentic automation — detection, follow-up questions, first sketch per cloud
- [x] T003 Planner `src/discovery.mjs`: files each answer under the topic just asked; one question per turn; never re-asks; "not sure" → assumption + open question; extraction of usage, data size, budget, cloud, sensitivity; quality statements → measurable requirements; conflicting numbers kept with dates and flagged (FR-002–FR-006)
- [x] T004 Discover view: one open question, Send / Not sure / Why? / Skip, "What I understand so far" editable in the user's words, Sketch it (FR-004, FR-007)
- [x] T005 Connected model gets the same skills (`server/prompts.py`) and the planner's next question as read-only context
- [x] T006 Tests: `tests/journey.test.mjs`, server `SkillsTests`, browser smoke Discover section

## Remaining

- [ ] T007 Import-first start (US2): mark imported components existing and pre-fill current systems; Pulumi regions as assumptions to confirm
- [ ] T008 Unit and period follow-up when a number has no unit ("budget 5000")
- [ ] T009 Refine the question bank from research R2
