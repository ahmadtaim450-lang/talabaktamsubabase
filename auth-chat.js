/* ============================================================
   طلبك تم — المصادقة (بريد+كلمة مرور) + الدردشة اللحظية مع الآدمن
   مستقلّ تماماً: يحقن واجهته (CSS + DOM) بنفسه.
   يعتمد على supabaseClient من supabase-config.js (محمّل قبله).
   يستبدل التواصل عبر واتساب: app.js يستدعي window.openChat(adId).
   ============================================================ */
(function () {
  'use strict';
  if (typeof supabaseClient === 'undefined') { console.error('[auth-chat] supabaseClient غير محمّل'); return; }

  var sb = supabaseClient;
  var _user = null;          // المستخدم الحالي
  var _conv = null;          // المحادثة المفتوحة
  var _channel = null;       // اشتراك Realtime
  var _pendingAdId = null;   // إعلان ننتظر الدخول لفتح دردشته
  var _pendingMsg = null;    // رسالة محجوزة (تفاصيل حجز) تُعبّأ بعد الدخول

  /* ---------- 1) حقن الأنماط ---------- */
  var css = ''
    + '.ac-overlay{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:16px}'
    + '.ac-overlay.show{display:flex}'
    + '.ac-card{background:#fff;border-radius:20px;width:100%;max-width:400px;padding:26px 22px;box-shadow:0 30px 80px rgba(0,0,0,.3);font-family:inherit;direction:rtl}'
    + '.ac-card h3{margin:0 0 4px;font-size:1.3rem;font-weight:800;color:#0f172a;text-align:center}'
    + '.ac-card p.sub{margin:0 0 18px;font-size:.85rem;color:#64748b;text-align:center}'
    + '.ac-field{margin-bottom:12px}'
    + '.ac-field label{display:block;font-size:.8rem;font-weight:700;color:#334155;margin-bottom:6px}'
    + '.ac-field input{width:100%;box-sizing:border-box;padding:13px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.95rem;font-family:inherit;outline:none;transition:border-color .15s}'
    + '.ac-field input:focus{border-color:#F6921E}'
    + '.ac-btn{width:100%;padding:14px;border:none;border-radius:12px;background:#F6921E;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;transition:opacity .15s}'
    + '.ac-btn:disabled{opacity:.6;cursor:default}'
    + '.ac-switch{margin-top:14px;text-align:center;font-size:.85rem;color:#64748b}'
    + '.ac-switch a{color:#F6921E;font-weight:700;cursor:pointer;text-decoration:none}'
    + '.ac-msg{display:none;margin:0 0 14px;padding:10px 12px;border-radius:10px;font-size:.82rem;font-weight:600;text-align:center}'
    + '.ac-msg.err{display:block;background:#fee2e2;color:#b91c1c}'
    + '.ac-msg.ok{display:block;background:#dcfce7;color:#15803d}'
    + '.ac-close{position:absolute;top:14px;left:14px;background:none;border:none;font-size:1.5rem;color:#94a3b8;cursor:pointer;line-height:1}'
    /* لوحة الدردشة */
    + '.ac-chat{position:fixed;z-index:10000;bottom:0;left:0;right:0;height:80vh;max-height:640px;background:#f8fafc;border-radius:20px 20px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.25);display:none;flex-direction:column;direction:rtl;font-family:inherit}'
    + '.ac-chat.show{display:flex}'
    + '@media(min-width:600px){.ac-chat{left:auto;width:400px;right:20px;bottom:20px;border-radius:18px;height:600px}}'
    + '.ac-chat-head{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#fff;border-bottom:1px solid #eef2f7;border-radius:20px 20px 0 0}'
    + '.ac-chat-head .t{font-weight:800;color:#0f172a;font-size:.98rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.ac-chat-head .s{font-size:.72rem;color:#16a34a;font-weight:600}'
    + '.ac-chat-head button{background:none;border:none;font-size:1.4rem;color:#94a3b8;cursor:pointer}'
    + '.ac-chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}'
    + '.ac-bubble{max-width:78%;padding:10px 13px;border-radius:14px;font-size:.9rem;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}'
    + '.ac-bubble.me{align-self:flex-start;background:#F6921E;color:#fff;border-bottom-right-radius:4px}'
    + '.ac-bubble.them{align-self:flex-end;background:#fff;color:#0f172a;border:1px solid #eef2f7;border-bottom-left-radius:4px}'
    + '.ac-bubble .time{display:block;font-size:.62rem;opacity:.7;margin-top:3px}'
    + '.ac-chat-foot{display:flex;gap:8px;padding:12px;background:#fff;border-top:1px solid #eef2f7}'
    + '.ac-chat-foot input{flex:1;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:24px;font-size:.92rem;font-family:inherit;outline:none}'
    + '.ac-chat-foot input:focus{border-color:#F6921E}'
    + '.ac-chat-foot button{flex-shrink:0;width:46px;height:46px;border-radius:50%;border:none;background:#F6921E;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center}'
    + '.ac-empty{margin:auto;text-align:center;color:#94a3b8;font-size:.85rem;padding:20px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- 2) حقن DOM ---------- */
  var authHtml = ''
    + '<div class="ac-card" style="position:relative">'
    + '  <button class="ac-close" onclick="window._acCloseAuth()">&times;</button>'
    + '  <h3 id="acTitle">تسجيل الدخول</h3>'
    + '  <p class="sub" id="acSub">سجّل دخولك لتتواصل مع الإدارة عبر الدردشة</p>'
    + '  <div class="ac-msg" id="acMsg"></div>'
    + '  <div class="ac-field" id="acNameField" style="display:none"><label>الاسم</label><input id="acName" type="text" placeholder="اسمك"></div>'
    + '  <div class="ac-field"><label>البريد الإلكتروني</label><input id="acEmail" type="email" placeholder="you@email.com" dir="ltr"></div>'
    + '  <div class="ac-field"><label>كلمة المرور</label><input id="acPass" type="password" placeholder="••••••••" dir="ltr"></div>'
    + '  <button class="ac-btn" id="acSubmit" onclick="window._acSubmit()">دخول</button>'
    + '  <div class="ac-switch" id="acSwitch">ليس لديك حساب؟ <a onclick="window._acToggle()">أنشئ حساباً</a></div>'
    + '</div>';
  var authOverlay = document.createElement('div');
  authOverlay.className = 'ac-overlay'; authOverlay.id = 'acAuthOverlay'; authOverlay.innerHTML = authHtml;
  document.body.appendChild(authOverlay);

  var chatEl = document.createElement('div');
  chatEl.className = 'ac-chat'; chatEl.id = 'acChat';
  chatEl.innerHTML = ''
    + '<div class="ac-chat-head"><div><div class="t" id="acChatTitle">الدردشة</div><div class="s">الإدارة عادةً تردّ بسرعة</div></div>'
    + '<button onclick="window._acCloseChat()">&times;</button></div>'
    + '<div class="ac-chat-body" id="acChatBody"></div>'
    + '<div class="ac-chat-foot"><input id="acChatInput" placeholder="اكتب رسالتك..." onkeydown="if(event.key===\'Enter\')window._acSend()"><button onclick="window._acSend()">&#10148;</button></div>';
  document.body.appendChild(chatEl);

  /* ---------- 3) أدوات ---------- */
  var _signupMode = false;
  function showAuthMsg(t, ok) { var m = document.getElementById('acMsg'); m.textContent = t; m.className = 'ac-msg ' + (ok ? 'ok' : 'err'); }
  function clearAuthMsg() { var m = document.getElementById('acMsg'); m.className = 'ac-msg'; m.textContent = ''; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function fmtTime(ts) { try { return new Date(ts).toLocaleString('ar', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }); } catch (e) { return ''; } }

  /* ---------- 4) المصادقة ---------- */
  window._acOpenAuth = function (adId, prefill) { _pendingAdId = adId || null; _pendingMsg = prefill || null; clearAuthMsg(); document.getElementById('acAuthOverlay').classList.add('show'); };
  window._acCloseAuth = function () { document.getElementById('acAuthOverlay').classList.remove('show'); };
  window._acToggle = function () {
    _signupMode = !_signupMode;
    document.getElementById('acTitle').textContent = _signupMode ? 'إنشاء حساب' : 'تسجيل الدخول';
    document.getElementById('acSubmit').textContent = _signupMode ? 'إنشاء الحساب' : 'دخول';
    document.getElementById('acNameField').style.display = _signupMode ? 'block' : 'none';
    document.getElementById('acSwitch').innerHTML = _signupMode
      ? 'لديك حساب؟ <a onclick="window._acToggle()">سجّل الدخول</a>'
      : 'ليس لديك حساب؟ <a onclick="window._acToggle()">أنشئ حساباً</a>';
    clearAuthMsg();
  };

  window._acSubmit = async function () {
    // تنظيف البريد من الأحرف الخفيّة (علامات اتجاه RTL / مسافات صفرية) ثم توحيده
    var email = document.getElementById('acEmail').value
      .replace(/[​-\u200F\u202A-\u202E\u2066-\u2069﻿]/g, '')
      .trim().toLowerCase();
    var pass = document.getElementById('acPass').value;
    var name = document.getElementById('acName').value.trim();
    if (!email || !pass) { showAuthMsg('أدخل البريد وكلمة المرور'); return; }
    var btn = document.getElementById('acSubmit'); btn.disabled = true; var lbl = btn.textContent; btn.textContent = 'جارٍ...';
    try {
      if (_signupMode) {
        var r = await sb.auth.signUp({ email: email, password: pass, options: { data: { full_name: name } } });
        if (r.error) throw r.error;
        if (!r.data.session) { showAuthMsg('تم الإنشاء! تحقّق من بريدك لتفعيل الحساب ثم سجّل الدخول.', true); _signupMode = false; }
        else { onLoggedIn(r.data.user); }
      } else {
        var r2 = await sb.auth.signInWithPassword({ email: email, password: pass });
        if (r2.error) throw r2.error;
        onLoggedIn(r2.data.user);
      }
    } catch (e) {
      console.error('[auth-chat] login/signup error:', e);
      var c = (e && (e.message || e.error_description || e.msg)) || '';
      var code = (e && (e.code || e.status)) || '';
      if (/Invalid login/i.test(c)) showAuthMsg('البريد أو كلمة المرور غير صحيحة');
      else if (/Email not confirmed/i.test(c)) showAuthMsg('بريدك غير مفعّل — افتح رابط التفعيل في إيميلك، أو أطفئ "Confirm email" في Supabase.');
      else if (/already registered|already exists/i.test(c)) showAuthMsg('هذا البريد مسجّل مسبقاً — سجّل الدخول');
      else if (/at least 6/i.test(c)) showAuthMsg('كلمة المرور يجب ألا تقل عن 6 أحرف');
      else if (!c || /fetch|network|load failed/i.test(c)) showAuthMsg('تعذّر الاتصال بالخادم. امسح كاش الموقع وألغِ تسجيل Service Worker القديم ثم أعد المحاولة.');
      else showAuthMsg('تعذّر: ' + c + (code ? ' (' + code + ')' : ''));
    } finally { btn.disabled = false; btn.textContent = lbl; }
  };

  function onLoggedIn(user) {
    _user = user;
    window._acCloseAuth();
    if (_pendingAdId != null) { var id = _pendingAdId; var msg = _pendingMsg; _pendingAdId = null; _pendingMsg = null; openChat(id, msg); }
  }

  window._acLogout = async function () { await sb.auth.signOut(); _user = null; window._acCloseChat(); };

  /* ---------- 5) الدردشة ---------- */
  async function getOrCreateConversation(adId) {
    // ابحث عن محادثة قائمة لنفس المستخدم والإعلان
    var q = sb.from('conversations').select('*').eq('user_id', _user.id);
    if (adId != null) q = q.eq('ad_id', adId);
    var found = await q.order('id', { ascending: false }).limit(1);
    if (found.data && found.data.length) return found.data[0];
    // أنشئ جديدة
    var subj = '';
    try { var l = (window.listings || []).find(function (x) { return String(x.id) === String(adId); }); subj = l ? (l.title || '') : ''; } catch (e) {}
    var uname = (_user.user_metadata && _user.user_metadata.full_name) || '';
    var ins = await sb.from('conversations').insert({ user_id: _user.id, ad_id: adId != null ? adId : null, subject: subj, user_email: _user.email || '', user_name: uname }).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  }

  function renderMessage(m) {
    var body = document.getElementById('acChatBody');
    var div = document.createElement('div');
    div.className = 'ac-bubble ' + (m.sender_role === 'user' ? 'me' : 'them');
    div.innerHTML = esc(m.body) + '<span class="time">' + fmtTime(m.created_at) + '</span>';
    body.appendChild(div); body.scrollTop = body.scrollHeight;
  }

  async function loadMessages(convId) {
    var body = document.getElementById('acChatBody'); body.innerHTML = '';
    var r = await sb.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (r.error) { body.innerHTML = '<div class="ac-empty">تعذّر تحميل الرسائل</div>'; return; }
    if (!r.data.length) { body.innerHTML = '<div class="ac-empty">ابدأ المحادثة — اكتب رسالتك بالأسفل 👇</div>'; }
    else r.data.forEach(renderMessage);
  }

  function subscribe(convId) {
    if (_channel) { sb.removeChannel(_channel); _channel = null; }
    _channel = sb.channel('ac-msgs-' + convId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId },
        function (payload) {
          var m = payload.new;
          if (m.sender_role === 'user' && m.sender_id === _user.id) return; // رسالتي معروضة مسبقاً
          var empty = document.querySelector('#acChatBody .ac-empty'); if (empty) empty.remove();
          renderMessage(m);
        })
      .subscribe();
  }

  window.openChat = async function (adId, prefill) {
    // تأكّد من الجلسة
    if (!_user) { var s = await sb.auth.getUser(); _user = s.data ? s.data.user : null; }
    if (!_user) { window._acOpenAuth(adId, prefill); return; }
    try {
      _conv = await getOrCreateConversation(adId);
      var title = _conv.subject ? ('بخصوص: ' + _conv.subject) : 'الدردشة مع الإدارة';
      document.getElementById('acChatTitle').textContent = title;
      document.getElementById('acChat').classList.add('show');
      await loadMessages(_conv.id);
      subscribe(_conv.id);
      if (prefill) { document.getElementById('acChatInput').value = prefill; }
      setTimeout(function () { document.getElementById('acChatInput').focus(); }, 100);
    } catch (e) { alert('تعذّر فتح الدردشة: ' + ((e && e.message) || '')); }
  };

  window._acCloseChat = function () {
    document.getElementById('acChat').classList.remove('show');
    if (_channel) { sb.removeChannel(_channel); _channel = null; }
    _conv = null;
  };

  window._acSend = async function () {
    var inp = document.getElementById('acChatInput'); var text = inp.value.trim();
    if (!text || !_conv || !_user) return;
    inp.value = '';
    renderMessage({ sender_role: 'user', body: text, created_at: new Date().toISOString() });
    var empty = document.querySelector('#acChatBody .ac-empty'); if (empty) empty.remove();
    var r = await sb.from('messages').insert({ conversation_id: _conv.id, sender_id: _user.id, sender_role: 'user', body: text });
    if (r.error) { alert('تعذّر الإرسال: ' + r.error.message); return; }
    sb.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', _conv.id).then(function () {});
  };

  /* ---------- 6) تتبّع حالة الجلسة ---------- */
  sb.auth.getUser().then(function (s) { _user = s.data ? s.data.user : null; });
  sb.auth.onAuthStateChange(function (_e, session) { _user = session ? session.user : null; });
})();
