/* =====================================================================
   Viper OS — supabase.js
   Turns the app multi-user & multi-device. Loaded LAST.
   Design: the app stays fully synchronous and renders from the in-memory
   Store exactly as before. This layer (a) authenticates, (b) hydrates the
   Store from the cloud on sign-in, (c) mirrors every save() up as a diff,
   (d) subscribes to realtime so other devices' changes stream in, and
   (e) stores progress photos in Supabase Storage.
   If Supabase isn't configured or reachable, the app silently runs on
   localStorage exactly as it does today — nothing breaks.
   ===================================================================== */
(function (global) {
  'use strict';
  var App = global.App, Store = global.Store;
  if (!App || !Store) return;

  var URL = global.SUPABASE_URL, KEY = global.SUPABASE_ANON_KEY;
  var lib = global.supabase; // from the @supabase/supabase-js CDN
  if (!URL || !KEY || !lib || !lib.createClient) {
    if (global.console) console.info('[Viper OS] Supabase not configured — running on local storage.');
    return; // → app behaves exactly as before
  }

  var sb = lib.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var SB = { client: sb, enabled: true, ready: false };
  global.SB = SB;

  var TABLES = ['team', 'contacts', 'deals', 'jobs', 'estimates', 'invoices', 'tasks', 'conversations', 'automations', 'templates', 'catalog', 'requests', 'timesheets', 'outbox'];
  var META = ['settings', 'counters'];

  /* ---------------- launch: gate on auth, then hydrate --------------- */
  var origLaunch = App.launch;
  App.launch = function () { bootstrap(); };

  async function bootstrap() {
    try {
      var res = await sb.auth.getSession();
      var session = res && res.data && res.data.session;
      if (!session) { openAuth(); return; }
      await onSignedIn(session);
    } catch (e) { console.warn('[Viper OS] auth check failed, using local', e); origLaunch(); }
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_IN' && session && !SB.ready) onSignedIn(session);
    if (event === 'SIGNED_OUT') { SB.ready = false; }
  });

  async function onSignedIn(session) {
    var who = await resolveRole(session.user);
    App.session = who;
    try { localStorage.setItem('viper-os.session', JSON.stringify(who)); } catch (e) {}
    await hydrate();
    subscribe();
    closeAuth();
    origLaunch();     // renders owner/field/portal; boot() sets Store.onChange (badges)
    hookSync();       // wrap the *final* onChange so our sync survives boot
    if (who.role === 'owner' && who._defaulted) {
      setTimeout(function () { App.toast && App.toast('Signed in. Add a profile row to set your role — see setup guide.', 'info'); }, 800);
    }
  }

  async function resolveRole(user) {
    try {
      var r = await sb.from('profiles').select('role,member_id,contact_id').eq('id', user.id).maybeSingle();
      if (r && r.data) return { role: r.data.role, userId: r.data.member_id || r.data.contact_id || 'u_owner', authId: user.id };
    } catch (e) {}
    // no profile yet → treat as owner so you're never locked out of your own tool
    return { role: 'owner', userId: 'u_owner', authId: user.id, _defaulted: true };
  }

  /* ---------------- hydrate from cloud ------------------------------ */
  async function hydrate() {
    var st = Store.state();
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i];
      try {
        var res = await sb.from(t).select('id,data');
        if (res && !res.error && res.data) st[t] = res.data.map(function (row) { return row.data; });
      } catch (e) {}
    }
    try {
      var m = await sb.from('meta').select('key,data');
      if (m && m.data) m.data.forEach(function (row) { if (row.data) st[row.key] = row.data; });
    } catch (e) {}
    SB.ready = true;
    snap();               // baseline snapshot so first save() diffs correctly
  }

  /* ---------------- diff-sync on every save() ----------------------- */
  var snapshot = {};
  function snap() {
    var st = Store.state();
    TABLES.forEach(function (t) { snapshot[t] = {}; (st[t] || []).forEach(function (r) { snapshot[t][r.id] = JSON.stringify(r); }); });
    META.forEach(function (k) { snapshot['meta:' + k] = JSON.stringify(st[k] || null); });
  }
  var flushTimer = null, applyingRealtime = false;
  function queueSync() { if (!SB.ready || applyingRealtime) return; clearTimeout(flushTimer); flushTimer = setTimeout(flush, 500); }
  function hookSync() {
    var prev = Store.onChange;
    Store.onChange = function () { try { prev && prev(); } catch (e) {} queueSync(); };
  }
  async function flush() {
    var st = Store.state();
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i];
      var cur = {}; (st[t] || []).forEach(function (r) { cur[r.id] = r; });
      var ups = [], dels = [];
      for (var id in cur) { var js = JSON.stringify(cur[id]); if (snapshot[t][id] !== js) ups.push({ id: id, data: cur[id], updated_at: new Date().toISOString() }); }
      for (var oid in snapshot[t]) { if (!(oid in cur)) dels.push(oid); }
      try {
        if (ups.length) await sb.from(t).upsert(ups);
        if (dels.length) await sb.from(t).delete().in('id', dels);
      } catch (e) { console.warn('[Viper OS] sync', t, e); }
    }
    for (var j = 0; j < META.length; j++) {
      var k = META[j]; var v = JSON.stringify(st[k] || null);
      if (snapshot['meta:' + k] !== v) { try { await sb.from('meta').upsert({ key: k, data: st[k], updated_at: new Date().toISOString() }); } catch (e) {} }
    }
    snap();
  }

  /* ---------------- realtime: stream others' changes in ------------- */
  function subscribe() {
    TABLES.forEach(function (t) {
      sb.channel('vos-' + t).on('postgres_changes', { event: '*', schema: 'public', table: t }, function (payload) {
        var st = Store.state(); st[t] = st[t] || [];
        applyingRealtime = true;
        try {
          if (payload.eventType === 'DELETE') {
            var oid = payload.old && payload.old.id;
            st[t] = st[t].filter(function (r) { return r.id !== oid; });
            if (snapshot[t]) delete snapshot[t][oid];
          } else {
            var row = payload.new && payload.new.data; if (row) {
              var idx = st[t].findIndex(function (r) { return r.id === row.id; });
              if (idx >= 0) st[t][idx] = row; else st[t].unshift(row);
              if (snapshot[t]) snapshot[t][row.id] = JSON.stringify(row);
            }
          }
        } catch (e) {}
        applyingRealtime = false;
        rerender();
      }).subscribe();
    });
    sb.channel('vos-meta').on('postgres_changes', { event: '*', schema: 'public', table: 'meta' }, function (payload) {
      var row = payload.new; if (row && row.key) { Store.state()[row.key] = row.data; snapshot['meta:' + row.key] = JSON.stringify(row.data); rerender(); }
    }).subscribe();
  }
  var rrTimer = null;
  function rerender() {
    clearTimeout(rrTimer);
    rrTimer = setTimeout(function () {
      try {
        if (document.body.classList.contains('mode-field') && App._Field) App._Field.go(App._Field.state.screen);
        else if (document.body.classList.contains('mode-portal') && App._Portal) App._Portal.go(App._Portal.state.screen);
        else if (App.refresh) App.refresh();
      } catch (e) {}
    }, 120);
  }

  /* ---------------- photos → Supabase Storage ----------------------- */
  function dataURLtoBlob(dataUrl) {
    var parts = dataUrl.split(','), mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
    if (parts[0].indexOf('base64') >= 0) {
      var bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
      while (n--) arr[n] = bin.charCodeAt(n);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(parts[1])], { type: mime });
  }
  var origAddPhoto = App._addJobPhoto;
  if (origAddPhoto) App._addJobPhoto = function (id, url, caption) {
    if (SB.ready && typeof url === 'string' && url.indexOf('data:') === 0) {
      var path = id + '/' + Date.now() + '.' + (url.indexOf('svg') >= 0 ? 'svg' : 'png');
      sb.storage.from('job-photos').upload(path, dataURLtoBlob(url), { contentType: url.indexOf('svg') >= 0 ? 'image/svg+xml' : 'image/png', upsert: true })
        .then(function () { var pub = sb.storage.from('job-photos').getPublicUrl(path); origAddPhoto(id, (pub && pub.data && pub.data.publicUrl) || url, caption); if (App._Field) App._Field.go('job', id); })
        .catch(function () { origAddPhoto(id, url, caption); });
    } else origAddPhoto(id, url, caption);
  };

  /* ---------------- AUTH SCREEN ------------------------------------- */
