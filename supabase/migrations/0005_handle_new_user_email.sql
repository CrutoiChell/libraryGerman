-- Safer profile row on signup: coalesce email from auth metadata.
create or replace function public.handle_new_user() returns trigger as $$
declare
  user_email text;
begin
  user_email := coalesce(
    nullif(trim(new.email), ''),
    nullif(trim(new.raw_user_meta_data->>'email'), '')
  );
  if user_email is null then
    raise exception 'signup missing email on auth.users row';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, user_email, 'user')
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$ language plpgsql security definer;
