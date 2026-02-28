-- Atomic finish_game RPC: closes all open pitching records and updates game status in a single transaction
create or replace function finish_game(p_game_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
  v_final_inning int;
begin
  -- Check game is in progress
  select status into v_status from games where id = p_game_id;
  if v_status is null then
    raise exception 'Game not found';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'Game is not in progress';
  end if;

  -- Determine final inning from last at-bat
  select coalesce(
    (select inning from at_bats where game_id = p_game_id order by created_at desc limit 1),
    9
  ) into v_final_inning;

  -- Close all open pitching records
  update pitching_records
  set inning_to = v_final_inning
  where game_id = p_game_id
    and inning_to is null;

  -- Update game status
  update games
  set status = 'finished'
  where id = p_game_id;
end;
$$;