function authHTML() {
  var name = 'Viper Electric';
  try { name = Store.state().settings.business.name; } catch (e) {}
  return '<div class="login-panel auth-panel">' +
    '<div class="login-head"><div class="login-mark">' + App.icon('bolt') + '</div><div><div class="login-title">' + name + ' OS</div><div class="login-sub">Sign in to your workspace</div></div></div>' +
    '<div class="auth-tabs"><button class="auth-tab on" data-action="sb-tab" data-tab="staff">Staff</button><button class="auth-tab" data-action="sb-tab" data-tab="customer">Customer</button></div>' +
    '<div class="auth-body" id="auth-staff">' +
      '<label class="field"><span class="field-label">Email</span><input class="inp" id="sb-email" type="email" placeholder="jacob.pope@outlook.com"></label>' +
      '<label class="field"><span class="field-label">Password</span><input class="inp" id="sb-pass" type="password" placeholder="••••••••"></label>' +
      '<div class="mt12">' + App._ui.btn('Sign in', { variant: 'brand', block: true, action: 'sb-staff-login' }) + '</div>' +
      '<div class="auth-alt" id="sb-msg"></div>' +
    '</div>' +
    '<div class="auth-body" id="auth-customer" style="display:none">' +
      '<label class="field"><span class="field-label">Your email</span><input class="inp" id="sb-cemail" type="email" placeholder="you@email.com"></label>' +
      '<p class="muted" style="font-size:12.5px">We\'ll email you a secure sign-in link.</p>' +
      '<div class="mt12">' + App._ui.btn('Email me a link', { variant: 'brand', block: true, icon: 'mail', action: 'sb-magic' }) + '</div>' +
      '<div class="auth-alt" id="sb-cmsg"></div>' +
    '</div>' +
    '<div class="login-foot">Trouble? <button class="login-link" data-action="sb-offline">Use offline demo</button></div>' +
  '</div>';
}

