create table if not exists public.calendar_events (
  id bigint primary key,
  date text not null,
  end_date text not null,
  time text not null,
  title text not null,
  importance smallint not null check (importance in (1, 2, 3)),
  memo text not null default '',
  author_username text,
  author_profile text check (author_profile in ('boyfriend', 'girlfriend')),
  participant_profiles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events
add column if not exists end_date text;

update public.calendar_events
set end_date = date
where end_date is null;

alter table public.calendar_events
alter column end_date set not null;

create table if not exists public.bucket_items (
  id bigint primary key,
  text text not null,
  status text not null check (status in ('pending', 'ready', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manner_reviews (
  id bigint primary key,
  author_profile text not null check (author_profile in ('boyfriend', 'girlfriend')),
  target_profile text not null check (target_profile in ('boyfriend', 'girlfriend')),
  rating smallint not null check (rating in (1, 2, 3, 4, 5)),
  strengths text not null,
  improvements text not null default '',
  status text not null default 'open' check (status in ('open', 'requested', 'improved')),
  created_at timestamptz not null default now(),
  improvement_requested_at timestamptz,
  improvement_confirmed_at timestamptz,
  check (author_profile <> target_profile)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists set_bucket_items_updated_at on public.bucket_items;
create trigger set_bucket_items_updated_at
before update on public.bucket_items
for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
alter table public.bucket_items enable row level security;
alter table public.manner_reviews enable row level security;

drop policy if exists "couple can manage calendar events" on public.calendar_events;
create policy "couple can manage calendar events"
on public.calendar_events
for all
to authenticated
using (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
)
with check (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
);

drop policy if exists "couple can manage bucket items" on public.bucket_items;
create policy "couple can manage bucket items"
on public.bucket_items
for all
to authenticated
using (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
)
with check (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
);

drop policy if exists "couple can manage manner reviews" on public.manner_reviews;
create policy "couple can manage manner reviews"
on public.manner_reviews
for all
to authenticated
using (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
)
with check (
  (select auth.jwt() ->> 'email') in (
    'taejun0214@couple.local',
    'yeongjoo0214@couple.local'
  )
);
