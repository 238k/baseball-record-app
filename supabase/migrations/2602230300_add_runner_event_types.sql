-- Add wild_pitch, passed_ball, balk to runner_events.event_type constraint
alter table runner_events drop constraint if exists runner_events_event_type_check;
alter table runner_events add constraint runner_events_event_type_check
  check (event_type in ('stolen_base', 'caught_stealing', 'scored', 'out', 'wild_pitch', 'passed_ball', 'balk'));
