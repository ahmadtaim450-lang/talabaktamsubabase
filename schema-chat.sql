-- ============================================================
--  طلبك تم — الأدوار + الدردشة (Supabase / PostgreSQL)
--  شغّله في: Supabase → SQL Editor → Run  (بعد schema.sql و schema-admin.sql)
--  الأدوار: user (مستخدم) | admin (آدمن) | manager (مدير)
-- ============================================================

-- ============================================================
--  1) الملفات الشخصية + الأدوار
-- ============================================================
create table if not exists profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'user',     -- user | admin | manager
  created_at timestamptz default now()
);
alter table profiles enable row level security;

-- إنشاء profile تلقائياً عند تسجيل أي مستخدم جديد
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- منع أي مستخدم من ترقية نفسه: تغيير الدور للمدير فقط
create or replace function protect_role()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null                                  -- يسمح بالتهيئة من SQL Editor (سياق خادم موثوق)
     and not exists (select 1 from profiles where user_id = auth.uid() and role = 'manager') then
    raise exception 'only manager can change roles';
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_role on profiles;
create trigger trg_protect_role before update on profiles
  for each row execute function protect_role();

-- ============================================================
--  2) دوال الأدوار (SECURITY DEFINER لتجنّب الرجوع اللانهائي على RLS)
-- ============================================================
create or replace function is_staff()
returns boolean language sql security definer stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role in ('admin','manager'));
$$;
create or replace function is_manager()
returns boolean language sql security definer stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'manager');
$$;
grant execute on function is_staff()  to anon, authenticated;
grant execute on function is_manager() to anon, authenticated;

-- سياسات profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (user_id = auth.uid() or is_staff());           -- المستخدم يرى ملفه، الكادر يرى الكل

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using  (user_id = auth.uid() or is_manager())
  with check (user_id = auth.uid() or is_manager());     -- تغيير الدور يحرسه trg_protect_role

-- ============================================================
--  3) المحادثات + الرسائل
-- ============================================================
create table if not exists conversations (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users on delete cascade,
  ad_id           bigint references ads on delete set null,   -- الإعلان المرتبط (سياق)
  subject         text,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now()
);
alter table conversations enable row level security;

drop policy if exists conv_select on conversations;
create policy conv_select on conversations for select
  using (user_id = auth.uid() or is_staff());

drop policy if exists conv_insert on conversations;
create policy conv_insert on conversations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists conv_update on conversations;
create policy conv_update on conversations for update
  using  (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create table if not exists messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references conversations on delete cascade,
  sender_id       uuid not null references auth.users,
  sender_role     text not null,        -- user | admin
  body            text not null,
  read            boolean default false,
  created_at      timestamptz default now()
);
alter table messages enable row level security;
create index if not exists idx_msg_conv on messages (conversation_id, created_at);

-- قراءة: صاحب المحادثة أو الكادر (يشمل المدير = اطّلاع على كل الدردشات)
drop policy if exists msg_select on messages;
create policy msg_select on messages for select using (
  exists (select 1 from conversations c
          where c.id = conversation_id and (c.user_id = auth.uid() or is_staff()))
);

-- إدخال المستخدم في محادثته فقط
drop policy if exists msg_insert_user on messages;
create policy msg_insert_user on messages for insert to authenticated with check (
  sender_id = auth.uid() and sender_role = 'user'
  and exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- إدخال الكادر (آدمن/مدير) في أي محادثة
drop policy if exists msg_insert_staff on messages;
create policy msg_insert_staff on messages for insert to authenticated with check (
  sender_id = auth.uid() and sender_role = 'admin' and is_staff()
);

-- تحديث حالة القراءة
drop policy if exists msg_update on messages;
create policy msg_update on messages for update using (
  exists (select 1 from conversations c
          where c.id = conversation_id and (c.user_id = auth.uid() or is_staff()))
);

-- تفعيل البثّ اللحظي (Realtime)
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

-- ============================================================
--  4) إصلاح أمني: تقييد إدارة الجداول على الكادر فقط
--     (كانت "to authenticated" = أي مستخدم مسجّل يقدر يعدّل/يحذف!)
-- ============================================================
do $$ begin
  if to_regclass('public.ads') is not null then
    drop policy if exists "admin_write_ads" on ads;
    create policy "staff_write_ads" on ads for all using (is_staff()) with check (is_staff());
  end if;
  if to_regclass('public.settings') is not null then
    drop policy if exists "admin_write_settings" on settings;
    create policy "staff_write_settings" on settings for all using (is_staff()) with check (is_staff());
  end if;
  if to_regclass('public.deals') is not null then
    drop policy if exists "admin_all_deals" on deals;
    create policy "staff_all_deals" on deals for all using (is_staff()) with check (is_staff());
  end if;
  if to_regclass('public.failed_deletions') is not null then
    drop policy if exists "admin_all_failed" on failed_deletions;
    create policy "staff_all_failed" on failed_deletions for all using (is_staff()) with check (is_staff());
  end if;
end $$;

-- ============================================================
--  5) التهيئة: عبّئ الملفات للمستخدمين الحاليين، واجعل حسابك مديراً
--     ⚠️ بدّل البريد أدناه ببريد حساب الآدمن/المدير الحالي
-- ============================================================
insert into profiles (user_id, email)
  select id, email from auth.users on conflict (user_id) do nothing;

update profiles set role = 'manager'
  where email = 'ahmadtaim450@gmail.com';   -- ← بدّله ببريد المدير
