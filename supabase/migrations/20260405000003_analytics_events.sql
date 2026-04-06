create table if not exists analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_name  text not null,
  properties  jsonb default '{}',
  occurred_at timestamptz default now()
);

create index if not exists analytics_events_name_idx on analytics_events (event_name);
create index if not exists analytics_events_time_idx on analytics_events (occurred_at desc);
