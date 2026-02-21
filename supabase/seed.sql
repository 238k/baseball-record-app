-- =====================================================
-- シードデータ（ローカル開発用）
-- supabase db reset で自動適用されます
-- =====================================================

-- =====================================================
-- 1. テストユーザー作成
-- =====================================================
-- admin@example.com (パスワード: password123)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'admin@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '',
  '', '', '',
  '', '', '',
  0, false, false,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"管理者太郎"}'
);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'admin@example.com',
  jsonb_build_object('sub', 'a1111111-1111-1111-1111-111111111111', 'email', 'admin@example.com'),
  'email', now(), now(), now()
);

-- member@example.com (パスワード: password123)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b2222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'member@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '',
  '', '', '',
  '', '', '',
  0, false, false,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"メンバー花子"}'
);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES (
  'b2222222-2222-2222-2222-222222222222',
  'b2222222-2222-2222-2222-222222222222',
  'member@example.com',
  jsonb_build_object('sub', 'b2222222-2222-2222-2222-222222222222', 'email', 'member@example.com'),
  'email', now(), now(), now()
);

-- =====================================================
-- 2. テストチーム「テストタイガース」
--    (handle_new_team トリガーで admin が team_members に自動追加)
-- =====================================================
INSERT INTO teams (id, name, owner_id, invite_code)
VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'テストタイガース',
  'a1111111-1111-1111-1111-111111111111',
  'TEST1234'
);

-- member@example.com をメンバーとして追加
INSERT INTO team_members (team_id, profile_id, role)
VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'b2222222-2222-2222-2222-222222222222',
  'member'
);

-- =====================================================
-- 3. 選手11名（9ポジション + 控え2名）
-- =====================================================
INSERT INTO players (id, team_id, name, number, position) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', '山田 太郎', '1',  '投'),
  ('d0000002-0000-0000-0000-000000000002', 'c3333333-3333-3333-3333-333333333333', '鈴木 一郎', '2',  '捕'),
  ('d0000003-0000-0000-0000-000000000003', 'c3333333-3333-3333-3333-333333333333', '佐藤 健太', '3',  '一'),
  ('d0000004-0000-0000-0000-000000000004', 'c3333333-3333-3333-3333-333333333333', '田中 翔太', '4',  '二'),
  ('d0000005-0000-0000-0000-000000000005', 'c3333333-3333-3333-3333-333333333333', '伊藤 大輔', '5',  '三'),
  ('d0000006-0000-0000-0000-000000000006', 'c3333333-3333-3333-3333-333333333333', '渡辺 隆志', '6',  '遊'),
  ('d0000007-0000-0000-0000-000000000007', 'c3333333-3333-3333-3333-333333333333', '高橋 拓也', '7',  '左'),
  ('d0000008-0000-0000-0000-000000000008', 'c3333333-3333-3333-3333-333333333333', '中村 優太', '8',  '中'),
  ('d0000009-0000-0000-0000-000000000009', 'c3333333-3333-3333-3333-333333333333', '小林 雅人', '9',  '右'),
  ('d0000010-0000-0000-0000-000000000010', 'c3333333-3333-3333-3333-333333333333', '加藤 秀樹', '10', NULL),
  ('d0000011-0000-0000-0000-000000000011', 'c3333333-3333-3333-3333-333333333333', '松本 直樹', '11', NULL);

-- =====================================================
-- 4. サンプル試合2件
-- =====================================================
-- 試合1: 通常ルール（DH なし）
INSERT INTO games (id, team_id, opponent_name, game_date, location, is_home, status, innings, use_dh)
VALUES (
  'e4444444-4444-4444-4444-444444444444',
  'c3333333-3333-3333-3333-333333333333',
  'サンプルジャイアンツ',
  '2026-03-01',
  '市民球場',
  true,
  'scheduled',
  9,
  false
);

-- 試合2: DH制
INSERT INTO games (id, team_id, opponent_name, game_date, location, is_home, status, innings, use_dh)
VALUES (
  'f5555555-5555-5555-5555-555555555555',
  'c3333333-3333-3333-3333-333333333333',
  'テストドラゴンズ',
  '2026-03-08',
  '中央公園グラウンド',
  false,
  'scheduled',
  9,
  true
);

-- =====================================================
-- 5. Realtime 有効化（ローカル開発用）
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE game_input_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_input_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE at_bats;
ALTER PUBLICATION supabase_realtime ADD TABLE base_runners;
ALTER PUBLICATION supabase_realtime ADD TABLE runner_events;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
