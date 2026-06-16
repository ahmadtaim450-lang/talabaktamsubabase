-- ============================================================
--  إصلاح فشل التسجيل (خطأ 500 من auth/v1/signup)
--  السبب: trigger handle_new_user كان يفشل فيُسقط التسجيل كله.
--  الحل: تحديد search_path + اسم الجدول الكامل + عدم منع التسجيل عند أي خطأ.
--  شغّله في: Supabase → SQL Editor → Run
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
exception when others then
  -- لا تمنع تسجيل المستخدم حتى لو تعذّر إنشاء ملفه الشخصي
  return new;
end;
$$;
