-- ============================================================
--  جداول لوحة الأدمن — شغّلها في SQL Editor
--  (الصفقات + سجل الصور التي فشل حذفها)
-- ============================================================

-- جدول الصفقات
create table if not exists deals (
  id          bigint primary key,
  data        jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);
alter table deals enable row level security;
create policy "admin_all_deals"
  on deals for all
  to authenticated using (true) with check (true);

-- جدول الصور التي فشل حذفها من Cloudinary (للمتابعة لاحقاً)
create table if not exists failed_deletions (
  id          bigint generated always as identity primary key,
  public_id   text,
  ad_id       text,
  resolved    boolean default false,
  failed_at   timestamptz default now()
);
alter table failed_deletions enable row level security;
create policy "admin_all_failed"
  on failed_deletions for all
  to authenticated using (true) with check (true);
