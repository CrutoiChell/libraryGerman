-- 0002_rls.sql
-- Row Level Security policies for the Online Library Catalog.
-- Enables RLS on books, profiles, and bookmarks, and adds the policies
-- defined in design.md "Row Level Security Policies":
--   - books: anyone can read; only admins can write
--   - profiles: a user can read their own profile; admins can read all
--   - bookmarks: a user can CRUD only their own bookmarks

alter table public.books enable row level security;
alter table public.profiles enable row level security;
alter table public.bookmarks enable row level security;

-- books: anyone can read; only admins can write
create policy "books read" on public.books for select using (true);
create policy "books admin write" on public.books for all
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

-- profiles: user can read own profile; admins can read all
create policy "profile self read" on public.profiles for select
  using (id = auth.uid()
         or exists (select 1 from public.profiles p
                    where p.id = auth.uid() and p.role = 'admin'));

-- bookmarks: user can CRUD their own bookmarks
create policy "bookmark self read" on public.bookmarks for select
  using (user_id = auth.uid());
create policy "bookmark self write" on public.bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
