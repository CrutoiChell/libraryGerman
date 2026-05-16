-- 0003_storage.sql
-- Provision the `covers` Supabase Storage bucket and the RLS policies
-- on `storage.objects` that govern who can read and write its contents.
--
-- - The bucket is public-read so book covers can be served via the
--   `getPublicUrl` URL on every device without an auth round-trip.
-- - Only admins can insert / update / delete objects in the bucket.
--   Authenticated non-admins (regular users) and visitors cannot
--   upload, mirroring the `books admin write` policy on
--   `public.books`.
--
-- The policies are dropped first so this migration is safe to re-run.

-- Create the bucket if it doesn't exist. `public = true` makes the
-- objects readable through the public URL; writes still require an
-- INSERT/UPDATE/DELETE policy on storage.objects (below).
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Drop existing policies so the migration is idempotent.
drop policy if exists "covers public read"  on storage.objects;
drop policy if exists "covers admin write"  on storage.objects;

-- Public read: anyone can SELECT objects in the covers bucket.
create policy "covers public read" on storage.objects
  for select using (bucket_id = 'covers');

-- Admin write: only profiles with role = 'admin' can INSERT, UPDATE,
-- or DELETE objects in the covers bucket.
create policy "covers admin write" on storage.objects
  for all
  using (
    bucket_id = 'covers'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    bucket_id = 'covers'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
