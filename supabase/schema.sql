create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text default 'lobby',
  host_id uuid,
  task_count int default 3,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  name text not null,
  role text,
  is_alive boolean default true,
  color text default 'red',
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  name text not null,
  location text not null,
  description text,
  is_complete boolean default false
);

create table if not exists sabotages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  type text not null,
  status text default 'active',
  triggered_by uuid references players(id),
  triggered_at timestamptz default now()
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  type text not null,
  called_by uuid references players(id),
  reported_body uuid references players(id),
  status text default 'voting',
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  voter_id uuid references players(id),
  target_id uuid references players(id),
  created_at timestamptz default now(),
  unique(meeting_id, voter_id)
);
