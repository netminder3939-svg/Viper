/* =====================================================================
   Viper OS — grow.js
   Phase 1 pillars that are safe + additive:
     • Services & Upgrades — the upsell system (toggle managed services,
       track monthly recurring revenue).
     • Brand Studio — accent color, favicon, dashboard welcome, login
       tagline, applied live across the app.
   ===================================================================== */
(function (global) {
  'use strict';
  var App = global.App, Store = global.Store;
  if (!App || !Store) return;
  var f = App._fmt, ui = App._ui, icon = App.icon;
  var money = f.money, esc = f.esc;
  var btn = ui.btn, pill = ui.pill;
  var A = App.actions, V = App.views;
  function card(inner, cls) { return '<div class="card ' + (cls || '') + '">' + inner + '</div>'; }
  function field(label, inner) { return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</label>'; }

  /* ---------------- apply branding live ----------------------------- */
  function applyBranding() {
    try {
      var b = Store.state().settings.branding;
      var root = document.documentElement.style;
      if (b.primary) root.setProperty('--brand', b.primary);
      if (b.accent) root.setProperty('--volt', b.accent);
      // favicon
      if (b.favicon) {
        var link = document.querySelector('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = b.favicon;
      }
    } catch (e) {}
  }
  App._applyBranding = applyBranding;
  // apply on load + after any settings save
  applyBranding();
  var prevOnChange = Store.onChange;
  Store.onChange = function () { try { prevOnChange && prevOnChange(); } catch (e) {} applyBranding(); };

  /* ---------------- SERVICES & UPGRADES (upsell) -------------------- */
  V.services = {
    render: function () {
      var svcs = Store.state().settings.services || [];
      var active = svcs.filter(function (s) { return s.active; });
      var mrr = Store.mrr();
      var potential = svcs.reduce(function (t, s) { return t + (s.price || 0); }, 0);
      var hero = '<div class="dash-hero"><div class="hero rise"><div class="hero-glow"></div>' +
        '<div class="hero-top"><span class="hero-label mono">MONTHLY RECURRING REVENUE</span><span class="live"><span class="live-dot"></span>' + active.length + ' ACTIVE</span></div>' +
        '<div class="hero-num mono">' + money(mrr) + '<span style="font-size:16px;opacity:.7">/mo</span></div>' +
        '<div class="hero-foot"><span class="delta up">' + icon('trend') + ' ' + money(potential - mrr) + '/mo available to upsell</span></div></div>' +
        '<div class="hero-side rise">' +
          '<div class="hs-item"><div class="hs-ic stat-green">' + icon('coins') + '</div><div><div class="hs-val mono">' + money(mrr * 12) + '</div><div class="hs-lbl">Annualized recurring</div></div></div>' +
          '<div class="hs-item"><div class="hs-ic stat-indigo">' + icon('layers') + '</div><div><div class="hs-val mono">' + active.length + ' / ' + svcs.length + '</div><div class="hs-lbl">Services active</div></div></div>' +
          '<div class="hs-item"><div class="hs-ic stat-amber">' + icon('target') + '</div><div><div class="hs-val mono">' + money(potential) + '</div><div class="hs-lbl">Full-stack potential /mo</div></div></div>' +
        '</div></div>';
      var cats = {};
      svcs.forEach(function (s) { (cats[s.category] = cats[s.category] || []).push(s); });
      var grid = Object.keys(cats).map(function (cat) {
        return '<div class="svc-cat-label mono rise">' + esc(cat) + '</div><div class="svc-grid">' + cats[cat].map(function (s) {
          return '<div class="svc-card' + (s.active ? ' on' : '') + ' rise">' +
            '<div class="svc-top"><div class="svc-name">' + esc(s.name) + '</div>' +
            '<label class="switch"><input type="checkbox" ' + (s.active ? 'checked' : '') + ' data-action="toggle-service" data-id="' + s.id + '"><span class="slider"></span></label></div>' +
            '<div class="svc-desc">' + esc(s.desc) + '</div>' +
            '<div class="svc-foot"><span class="svc-price mono">' + money(s.price) + '<small>/mo</small></span>' + (s.active ? pill('Active', 'green') : '<span class="svc-add" data-action="toggle-service" data-id="' + s.id + '">Activate →</span>') + '</div></div>';
        }).join('') + '</div>';
      }).join('');
      var note = '<div class="toolbar"><p class="muted">Turn services on for a client and they show up here as recurring revenue. As each feature ships in later phases, activating its service will unlock it in the client\'s portal.</p></div>';
      return hero + note + grid;
    }
  };
  A['toggle-service'] = function (el, d) {
    var s = (Store.state().settings.services || []).filter(function (x) { return x.id === d.id; })[0];
    if (!s) return; s.active = !s.active; Store.save();
    App.toast(s.active ? s.name + ' activated · +' + money(s.price) + '/mo' : s.name + ' turned off', s.active ? 'success' : 'info');
    App.refresh();
  };

  /* ---------------- BRAND STUDIO (extend Settings) ------------------- */
  // add a Brand Studio card to the Settings screen via its mount hook
  var prevSettingsMount = V.settings && V.settings.mount;
  if (V.settings) V.settings.mount = function () {
    try { prevSettingsMount && prevSettingsMount(); } catch (e) {}
    var view = document.getElementById('view'); if (!view || view.querySelector('#brand-welcome')) return;
    var s = Store.state().settings; var b = s.branding;
    var fav = b.favicon ? '<div class="logo-box" style="width:44px;height:44px;background-image:url(' + b.favicon + ')"></div>' : '<div class="logo-box empty" style="width:44px;height:44px">' + icon('image') + '</div>';
    var swatch = function (val, action) { return ['#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#db2777', '#ea580c', '#2563eb', '#059669'].map(function (c) { return '<button class="swatch' + (c === val ? ' on' : '') + '" style="background:' + c + '" data-action="' + action + '" data-color="' + c + '"></button>'; }).join(''); };
    var html = '<div class="card rise" style="margin-top:18px"><div class="sec-head"><h2>Brand Studio</h2><span class="muted">how this workspace looks & feels</span></div>' +
      '<div class="form-grid"><div><span class="field-label">Brand color</span><div class="swatches">' + swatch(b.primary, 'brand-primary') + '</div></div>' +
      '<div><span class="field-label">Accent color</span><div class="swatches">' + swatch(b.accent, 'brand-accent') + '</div></div></div>' +
      '<div class="form-grid" style="margin-top:6px"><div class="brand-kit-logo">' + fav + '<div>' + btn('Upload favicon', { sm: true, icon: 'image', action: 'upload-favicon' }) + (b.favicon ? btn('Remove', { sm: true, action: 'remove-favicon' }) : '') + '</div></div><div></div></div>' +
      field('Dashboard welcome message', '<input class="inp" id="brand-welcome" value="' + esc(b.welcome || '') + '">') +
      field('Login screen tagline', '<input class="inp" id="brand-tagline" value="' + esc(b.loginTagline || '') + '">') +
      '<div class="mt12">' + btn('Save brand studio', { variant: 'brand', action: 'save-brand-studio' }) + '</div></div>';
    view.insertAdjacentHTML('beforeend', html);
  };
  A['brand-primary'] = function (el, d) { Store.state().settings.branding.primary = d.color; Store.save(); App._applyBranding(); App._renderSidebar && App._renderSidebar(); App.go('settings'); };
  A['brand-accent'] = function (el, d) { Store.state().settings.branding.accent = d.color; Store.save(); App._applyBranding(); App.go('settings'); App.toast('Accent updated.'); };
  A['upload-favicon'] = function () { App._pickImage(function (url) { Store.state().settings.branding.favicon = url; Store.save(); App._applyBranding(); App.go('settings'); App.toast('Favicon set.'); }); };
  A['remove-favicon'] = function () { Store.state().settings.branding.favicon = null; Store.save(); App.go('settings'); };
  A['save-brand-studio'] = function () {
    var b = Store.state().settings.branding;
    var w = document.getElementById('brand-welcome'), t = document.getElementById('brand-tagline');
    if (w) b.welcome = w.value; if (t) b.loginTagline = t.value;
    Store.save(); App.toast('Brand studio saved.'); App.refresh();
  };

  /* ---------------- welcome message on the dashboard ---------------- */
  if (V.home && V.home.render) {
    var origHome = V.home.render;
    V.home.render = function () {
      var html = origHome();
      try {
        var w = Store.state().settings.branding.welcome;
        if (w) html = html.replace('<div class="dash-bar">', '<div class="dash-welcome rise">' + esc(w) + '</div><div class="dash-bar">');
      } catch (e) {}
      return html;
    };
  }
})(typeof window !== 'undefined' ? window : this);
