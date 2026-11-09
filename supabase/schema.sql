-- Run this in Supabase Dashboard → SQL Editor.
create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species text not null,
  caught_on date not null default current_date,
  location text,
  bait text,
  notes text,
  length_value numeric,
  length_unit text not null default 'in' check (length_unit in ('in','cm')),
  weight_value numeric,
  weight_unit text not null default 'lb' check (weight_unit in ('lb','kg','oz')),
  photo_path text,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.catches enable row level security;
create policy "Users can view their own catches" on public.catches for select using (auth.uid() = user_id);
create policy "Users can add their own catches" on public.catches for insert with check (auth.uid() = user_id);
create policy "Users can update their own catches" on public.catches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own catches" on public.catches for delete using (auth.uid() = user_id);

-- Private image bucket. The app uploads photos beneath the user's auth UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catch-photos','catch-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Users can upload their own catch photos" on storage.objects for insert
with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view their own catch photos" on storage.objects for select
using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own catch photos" on storage.objects for delete
using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
