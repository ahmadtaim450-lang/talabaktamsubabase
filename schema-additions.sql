-- ============================================================
--  إضافات لاحقة — شغّلها في SQL Editor بعد الجدول الأساسي
--  (جدول الإعدادات + دالة عدّ المشاهدات)
-- ============================================================

-- جدول الإعدادات (للتواريخ المحجوزة في تقويم الحجز)
create table if not exists settings (
  key   text primary key,
  data  jsonb default '{}'::jsonb
);
alter table settings enable row level security;

create policy "public_read_settings"
  on settings for select using (true);

create policy "admin_write_settings"
  on settings for all
  to authenticated using (true) with check (true);


-- دالة عدّ المشاهدات (تسمح للزوّار بزيادة العدّاد بأمان)
create or replace function increment_views(ad_id bigint)
returns void
language sql
security definer
as $$
  update ads set views = coalesce(views, 0) + 1 where id = ad_id;
$$;

grant execute on function increment_views(bigint) to anon, authenticated;
