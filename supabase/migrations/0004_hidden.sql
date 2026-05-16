-- 0004_hidden.sql
-- Adds a `hidden` flag to public.books so admins can hide imported /
-- seed books from the public catalog without deleting them.
--
-- A partial index speeds up the public read path (the most common
-- query restricts to `hidden = false`). The existing `books read`
-- SELECT policy is replaced so non-admins only see visible rows
-- while admins still see everything (used by the admin panel).

alter table public.books
  add column if not exists hidden boolean not null default false;

create index if not exists books_hidden_idx
  on public.books (hidden)
  where hidden = false;

drop policy if exists "books read" on public.books;

create policy "books read" on public.books for select
  using (
    hidden = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
