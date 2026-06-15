-- ============================================================
--  طلبك تم — مخطّط قاعدة البيانات على Supabase (PostgreSQL)
--  انسخ كامل هذا الملف والصقه في: Supabase → SQL Editor → Run
-- ============================================================

-- ===== جدول الإعلانات =====
create table if not exists ads (
  id           bigint generated always as identity primary key,
  ref          text,                       -- رقم مرجعي للإعلان
  category     text not null,              -- القسم (apt-rent, car-sale ...)
  type         text,                       -- النوع (apartment, car, equipment, free)
  action       text,                       -- rent / sale
  title        text not null,              -- العنوان
  description  text,                        -- الوصف
  price        numeric default 0,          -- السعر
  negotiable   boolean default false,      -- قابل للتفاوض
  featured     boolean default false,      -- إعلان مميّز
  status       text default 'active',      -- active / hidden / sold

  -- الموقع
  city         text,
  neighborhood text,
  location     text,
  phone        text,

  -- الصور (مصفوفة روابط Cloudinary + معرّفاتها)
  images       jsonb default '[]'::jsonb,
  image_ids    jsonb default '[]'::jsonb,

  -- حقول العقارات
  rooms        int,
  baths        int,
  area         numeric,
  kitchens     int,
  balconies    int,
  living       int,
  storage      int,

  -- حقول السيارات
  car_type     text,
  car_model    text,
  car_year     int,
  car_km       int,
  car_color    text,
  car_class    text,

  -- الإعلانات المجانية (مهن وخدمات)
  profession   text,

  views        int default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- فهارس لتسريع الفلاتر الشائعة
create index if not exists idx_ads_status   on ads (status);
create index if not exists idx_ads_category on ads (category);
create index if not exists idx_ads_type     on ads (type);

-- بحث نصّي عربي سريع على العنوان والوصف
create index if not exists idx_ads_search
  on ads using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ============================================================
--  الأمان: Row Level Security (يكافئ "قواعد Firestore")
-- ============================================================
alter table ads enable row level security;

-- أي زائر يستطيع قراءة الإعلانات النشطة فقط
create policy "public_read_active_ads"
  on ads for select
  using (status = 'active');

-- الكتابة/التعديل/الحذف للمستخدمين المسجّلين فقط (الأدمن)
create policy "admin_write_ads"
  on ads for all
  to authenticated
  using (true)
  with check (true);


-- ============================================================
--  جدول الإعدادات (للتواريخ المحجوزة في تقويم الحجز)
-- ============================================================
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


-- ============================================================
--  دالة عدّ المشاهدات (تسمح للزوّار بزيادة العدّاد بأمان)
--  SECURITY DEFINER تتجاوز RLS لتحديث عمود views فقط
-- ============================================================
create or replace function increment_views(ad_id bigint)
returns void
language sql
security definer
as $$
  update ads set views = coalesce(views, 0) + 1 where id = ad_id;
$$;

grant execute on function increment_views(bigint) to anon, authenticated;
