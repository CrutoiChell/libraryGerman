-- 0001_init.sql
-- Initial schema for the Online Library Catalog.
-- Creates the books, profiles, and bookmarks tables, supporting indexes,
-- the user_role enum, and the auth.users -> profiles trigger.

-- Required extensions
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- gin_trgm_ops indexes

-- books
create table public.books (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  author        text not null check (length(trim(author)) > 0),
  description   text not null default '',
  genre         text not null check (length(trim(genre)) > 0),
  cover_url     text not null check (cover_url ~ '^https?://'),
  external_link text not null check (external_link ~ '^https?://'),
  created_at    timestamptz not null default now()
);
create index books_genre_idx on public.books (genre);
create index books_title_trgm on public.books using gin (title gin_trgm_ops);
create index books_author_trgm on public.books using gin (author gin_trgm_ops);

-- profiles (1-1 with auth.users)
create type user_role as enum ('admin', 'user');
create table public.profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role  user_role not null default 'user'
);

-- trigger: create profile on new auth.users row
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- bookmarks
create table public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index bookmarks_user_idx on public.bookmarks (user_id);
