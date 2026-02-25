-- Add default_team_id to profiles
alter table profiles
  add column default_team_id uuid references teams(id) on delete set null;