function openAuth() {
  var el = document.getElementById('login-screen') || document.createElement('div');
  el.id = 'login-screen';
  document.body.appendChild(el);
  el.innerHTML = authHTML();
  el.classList.add('open');
  document.body.classList.add('login-open');
}
function closeAuth() {
  var el = document.getElementById('login-screen');
  if (el) { el.classList.remove('open'); el.innerHTML = ''; }
  document.body.classList.remove('login-open');
}

App.actions['sb-tab'] = function (el, d) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('on', t.getAttribute('data-tab') === d.tab));
  document.getElementById('auth-staff').style.display = d.tab === 'staff' ? '' : 'none';
  document.getElementById('auth-customer').style.display = d.tab === 'customer' ? '' : 'none';
};

App.actions['sb-staff-login'] = async function () {
  const email = (document.getElementById('sb-email').value || '').trim();
  const pass = document.getElementById('sb-pass').value || '';
  const msg = document.getElementById('sb-msg');
  msg.textContent = 'Signing in…';
  msg.classList.remove('err');

  try {
    const { data, error } = await SB.client.auth.signInWithPassword({ email, password: pass });
    if (error) {
      msg.textContent = error.message;
      msg.classList.add('err');
    } else {
      msg.textContent = 'Success!';
    }
  } catch (e) {
    msg.textContent = 'Network error';
    msg.classList.add('err');
    console.error(e);
  }
};

App.actions['sb-magic'] = function () { /* similar for magic link */ };
App.actions['sb-offline'] = function () {
  SB.ready = false;
  closeAuth();
  App.actions['open-login'] && App.actions['open-login']();
};
// =============================================
// PRODUCTION IMPROVEMENTS
// =============================================

App.actions['sb-staff-login'] = async function () {
  const email = (document.getElementById('sb-email').value || '').trim();
  const pass = document.getElementById('sb-pass').value || '';
  const msg = document.getElementById('sb-msg');
  if (msg) msg.textContent = 'Signing in...';

  try {
    const { data, error } = await SB.client.auth.signInWithPassword({ email, password: pass });
    if (error) {
      if (msg) {
        msg.textContent = error.message;
        msg.classList.add('err');
      }
    }
  } catch (e) {
    if (msg) msg.textContent = 'Connection error';
  }
};

// Auto refresh session
sb.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') console.log('✅ Session refreshed');
});
