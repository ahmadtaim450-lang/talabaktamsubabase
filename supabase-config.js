// ============================================================
//  إعدادات الاتصال بـ Supabase
//  استبدل القيمتين أدناه بقيم مشروعك من:
//  Supabase → Project Settings → Data API  (و)  API Keys
// ============================================================

const SUPABASE_URL = 'https://httrzeeiwfnuqooxnkwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dHJ6ZWVpd2ZudXFvb3hua3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTY2NjcsImV4cCI6MjA5NzEzMjY2N30.SWaLZNZYOTaFh8Gr00rPjXa8yYJUHkDEPqlHyjatWdY';

// إنشاء عميل الاتصال (يأتي من مكتبة supabase-js المحمّلة في index.html)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// علم تشغيل قاعدة البيانات (أُبقي بنفس الاسم للتوافق مع باقي الكود)
const USE_FIREBASE = true;
