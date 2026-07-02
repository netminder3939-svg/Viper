/* =====================================================================
   Viper OS — app.js
   Render engine, router, components, views, charts, interactions.
   No build step. Plain ES5-ish JS so it runs anywhere Vercel serves it.
   ===================================================================== */
(function (global) {
  'use strict';
  var Store = global.Store;
  var App = { state: { route: 'home', param: null, search: {} } };

  /* =================================================================
     FORMAT HELPERS
     ================================================================= */
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return usd.format(Math.round(+n || 0)); }
  function money2(n) { return usd2.format(+n || 0); }
  function moneyShort(n) {
    n = +n || 0;
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
    return '$' + n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmtDate(s) { if (!s) return '—'; var d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function fmtDateY(s) { if (!s) return '—'; var d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function fmtTime(t) { if (!t) return ''; var p = t.split(':'); var h = +p[0], m = p[1]; var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m + ' ' + ap; }
  function relDay(s) {
    if (!s) return '—';
    var today = Store.iso(Store.now);
    if (s === today) return 'Today';
    var d = new Date(s + 'T12:00:00'), n = new Date(today + 'T12:00:00');
    var diff = Math.round((d - n) / 86400000);
    if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return 'In ' + diff + ' days';
    if (diff < 0 && diff > -7) return Math.abs(diff) + ' days ago';
    return fmtDate(s);
  }
  function initials(name) { return (name || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function avatarColor(seed) {
    var colors = ['#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#db2777', '#ea580c', '#2563eb', '#65a30d'];
    var h = 0; for (var i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) % colors.length;
    return colors[Math.abs(h)];
  }
  App.money = money; App.moneyShort = moneyShort; App.esc = esc;

  /* =================================================================
     ICONS  (inline SVG, lucide-ish stroke set)
     ================================================================= */
  var P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 6.5a3 3 0 0 1 0 6"/><path d="M21 20c0-2.3-1.4-4-3.5-4.6"/>',
    pipeline: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M8 6h6a2 2 0 0 1 2 2v2"/><path d="M8 18h6a2 2 0 0 0 2-2v-2"/>',
    jobs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 2.5v4M16 2.5v4"/>',
    estimate: '<path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/><path d="M13 2.5V7h5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
    invoice: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M7 14h4M7 17h2"/><circle cx="16.5" cy="15.5" r="1.6"/>',
    inbox: '<path d="M3 12l3-7h12l3 7"/><path d="M3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/><path d="M3 12h5l1.5 2.5h5L16 12h5"/>',
    automation: '<path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    ai: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.7 2 2 .7-2 .7L19 20l-.7-2-2-.7 2-.7z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l-1 4-2 1A16 16 0 0 1 5 6z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    dollar: '<path d="M12 2v20M16 6a4 4 0 0 0-4-2H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6h-3a4 4 0 0 1-4-2"/>',
    bolt: '<path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    spark: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    flame: '<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 11 12 9 12 3z"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    star: '<path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9 9z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    flag: '<path d="M5 21V4M5 4h11l-1.5 4L16 12H5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    sliders: '<path d="M4 21v-6M4 11V3M12 21v-8M12 7V3M20 21v-4M20 11V3"/><path d="M2 15h4M10 9h4M18 13h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M18 8a4 4 0 0 1 0 8"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2H18a3 3 0 0 0 3-3c0-5-4-8-9-8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    gauge: '<path d="M12 14l4-4"/><circle cx="12" cy="13" r="8"/><path d="M4 13a8 8 0 0 1 16 0"/>',
    signature: '<path d="M3 17c3 0 3-8 6-8s2 6 4 6 2-3 4-3 1 2 4 2"/><path d="M3 21h18"/>',
    checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    portal: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    book: '<path d="M4 4v16a1 1 0 0 0 1 1h14V3H6a2 2 0 0 0-2 2z"/><path d="M8 3v18"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/>',
    upload: '<path d="M12 21V9M7 13l5-5 5 5"/><path d="M4 21h16"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M8 17h8v4H8z"/>',
    tray: '<path d="M4 14l2-8h12l2 8"/><path d="M4 14v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/><path d="M4 14h5l1 2h4l1-2h5"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.4-1.9-2.6-4.5-2.9"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  App.icon = icon;

  /* =================================================================
     TINY UI PRIMITIVES
     ================================================================= */
  function avatar(name, sz, color) {
    var s = sz || 30; var c = color || avatarColor(name);
    return '<span class="avatar" style="width:' + s + 'px;height:' + s + 'px;background:' + c + '22;color:' + c + '">' + esc(initials(name)) + '</span>';
  }
  function pill(text, kind) { return '<span class="pill pill-' + (kind || 'gray') + '">' + esc(text) + '</span>'; }
  function statusPill(status) {
    var map = {
      lead: ['Lead', 'indigo'], prospect: ['Prospect', 'amber'], customer: ['Customer', 'green'],
      contacted: ['Contacted', 'blue'], estimate: ['Estimate', 'violet'], won: ['Won', 'green'], lost: ['Lost', 'gray'],
      scheduled: ['Scheduled', 'blue'], in_progress: ['In progress', 'amber'], complete: ['Complete', 'green'], invoiced: ['Invoiced', 'violet'],
      draft: ['Draft', 'gray'], sent: ['Sent', 'blue'], approved: ['Approved', 'green'], declined: ['Declined', 'rose'],
      paid: ['Paid', 'green'], overdue: ['Overdue', 'rose'],
      todo: ['To do', 'gray'], doing: ['Doing', 'amber'], done: ['Done', 'green']
    };
    var m = map[status] || [status, 'gray'];
    return '<span class="pill pill-' + m[1] + '">' + esc(m[0]) + '</span>';
  }
  function btn(label, opts) {
    opts = opts || {};
    var cls = 'btn ' + (opts.variant ? 'btn-' + opts.variant : 'btn-ghost') + (opts.sm ? ' btn-sm' : '') + (opts.block ? ' btn-block' : '');
    var ico = opts.icon ? icon(opts.icon) : '';
    var attrs = '';
    if (opts.action) attrs += ' data-action="' + opts.action + '"';
    if (opts.data) Object.keys(opts.data).forEach(function (k) { attrs += ' data-' + k + '="' + esc(opts.data[k]) + '"'; });
    return '<button class="' + cls + '"' + attrs + '>' + ico + (label ? '<span>' + esc(label) + '</span>' : '') + '</button>';
  }
  App.avatar = avatar; App.statusPill = statusPill; App.btn = btn; App.pill = pill;

  /* =================================================================
     CHARTS  (inline SVG)
     ================================================================= */
  function sparkline(values, opts) {
    opts = opts || {}; var w = opts.w || 120, h = opts.h || 34, color = opts.color || 'var(--brand)';
    if (!values.length) return '';
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var rng = max - min || 1;
    var pts = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * w;
      var y = h - ((v - min) / rng) * (h - 6) - 3;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var area = 'M0,' + h + ' L' + pts.join(' L') + ' L' + w + ',' + h + ' Z';
    var line = 'M' + pts.join(' L');
    var gid = 'sg' + Math.random().toString(36).slice(2, 7);
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" width="' + w + '" height="' + h + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity="0.28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function barChart(data, opts) {
    opts = opts || {}; var h = opts.h || 180, pad = 24;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var bw = 100 / data.length;
    var bars = data.map(function (d, i) {
      var bh = (d.value / max) * (h - pad - 18);
      var x = i * bw + bw * 0.18, ww = bw * 0.64;
      var y = h - pad - bh;
      return '<g>' +
        '<rect x="' + x + '%" y="' + y + '" width="' + ww + '%" height="' + bh + '" rx="3" fill="' + (d.color || 'var(--brand)') + '"/>' +
        '<text x="' + (i * bw + bw / 2) + '%" y="' + (h - 8) + '" text-anchor="middle" class="bc-x">' + esc(d.label) + '</text>' +
        '</g>';
    }).join('');
    return '<svg class="barchart" viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" width="100%" height="' + h + '">' + bars + '</svg>';
  }
  function funnel(stages) {
    var max = Math.max.apply(null, stages.map(function (s) { return s.value; })) || 1;
    return '<div class="funnel">' + stages.map(function (s) {
      var pct = Math.max(8, Math.round(s.value / max * 100));
      return '<div class="fn-row"><div class="fn-meta"><span>' + esc(s.label) + '</span><span class="mono">' + money(s.value) + '</span></div>' +
        '<div class="fn-bar"><div class="fn-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div></div>';
    }).join('') + '</div>';
  }
  function donut(segments, centerLabel, centerSub) {
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var off = 0, r = 42, c = 2 * Math.PI * r;
    var arcs = segments.map(function (s) {
      var frac = s.value / total, len = frac * c;
      var el = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"/>';
      off += len; return el;
    }).join('');
    return '<div class="donut-wrap"><svg viewBox="0 0 120 120" width="128" height="128"><circle cx="60" cy="60" r="42" fill="none" stroke="var(--line)" stroke-width="16"/>' + arcs +
      '</svg><div class="donut-center"><div class="donut-num mono">' + esc(centerLabel) + '</div><div class="donut-sub">' + esc(centerSub) + '</div></div></div>';
  }
  App.sparkline = sparkline;

  /* =================================================================
     TOAST
     ================================================================= */
  var toastTimer;
  function toast(msg, kind) {
    var t = document.getElementById('toast');
    if (!t) return;
    var ic = kind === 'error' ? 'x' : kind === 'info' ? 'bell' : 'check';
    t.className = 'toast toast-' + (kind || 'success') + ' show';
    t.innerHTML = '<span class="toast-ic">' + icon(ic) + '</span><span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3600);
  }
  App.toast = toast;

  /* =================================================================
     MODAL  (built dynamically)
     ================================================================= */
  function openModal(title, body, footer, opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-backdrop" data-action="close-modal"></div>' +
      '<div class="modal ' + (opts.wide ? 'modal-wide' : '') + '" role="dialog">' +
      '<div class="modal-head"><h3>' + esc(title) + '</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + body + '</div>' +
      (footer ? '<div class="modal-foot">' + footer + '</div>' : '') +
      '</div>';
    root.classList.add('open');
    var f = root.querySelector('input,textarea,select'); if (f) setTimeout(function () { f.focus(); }, 50);
    if (opts.mount) opts.mount(root);
  }
  function closeModal() { var r = document.getElementById('modal-root'); r.classList.remove('open'); r.innerHTML = ''; }
  App.openModal = openModal; App.closeModal = closeModal;

  /* =================================================================
     DRAWER  (right slide-over record detail)
     ================================================================= */
  function openDrawer(html) {
    var d = document.getElementById('drawer'); var b = document.getElementById('drawer-backdrop');
    d.innerHTML = html; d.classList.add('open'); b.classList.add('open');
  }
  function closeDrawer() {
    var d = document.getElementById('drawer'); var b = document.getElementById('drawer-backdrop');
    d.classList.remove('open'); b.classList.remove('open');
    App._drawer = null;
  }
  App.openDrawer = openDrawer; App.closeDrawer = closeDrawer;

  /* =================================================================
     NAVIGATION MODEL
     ================================================================= */
  var NAV = [
    { group: 'Workspace', items: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'ai', label: 'Assistant', icon: 'ai' }
    ] },
    { group: 'Sales', items: [
      { id: 'contacts', label: 'Contacts', icon: 'users' },
      { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
      { id: 'requests', label: 'Requests', icon: 'tray', badge: 'requests' },
      { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: 'unread' }
    ] },
    { group: 'Operations', items: [
      { id: 'jobs', label: 'Jobs', icon: 'jobs' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar' },
      { id: 'timesheets', label: 'Timesheets', icon: 'timer' },
      { id: 'tasks', label: 'Tasks', icon: 'check' }
    ] },
    { group: 'Money', items: [
      { id: 'estimates', label: 'Estimates', icon: 'estimate' },
      { id: 'invoices', label: 'Invoices', icon: 'invoice' },
      { id: 'catalog', label: 'Price book', icon: 'book' },
      { id: 'reports', label: 'Reports', icon: 'reports' }
    ] },
    { group: 'Automate', items: [
      { id: 'automations', label: 'Automations', icon: 'automation' },
      { id: 'templates', label: 'Messages', icon: 'megaphone' },
      { id: 'outbox', label: 'Outbox', icon: 'send' }
    ] },
    { group: '', items: [
      { id: 'settings', label: 'Settings', icon: 'settings' }
    ] }
  ];
  var TITLES = {
    home: ['Dashboard', 'Your command center'], ai: ['Assistant', 'Ask anything about your business'],
    contacts: ['Contacts', 'Everyone you do business with'], pipeline: ['Pipeline', 'Deals from first call to close'],
    inbox: ['Inbox', 'Email & text in one place'], jobs: ['Jobs', 'Schedule, dispatch, and track work'],
    schedule: ['Schedule', 'Calendar of jobs and visits'], tasks: ['Tasks', 'What needs doing'],
    estimates: ['Estimates', 'Quote work and win it'], invoices: ['Invoices', 'Bill and get paid'],
    reports: ['Reports', 'How the business is doing'], automations: ['Automations', 'Let the system do the busywork'],
    templates: ['Messages', 'Every email & text, fully branded and editable'], outbox: ['Outbox', 'Everything the system has sent'],
    requests: ['Requests', 'New work coming in from your Client Hub'],
    timesheets: ['Timesheets', 'Hours logged in the field'],
    catalog: ['Price book', 'Reusable priced services with your margins'],
    settings: ['Settings', 'Business, branding, and team']
  };

  function renderSidebar() {
    var s = Store.state().settings;
    var k = Store.kpis();
    var nav = NAV.map(function (g) {
      var items = g.items.map(function (it) {
        var badge = '';
        if (it.badge === 'unread' && k.unreadMsgs) badge = '<span class="nav-badge">' + k.unreadMsgs + '</span>';
        if (it.badge === 'requests') { var rq = Store.all('requests').filter(function (r) { return r.status === 'new'; }).length; if (rq) badge = '<span class="nav-badge">' + rq + '</span>'; }
        return '<button class="nav-item" data-route="' + it.id + '" data-action="nav">' + icon(it.icon) + '<span>' + it.label + '</span>' + badge + '</button>';
      }).join('');
      return (g.group ? '<div class="nav-group">' + g.group + '</div>' : '<div class="nav-sep"></div>') + items;
    }).join('');
    var logo = s.branding && s.branding.logo;
    var mark = logo ? '<div class="brand-mark brand-logo" style="background-image:url(' + logo + ')"></div>' : '<div class="brand-mark">' + icon('bolt') + '</div>';
    return '<div class="brand">' +
        mark +
        '<div class="brand-text"><div class="brand-name">' + esc(s.business.name) + '</div><div class="brand-sub">Operations OS</div></div>' +
      '</div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="nav-foot">' + teamFootHTML() + '</div>';
  }
  function teamFootHTML() {
    var uid = (App.session && App.session.userId) || 'u_owner';
    var me = Store.get('team', uid) || Store.get('team', 'u_owner') || Store.all('team')[0] ||
      { name: (App.session && App.session.role === 'owner') ? 'Owner' : 'You', role: 'Signed in', color: '#4f46e5' };
    return '<button class="me-card" data-action="nav" data-route="settings">' + avatar(me.name, 32, me.color) +
      '<div class="me-meta"><div class="me-name">' + esc(me.name) + '</div><div class="me-role">' + esc(me.role) + '</div></div>' + icon('settings') + '</button>' +
      '<button class="switch-role" data-action="open-login">' + icon('refresh') + '<span>Switch role / log in</span></button>';
  }

  function renderTopbar() {
    var t = TITLES[App.state.route] || ['', ''];
    var notifDot = Store.state().settings.notifRead ? '' : '<span class="dot"></span>';
    return '<button class="icon-btn hide-desk" data-action="toggle-nav" aria-label="Menu">' + icon('menu') + '</button>' +
      '<div class="tb-title"><div class="tb-eyebrow mono">VIPER OS</div><h1>' + esc(t[0]) + '</h1></div>' +
      '<div class="tb-actions">' +
        '<button class="search-trigger" data-action="open-search">' + icon('search') + '<span>Search</span><kbd>⌘K</kbd></button>' +
        '<button class="btn btn-brand btn-sm" data-action="open-create">' + icon('plus') + '<span>Create</span></button>' +
        '<button class="icon-btn notif" data-action="toggle-notif" aria-label="Notifications">' + icon('bell') + notifDot + '</button>' +
      '</div>';
  }

  /* =================================================================
     RENDER ENGINE + ROUTER
     ================================================================= */
  App.views = {}; // route -> { render: fn, mount?: fn }

  function go(route, param) {
    if (!App.views[route]) route = 'home';
    App.state.route = route; App.state.param = param || null;
    if (global.location) try { global.location.hash = route; } catch (e) {}
    document.body.classList.remove('nav-open');
    closeDrawer();
    // active nav
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (n) {
      n.classList.toggle('active', n.getAttribute('data-route') === route);
    });
    document.getElementById('topbar').innerHTML = renderTopbar();
    var v = App.views[route];
    var view = document.getElementById('view');
    view.innerHTML = v.render(param);
    view.scrollTop = 0;
    if (v.mount) v.mount(param);
    // entrance animation
    Array.prototype.forEach.call(view.querySelectorAll('.rise'), function (el, i) { el.style.animationDelay = (i * 0.04) + 's'; });
  }
  App.go = go;
  App.refresh = function () { go(App.state.route, App.state.param); };

  /* =================================================================
     GLOBAL EVENT DELEGATION
     ================================================================= */
  var ACT = {}; // action handlers registered later
  App.actions = ACT;
  function onClick(e) {
    var el = e.target.closest('[data-action],[data-route]');
    if (!el) return;
    var route = el.getAttribute('data-route');
    var action = el.getAttribute('data-action');
    if (action === 'nav' && route) { e.preventDefault(); go(route); return; }
    if (!action) { if (route) { e.preventDefault(); go(route); } return; }
    var fn = ACT[action];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el, el.dataset, e); }
  }

  var _bound = false;
  function bindGlobal() {
    if (_bound) return; _bound = true;
    Store.onChange = function () {
      var k = Store.kpis();
      var ib = document.querySelector('.nav-item[data-route="inbox"] .nav-badge');
      var ibItem = document.querySelector('.nav-item[data-route="inbox"]');
      if (ibItem) {
        if (k.unreadMsgs) {
          if (ib) ib.textContent = k.unreadMsgs;
          else ibItem.insertAdjacentHTML('beforeend', '<span class="nav-badge">' + k.unreadMsgs + '</span>');
        } else if (ib) ib.remove();
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(); closeDrawer(); document.body.classList.remove('nav-open'); App._closeLogin && App._closeLogin(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && App.state && App.state.route !== undefined && !document.body.classList.contains('mode-field') && !document.body.classList.contains('mode-portal')) { e.preventDefault(); ACT['open-search'] && ACT['open-search'](); }
    });
  }
  App._bindGlobal = bindGlobal;

  function boot() {
    document.body.classList.remove('mode-field', 'mode-portal');
    document.getElementById('sidebar').innerHTML = renderSidebar();
    bindGlobal();
    var start = (global.location && global.location.hash || '').replace('#', '') || 'home';
    if (!App.views[start]) start = 'home';
    go(start);
  }
  App.boot = boot;

  // expose some helpers to view module
  App._fmt = { money: money, money2: money2, moneyShort: moneyShort, esc: esc, fmtDate: fmtDate, fmtDateY: fmtDateY, fmtTime: fmtTime, relDay: relDay, initials: initials, avatarColor: avatarColor };
  App._charts = { barChart: barChart, funnel: funnel, donut: donut, sparkline: sparkline };
  App._ui = { statusPill: statusPill, pill: pill, avatar: avatar, btn: btn, icon: icon };
  App._renderSidebar = function () { var el = document.getElementById('sidebar'); if (el) el.innerHTML = renderSidebar(); };
  App._TITLES = TITLES; App._toast = toast;

  global.App = App;
  if (typeof document !== 'undefined' && document.readyState !== 'loading') { /* views.js calls boot */ }
})(typeof window !== 'undefined' ? window : this);
