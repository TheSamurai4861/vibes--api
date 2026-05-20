-- Vibes API schema (run in Supabase SQL editor)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  taste_genres text[] default '{}',
  taste_artist_ids bigint[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  music_item_id text not null,
  music_type text not null check (music_type in ('track', 'album')),
  score smallint not null check (score >= 1 and score <= 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, music_item_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  music_item_id text not null,
  body text not null,
  likes_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.review_likes (
  review_id uuid references public.reviews(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (review_id, user_id)
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  music_item_id text not null,
  music_type text not null,
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists public.listen_later (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  music_item_id text not null,
  music_type text not null,
  created_at timestamptz default now(),
  unique (user_id, music_item_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  music_item_id text not null,
  music_type text not null,
  message text,
  created_at timestamptz default now()
);

create index if not exists idx_ratings_music on public.ratings(music_item_id);
create index if not exists idx_reviews_music on public.reviews(music_item_id);
create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_following on public.follows(following_id);

alter table public.profiles enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;

create policy "Public profiles read" on public.profiles for select using (true);
create policy "Own profile update" on public.profiles for update using (auth.uid() = id);

create policy "Public ratings read" on public.ratings for select using (true);
create policy "Own ratings write" on public.ratings for all using (auth.uid() = user_id);

create policy "Public reviews read" on public.reviews for select using (true);
create policy "Own reviews write" on public.reviews for all using (auth.uid() = user_id);

create policy "Own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile when a user signs up (email/OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  uname := lower(regexp_replace(uname, '[^a-z0-9_]', '', 'g'));
  if uname = '' then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
