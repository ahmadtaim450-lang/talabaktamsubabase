-- ============================================================
--  تجهيز صندوق وارد الأدمن — شغّله في SQL Editor
-- ============================================================

-- 1) تأكيد أن حساب المدير له ملف بدور manager (لتمرير is_staff)
insert into profiles (user_id, email, role)
  select id, email, 'manager' from auth.users where email = 'ahmadtaim450@gmail.com'
  on conflict (user_id) do update set role = 'manager';

-- 2) حقول معلومات الزائر داخل المحادثة (لعرض من يكتب في صندوق الوارد)
alter table conversations add column if not exists user_name  text;
alter table conversations add column if not exists user_email text;
