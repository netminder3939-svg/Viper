/* =====================================================================
   Viper OS — views.js
   Every screen + drawers, modals, actions, drag/drop, and the assistant.
   Registers into App.views / App.actions, then boots.
   ===================================================================== */
(function (global) {
  'use strict';
  var App = global.App, Store = global.Store;
  var f = App._fmt, ch = App._charts, ui = App._ui, icon = App.icon;
  var money = f.money, money2 = f.money2, moneyShort = f.moneyShort, esc = f.esc;
  var statusPill = ui.statusPill, avatar = ui.avatar, btn = ui.btn, pill = ui.pill;
  var V = App.views, A = App.actions;

  function card(inner, cls) { return '<div class="card ' + (cls || '') + '">' + inner + '</div>'; }
  function sectionTitle(t, right) { return '<div class="sec-head"><h2>' + esc(t) + '</h2>' + (right || '') + '</div>'; }
  function empty(msg, actionLabel, action) {
    return '<div class="empty"><div class="empty-ic">' + icon('spark') + '</div><p>' + esc(msg) + '</p>' +
      (actionLabel ? btn(actionLabel, { variant: 'brand', sm: true, action: action }) : '') + '</div>';
  }
  function field(label, inner) { return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</label>'; }
  function input(id, attrs) { return '<input id="' + id + '" class="inp" ' + (attrs || '') + '>'; }
  function contactOptions(sel) {
    return Store.all('contacts').map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + (c.company && c.company !== c.name ? ' · ' + esc(c.company) : '') + '</option>'; }).join('');
  }
  function drf(k, v) { return '<div class="drf"><span class="drf-k">' + k + '</span><span class="drf-v">' + v + '</span></div>'; }
  function drawerShell(head, body, actions) {
    return '<div class="dr-head">' + head + '<button class="icon-btn" data-action="close-drawer" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="dr-body">' + body + '</div>' +
      (actions ? '<div class="dr-foot">' + actions + '</div>' : '');
  }
  function lineItemsBlock(items) {
    var t = Store.withTax(Store.lineTotal(items));
    var rows = items.map(function (it) { return '<div class="li-line"><span>' + esc(it.desc) + '</span><span class="muted mono">' + (it.qty || 1) + '×' + money(it.rate) + '</span><span class="mono">' + money((it.qty || 1) * it.rate) + '</span></div>'; }).join('');
    return '<div class="dr-sec">Line items</div><div class="li-block">' + rows +
      '<div class="li-line tot"><span></span><span class="muted">Subtotal</span><span class="mono">' + money2(t.sub) + '</span></div>' +
      '<div class="li-line tot"><span></span><span class="muted">Tax</span><span class="mono">' + money2(t.tax) + '</span></div>' +
      '<div class="li-line tot grand"><span></span><span>Total</span><span class="mono">' + money2(t.total) + '</span></div></div>';
  }

  /* ================= DASHBOARD ================= */
  V.home = {
    render: function () {
      var k = Store.kpis();
      var trend = [28, 31, 27, 35, 33, 41, 38, 44];
      var hero = '<div class="hero rise"><div class="hero-glow"></div>' +
        '<div class="hero-top"><span class="hero-label mono">REVENUE · THIS MONTH</span><span class="live"><span class="live-dot"></span>LIVE</span></div>' +
        '<div class="hero-num mono">' + money(k.revenueMTD) + '</div>' +
        '<div class="hero-foot"><span class="delta up">' + icon('trend') + ' +14% vs last month</span>' + ch.sparkline(trend, { w: 150, h: 40, color: '#fff' }) + '</div></div>';
      function stat(label, val, sub, ico, kind) {
        return '<div class="stat rise"><div class="stat-ic stat-' + kind + '">' + icon(ico) + '</div>' +
          '<div class="stat-label mono">' + esc(label) + '</div><div class="stat-val mono">' + val + '</div><div class="stat-sub">' + sub + '</div></div>';
      }
      var stats = '<div class="stat-grid">' +
        stat('PIPELINE', money(k.pipelineValue), k.openDeals + ' open deals', 'pipeline', 'indigo') +
        stat('OUTSTANDING', money(k.outstanding), 'across unpaid invoices', 'invoice', 'amber') +
        stat('WIN RATE', k.winRate + '%', 'deals won', 'trend', 'green') + '</div>';
      var todayJobs = k.jobsToday.slice().sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
      var jobsHtml = todayJobs.length ? todayJobs.map(function (j) {
        var m = Store.teamMember(j.assignedTo);
        return '<div class="line-row" data-action="open-record" data-type="job" data-id="' + j.id + '"><div class="lr-time mono">' + esc(f.fmtTime(j.time)) + '</div>' +
          '<div class="lr-main"><div class="lr-title">' + esc(j.title) + '</div><div class="lr-sub">' + esc(Store.contactName(j.contactId)) + ' · ' + esc(j.address || '') + '</div></div>' + (m ? avatar(m.name, 26, m.color) : '') + '</div>';
      }).join('') : empty('No jobs scheduled today.');
      var todayCard = card(sectionTitle("Today's schedule", '<span class="mono muted">' + todayJobs.length + ' jobs</span>') + '<div class="line-list">' + jobsHtml + '</div>', 'rise');
      var stages = [['lead', 'New leads', '#6366f1'], ['contacted', 'Contacted', '#3b82f6'], ['estimate', 'Estimate sent', '#7c3aed'], ['won', 'Won', '#10b981']];
      var fn = stages.map(function (st) { var v = Store.all('deals').filter(function (d) { return d.stage === st[0]; }).reduce(function (s2, d) { return s2 + d.value; }, 0); return { label: st[1], value: v, color: st[2] }; });
      var pipeCard = card(sectionTitle('Pipeline', btn('View board', { sm: true, action: 'nav', data: { route: 'pipeline' } })) + ch.funnel(fn), 'rise');
      var acts = Store.all('activities').slice(0, 6).map(function (a) {
        var im = { invoice: 'invoice', deal: 'pipeline', lead: 'users', estimate: 'estimate', job: 'jobs' };
        return '<div class="act-row"><span class="act-ic">' + icon(im[a.type] || 'spark') + '</span><div><div class="act-text">' + esc(a.text) + '</div><div class="act-when mono">' + esc(f.relDay(a.at)) + '</div></div></div>';
      }).join('');
      var actCard = card(sectionTitle('Recent activity') + '<div class="act-list">' + acts + '</div>', 'rise');
      var dueTasks = Store.all('tasks').filter(function (t) { return t.status !== 'done' && t.dueDate <= Store.iso(Store.now); });
      var taskCard = card(sectionTitle('Needs attention', '<span class="mono muted">' + dueTasks.length + '</span>') +
        (dueTasks.length ? dueTasks.map(function (t) { return '<div class="line-row"><span class="prio prio-' + t.priority + '"></span><div class="lr-main"><div class="lr-title">' + esc(t.title) + '</div><div class="lr-sub">Due ' + esc(f.relDay(t.dueDate)) + '</div></div>' + btn('', { icon: 'check', sm: true, action: 'task-done', data: { id: t.id } }) + '</div>'; }).join('') : empty('All caught up.')), 'rise');
      return '<div class="dash-hero">' + hero + stats + '</div><div class="grid-2">' + todayCard + pipeCard + '</div><div class="grid-2">' + taskCard + actCard + '</div>';
    }
  };

  /* ================= CONTACTS ================= */
  function contactRows(list) {
    if (!list.length) return '<tr><td colspan="6">' + empty('No contacts match.', 'Add contact', 'new-contact') + '</td></tr>';
    return list.map(function (c) {
      var owner = Store.teamMember(c.owner);
      return '<tr class="rowlink" data-action="open-record" data-type="contact" data-id="' + c.id + '">' +
        '<td><div class="cell-id">' + avatar(c.name, 30) + '<div><div class="cell-name">' + esc(c.name) + '</div><div class="cell-sub">' + esc(c.company || '') + '</div></div></div></td>' +
        '<td>' + esc(c.type) + '</td><td>' + statusPill(c.stage) + '</td><td class="mono muted">' + esc(c.phone) + '</td>' +
        '<td>' + (owner ? avatar(owner.name, 24, owner.color) : '—') + '</td><td class="muted">' + esc(c.lastContact ? f.relDay(c.lastContact) : 'Never') + '</td></tr>';
    }).join('');
  }
  V.contacts = {
    render: function () {
      var toolbar = '<div class="toolbar"><div class="search-inp">' + icon('search') + '<input id="contact-search" placeholder="Search name, company, phone…"></div>' +
        '<div class="chips" id="contact-chips">' + ['All', 'Residential', 'Commercial', 'Industrial'].map(function (t, i) { return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-type-filter="' + (i === 0 ? '' : t) + '">' + t + '</button>'; }).join('') + '</div>' +
        btn('Add contact', { variant: 'brand', sm: true, action: 'new-contact' }) + '</div>';
      return toolbar + card('<table class="tbl"><thead><tr><th>Name</th><th>Type</th><th>Stage</th><th>Phone</th><th>Owner</th><th>Last contact</th></tr></thead><tbody id="contact-rows">' + contactRows(Store.all('contacts')) + '</tbody></table>', 'nopad rise');
    },
    mount: function () {
      var s = document.getElementById('contact-search'); var typeF = '', q = '';
      function apply() {
        var list = Store.all('contacts').filter(function (c) { return (!typeF || c.type === typeF) && (!q || (c.name + ' ' + c.company + ' ' + c.phone + ' ' + c.email).toLowerCase().indexOf(q) >= 0); });
        document.getElementById('contact-rows').innerHTML = contactRows(list);
      }
      if (s) s.addEventListener('input', function () { q = s.value.toLowerCase(); apply(); });
      document.getElementById('contact-chips').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; Array.prototype.forEach.call(this.children, function (c) { c.classList.remove('on'); }); b.classList.add('on'); typeF = b.getAttribute('data-type-filter'); apply(); });
    }
  };
  function contactDrawer(id) {
    var c = Store.get('contacts', id); if (!c) return;
    var deals = Store.all('deals').filter(function (d) { return d.contactId === id; });
    var jobs = Store.all('jobs').filter(function (j) { return j.contactId === id; });
    var invs = Store.all('invoices').filter(function (v) { return v.contactId === id; });
    var owner = Store.teamMember(c.owner);
    function relList(title, arr, r2) { return arr.length ? '<div class="dr-sec">' + esc(title) + '</div>' + arr.map(r2).join('') : ''; }
    var body = '<div class="dr-fields">' + drf('Company', esc(c.company)) + drf('Email', esc(c.email)) + drf('Phone', '<span class="mono">' + esc(c.phone) + '</span>') +
      drf('Type', esc(c.type)) + drf('Owner', owner ? esc(owner.name) : '—') + drf('Address', esc(c.address || '—')) + '</div>' +
      (c.tags && c.tags.length ? '<div class="tagrow">' + c.tags.map(function (t) { return pill(t, 'soft'); }).join('') + '</div>' : '') +
      relList('Deals', deals, function (d) { return '<div class="dr-rel" data-action="open-record" data-type="deal" data-id="' + d.id + '"><span>' + esc(d.title) + '</span><span class="mono">' + money(d.value) + '</span></div>'; }) +
      relList('Jobs', jobs, function (j) { return '<div class="dr-rel" data-action="open-record" data-type="job" data-id="' + j.id + '"><span>' + esc(j.title) + '</span>' + statusPill(j.status) + '</div>'; }) +
      relList('Invoices', invs, function (v) { return '<div class="dr-rel" data-action="open-record" data-type="invoice" data-id="' + v.id + '"><span class="mono">' + esc(v.number) + '</span><span>' + statusPill(v.status) + '</span></div>'; });
    var actions = btn('Email', { variant: 'brand', icon: 'mail', action: 'compose', data: { to: c.email, name: c.name } }) +
      btn('Estimate', { icon: 'estimate', action: 'new-estimate', data: { contact: c.id } }) +
      btn('Schedule', { icon: 'calendar', action: 'new-job', data: { contact: c.id } });
    return drawerShell('<div class="dr-id">' + avatar(c.name, 44) + '<div><div class="dr-name">' + esc(c.name) + '</div><div class="dr-sub2">' + statusPill(c.stage) + ' ' + esc(c.type) + '</div></div></div>', body, actions);
  }

  /* ================= PIPELINE ================= */
  var PSTAGES = [['lead', 'New Lead', '#6366f1'], ['contacted', 'Contacted', '#3b82f6'], ['estimate', 'Estimate Sent', '#7c3aed'], ['won', 'Won', '#10b981'], ['lost', 'Lost', '#94a3b8']];
  V.pipeline = {
    render: function () {
      var cols = PSTAGES.map(function (st, idx) {
        var deals = Store.all('deals').filter(function (d) { return d.stage === st[0]; });
        var sum = deals.reduce(function (s, d) { return s + d.value; }, 0);
        var cards = deals.map(function (d) {
          var owner = Store.teamMember(d.owner);
          return '<div class="deal" draggable="true" data-id="' + d.id + '" data-action="open-record" data-type="deal">' +
            (d.hot ? '<span class="hot">' + icon('flame') + '</span>' : '') +
            '<div class="deal-title">' + esc(d.title) + '</div>' +
            '<div class="deal-meta"><span class="mono deal-val">' + money(d.value) + '</span>' + (owner ? avatar(owner.name, 22, owner.color) : '') + '</div>' +
            '<div class="kmove"><button class="kbtn" ' + (idx === 0 ? 'disabled' : '') + ' data-action="move-deal" data-id="' + d.id + '" data-dir="-1">' + icon('arrowL') + '</button>' +
            '<button class="kbtn" ' + (idx === PSTAGES.length - 1 ? 'disabled' : '') + ' data-action="move-deal" data-id="' + d.id + '" data-dir="1">' + icon('arrowR') + '</button></div></div>';
        }).join('');
        return '<div class="pcol" data-stage="' + st[0] + '"><div class="pcol-head"><span class="dot-stage" style="background:' + st[2] + '"></span><span>' + st[1] + '</span><span class="pcol-count mono">' + deals.length + '</span></div><div class="pcol-sum mono">' + money(sum) + '</div><div class="pcol-body">' + cards + '</div></div>';
      }).join('');
      return '<div class="board rise" id="pipe-board">' + cols + '</div>';
    },
    mount: function () { setupBoard('#pipe-board', '.pcol', function (id, stage) { Store.update('deals', id, { stage: stage }); App.refresh(); }); }
  };
  function dealDrawer(id) {
    var d = Store.get('deals', id); if (!d) return;
    var c = Store.get('contacts', d.contactId);
    var body = '<div class="dr-amt mono">' + money(d.value) + '</div><div class="dr-fields">' +
      drf('Contact', c ? '<span class="link" data-action="open-record" data-type="contact" data-id="' + c.id + '">' + esc(c.name) + '</span>' : '—') +
      drf('Stage', statusPill(d.stage)) + drf('Created', esc(f.fmtDateY(d.createdAt))) + '</div>' +
      '<div class="dr-sec">Move stage</div><div class="stage-pick">' + PSTAGES.map(function (st) { return '<button class="chip' + (st[0] === d.stage ? ' on' : '') + '" data-action="set-deal-stage" data-id="' + d.id + '" data-stage="' + st[0] + '">' + st[1] + '</button>'; }).join('') + '</div>' +
      (d.note ? '<div class="dr-sec">Note</div><p class="dr-note">' + esc(d.note) + '</p>' : '');
    var actions = btn('New estimate', { variant: 'brand', icon: 'estimate', action: 'new-estimate', data: { contact: d.contactId } }) +
      (d.stage !== 'won' ? btn('Mark won', { icon: 'check', action: 'set-deal-stage', data: { id: d.id, stage: 'won' } }) : '') +
      btn('Email', { icon: 'mail', action: 'compose', data: { to: c ? c.email : '', name: c ? c.name : '' } });
    return drawerShell('<div><div class="dr-name">' + esc(d.title) + '</div><div class="dr-sub2">' + (c ? esc(c.name) : '') + '</div></div>', body, actions);
  }

  /* ================= JOBS ================= */
  var JSTAGES = [['scheduled', 'Scheduled', '#3b82f6'], ['in_progress', 'In Progress', '#f59e0b'], ['complete', 'Complete', '#10b981']];
  V.jobs = {
    render: function () {
      var toolbar = '<div class="toolbar"><div class="grow"></div>' + btn('New job', { variant: 'brand', sm: true, action: 'new-job' }) + '</div>';
      var cols = JSTAGES.map(function (st, idx) {
        var jobs = Store.all('jobs').filter(function (j) { return j.status === st[0]; });
        var cards = jobs.map(function (j) {
          var m = Store.teamMember(j.assignedTo);
          return '<div class="deal" draggable="true" data-id="' + j.id + '" data-action="open-record" data-type="job">' +
            '<div class="deal-title">' + esc(j.title) + '</div><div class="lr-sub">' + esc(Store.contactName(j.contactId)) + '</div>' +
            '<div class="deal-meta"><span class="mono muted">' + esc(f.relDay(j.date)) + ' · ' + esc(f.fmtTime(j.time)) + '</span>' + (m ? avatar(m.name, 22, m.color) : '') + '</div>' +
            '<div class="kmove"><button class="kbtn" ' + (idx === 0 ? 'disabled' : '') + ' data-action="move-job" data-id="' + j.id + '" data-dir="-1">' + icon('arrowL') + '</button>' +
            '<button class="kbtn" ' + (idx === JSTAGES.length - 1 ? 'disabled' : '') + ' data-action="move-job" data-id="' + j.id + '" data-dir="1">' + icon('arrowR') + '</button></div></div>';
        }).join('');
        return '<div class="pcol" data-stage="' + st[0] + '"><div class="pcol-head"><span class="dot-stage" style="background:' + st[2] + '"></span><span>' + st[1] + '</span><span class="pcol-count mono">' + jobs.length + '</span></div><div class="pcol-body">' + cards + '</div></div>';
      }).join('');
      return toolbar + '<div class="board board-3 rise" id="job-board">' + cols + '</div>';
    },
    mount: function () { setupBoard('#job-board', '.pcol', function (id, stage) { Store.update('jobs', id, { status: stage }); App.refresh(); }); }
  };
  function jobDrawer(id) {
    var j = Store.get('jobs', id); if (!j) return;
    var c = Store.get('contacts', j.contactId), m = Store.teamMember(j.assignedTo);
    var body = '<div class="dr-fields">' + drf('Client', c ? '<span class="link" data-action="open-record" data-type="contact" data-id="' + c.id + '">' + esc(c.name) + '</span>' : '—') +
      drf('When', esc(f.fmtDateY(j.date)) + ' · ' + esc(f.fmtTime(j.time))) + drf('Assigned', m ? esc(m.name) : 'Unassigned') +
      drf('Address', esc(j.address || '—')) + drf('Status', statusPill(j.status)) + '</div>' +
      (j.items && j.items.length ? lineItemsBlock(j.items) : '') + (j.notes ? '<div class="dr-sec">Notes</div><p class="dr-note">' + esc(j.notes) + '</p>' : '');
    var actions = '';
    if (j.status === 'scheduled') actions += btn('Start job', { variant: 'brand', icon: 'bolt', action: 'move-job', data: { id: j.id, dir: 1 } });
    if (j.status === 'in_progress') actions += btn('Complete', { variant: 'brand', icon: 'check', action: 'complete-job', data: { id: j.id } });
    if (j.status === 'complete') actions += btn('Create invoice', { variant: 'brand', icon: 'invoice', action: 'job-to-invoice', data: { id: j.id } });
    actions += btn('Message', { icon: 'mail', action: 'compose', data: { to: c ? c.email : '', name: c ? c.name : '' } });
    return drawerShell('<div><div class="dr-name">' + esc(j.title) + '</div><div class="dr-sub2">' + (c ? esc(c.name) : '') + '</div></div>', body, actions);
  }

  /* ================= SCHEDULE ================= */
  V.schedule = {
    render: function () {
      var cal = App.state.cal || (App.state.cal = { y: Store.now.getFullYear(), m: Store.now.getMonth(), sel: Store.iso(Store.now) });
      var mn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var first = new Date(cal.y, cal.m, 1).getDay(), days = new Date(cal.y, cal.m + 1, 0).getDate();
      var byDay = {}; Store.all('jobs').forEach(function (j) { (byDay[j.date] = byDay[j.date] || []).push(j); });
      var cells = '';
      for (var i = 0; i < first; i++) cells += '<div class="cal-cell out"></div>';
      for (var d = 1; d <= days; d++) {
        var ds = cal.y + '-' + String(cal.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var evs = byDay[ds] || []; var isToday = ds === Store.iso(Store.now);
        var dots = evs.slice(0, 3).map(function () { return '<span class="cal-dot"></span>'; }).join('');
        cells += '<div class="cal-cell' + (isToday ? ' today' : '') + (ds === cal.sel ? ' sel' : '') + '" data-action="cal-day" data-day="' + ds + '"><span class="cal-n mono">' + d + '</span><div class="cal-dots">' + dots + '</div></div>';
      }
      var calCard = card('<div class="cal-nav"><button class="icon-btn" data-action="cal-prev">' + icon('chevL') + '</button><h2>' + mn[cal.m] + ' ' + cal.y + '</h2><button class="icon-btn" data-action="cal-next">' + icon('chevR') + '</button></div>' +
        '<div class="cal-dow">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="cal-grid">' + cells + '</div>', 'rise');
      var selEvs = (byDay[cal.sel] || []).sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
      var side = card(sectionTitle(f.fmtDateY(cal.sel)) + (selEvs.length ? selEvs.map(function (j) {
        var m = Store.teamMember(j.assignedTo);
        return '<div class="line-row" data-action="open-record" data-type="job" data-id="' + j.id + '"><div class="lr-time mono">' + esc(f.fmtTime(j.time)) + '</div><div class="lr-main"><div class="lr-title">' + esc(j.title) + '</div><div class="lr-sub">' + esc(Store.contactName(j.contactId)) + '</div></div>' + (m ? avatar(m.name, 24, m.color) : '') + '</div>';
      }).join('') : empty('Nothing scheduled.', 'New job', 'new-job')), 'rise');
      return '<div class="cal-wrap">' + calCard + side + '</div>';
    }
  };

  /* ================= TASKS ================= */
  var TSTAGES = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  V.tasks = {
    render: function () {
      var cols = TSTAGES.map(function (st, idx) {
        var tasks = Store.all('tasks').filter(function (t) { return t.status === st[0]; });
        var cards = tasks.map(function (t) {
          var m = Store.teamMember(t.assignedTo);
          return '<div class="deal task" draggable="true" data-id="' + t.id + '"><button class="task-x" data-action="del-task" data-id="' + t.id + '">' + icon('x') + '</button>' +
            '<div class="deal-title">' + esc(t.title) + '</div><div class="deal-meta"><span class="prio prio-' + t.priority + '"></span><span class="mono muted">' + esc(f.relDay(t.dueDate)) + '</span>' + (m ? avatar(m.name, 20, m.color) : '') + '</div>' +
            '<div class="kmove"><button class="kbtn" ' + (idx === 0 ? 'disabled' : '') + ' data-action="move-task" data-id="' + t.id + '" data-dir="-1">' + icon('arrowL') + '</button>' +
            '<button class="kbtn" ' + (idx === TSTAGES.length - 1 ? 'disabled' : '') + ' data-action="move-task" data-id="' + t.id + '" data-dir="1">' + icon('arrowR') + '</button></div></div>';
        }).join('');
        return '<div class="pcol" data-stage="' + st[0] + '"><div class="pcol-head"><span>' + st[1] + '</span><span class="pcol-count mono">' + tasks.length + '</span></div><div class="pcol-body">' + cards + '</div><button class="add-task" data-action="add-task" data-status="' + st[0] + '">' + icon('plus') + ' Add task</button></div>';
      }).join('');
      return '<div class="board board-3 rise" id="task-board">' + cols + '</div>';
    },
    mount: function () { setupBoard('#task-board', '.pcol', function (id, stage) { Store.update('tasks', id, { status: stage }); App.refresh(); }); }
  };

  /* ================= ESTIMATES + INVOICES ================= */
  V.estimates = {
    render: function () {
      var toolbar = '<div class="toolbar"><div class="grow"></div>' + btn('New estimate', { variant: 'brand', sm: true, action: 'new-estimate' }) + '</div>';
      var rows = Store.all('estimates').map(function (e) {
        return '<tr class="rowlink" data-action="open-record" data-type="estimate" data-id="' + e.id + '"><td class="mono">' + esc(e.number) + '</td><td>' + esc(Store.contactName(e.contactId)) + '</td><td class="mono">' + money(Store.estimateTotal(e)) + '</td><td>' + statusPill(e.status) + '</td><td class="muted">' + esc(f.fmtDate(e.createdAt)) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">' + empty('No estimates yet.', 'New estimate', 'new-estimate') + '</td></tr>';
      return toolbar + card('<table class="tbl"><thead><tr><th>Number</th><th>Client</th><th>Total</th><th>Status</th><th>Created</th></tr></thead><tbody>' + rows + '</tbody></table>', 'nopad rise');
    }
  };
  function estimateDrawer(id) {
    var e = Store.get('estimates', id); if (!e) return; var c = Store.get('contacts', e.contactId);
    var body = '<div class="dr-amt mono">' + money(Store.estimateTotal(e)) + '</div><div class="dr-fields">' + drf('Client', c ? esc(c.name) : '—') + drf('Number', '<span class="mono">' + esc(e.number) + '</span>') + drf('Status', statusPill(e.status)) + drf('Valid until', esc(f.fmtDateY(e.validUntil))) + '</div>' + lineItemsBlock(e.items);
    var actions = '';
    if (e.status === 'draft') actions += btn('Send to client', { variant: 'brand', icon: 'send', action: 'send-estimate', data: { id: e.id } });
    if (e.status === 'sent') actions += btn('Mark approved', { variant: 'brand', icon: 'check', action: 'approve-estimate', data: { id: e.id } });
    if (e.status === 'approved') actions += btn('Convert to job', { variant: 'brand', icon: 'jobs', action: 'estimate-to-job', data: { id: e.id } });
    actions += btn('Follow up', { icon: 'ai', action: 'ai-followup', data: { id: e.id } });
    return drawerShell('<div><div class="dr-name mono">' + esc(e.number) + '</div><div class="dr-sub2">' + (c ? esc(c.name) : '') + '</div></div>', body, actions);
  }
  V.invoices = {
    render: function () {
      var toolbar = '<div class="toolbar"><div class="grow"></div>' + btn('New invoice', { variant: 'brand', sm: true, action: 'new-invoice' }) + '</div>';
      var rows = Store.all('invoices').map(function (v) {
        return '<tr class="rowlink" data-action="open-record" data-type="invoice" data-id="' + v.id + '"><td class="mono">' + esc(v.number) + '</td><td>' + esc(Store.contactName(v.contactId)) + '</td><td class="mono">' + money(Store.invoiceTotal(v)) + '</td><td>' + statusPill(v.status) + '</td><td class="muted ' + (v.status === 'overdue' ? 'bad' : '') + '">' + esc(f.fmtDate(v.dueAt)) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">' + empty('No invoices yet.', 'New invoice', 'new-invoice') + '</td></tr>';
      return toolbar + card('<table class="tbl"><thead><tr><th>Number</th><th>Client</th><th>Total</th><th>Status</th><th>Due</th></tr></thead><tbody>' + rows + '</tbody></table>', 'nopad rise');
    }
  };
  function invoiceDrawer(id) {
    var v = Store.get('invoices', id); if (!v) return; var c = Store.get('contacts', v.contactId);
    var body = '<div class="dr-amt mono">' + money(Store.invoiceTotal(v)) + '</div><div class="dr-fields">' + drf('Client', c ? esc(c.name) : '—') + drf('Number', '<span class="mono">' + esc(v.number) + '</span>') + drf('Status', statusPill(v.status)) + drf('Due', esc(f.fmtDateY(v.dueAt))) + '</div>' + lineItemsBlock(v.items) +
      (v.status === 'paid' ? '<div class="paid-stamp">' + icon('check') + ' Paid ' + esc(f.fmtDateY(v.paidAt)) + '</div>' : '');
    var actions = '';
    if (v.status !== 'paid') actions += btn('Mark paid', { variant: 'brand', icon: 'check', action: 'mark-paid', data: { id: v.id } });
    if (v.status !== 'paid') actions += btn('Send reminder', { icon: 'send', action: 'ai-remind', data: { id: v.id } });
    actions += btn('Email', { icon: 'mail', action: 'compose', data: { to: c ? c.email : '', name: c ? c.name : '' } });
    return drawerShell('<div><div class="dr-name mono">' + esc(v.number) + '</div><div class="dr-sub2">' + (c ? esc(c.name) : '') + '</div></div>', body, actions);
  }

  /* ================= INBOX ================= */
  V.inbox = {
    render: function () {
      var sel = App.state.thread || (Store.all('conversations')[0] && Store.all('conversations')[0].id); App.state.thread = sel;
      var list = Store.all('conversations').slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).map(function (cv) {
        var c = Store.get('contacts', cv.contactId); var last = cv.messages[cv.messages.length - 1];
        return '<div class="thread' + (cv.id === sel ? ' on' : '') + (cv.unread ? ' unread' : '') + '" data-action="open-thread" data-id="' + cv.id + '">' + avatar(c ? c.name : '?', 36) +
          '<div class="th-main"><div class="th-top"><span class="th-name">' + esc(c ? c.name : '') + '</span><span class="th-when mono">' + esc(f.relDay(cv.at)) + '</span></div><div class="th-prev">' + icon(cv.channel === 'sms' ? 'phone' : 'mail') + ' ' + esc(last.text) + '</div></div></div>';
      }).join('');
      return '<div class="inbox">' + card('<div class="thread-list">' + list + '</div>', 'nopad rise') + card(threadPane(sel), 'nopad rise inbox-pane') + '</div>';
    }
  };
  function threadPane(id) {
    var cv = Store.get('conversations', id); if (!cv) return empty('Select a conversation.');
    var c = Store.get('contacts', cv.contactId);
    var msgs = cv.messages.map(function (m) { return '<div class="msg ' + (m.from === 'me' ? 'me' : 'them') + '"><div class="bubble">' + esc(m.text) + '</div><div class="msg-when mono">' + esc(f.relDay(m.at)) + '</div></div>'; }).join('');
    return '<div class="pane-head">' + avatar(c ? c.name : '?', 34) + '<div><div class="dr-name">' + esc(c ? c.name : '') + '</div><div class="dr-sub2">' + esc(c ? c.email : '') + ' · ' + esc(cv.channel.toUpperCase()) + '</div></div>' + btn('Profile', { sm: true, action: 'open-record', data: { type: 'contact', id: cv.contactId } }) + '</div>' +
      '<div class="pane-msgs" id="pane-msgs">' + msgs + '</div><div class="pane-compose"><input id="reply-box" class="inp" placeholder="Write a reply…">' + btn('', { variant: 'brand', icon: 'send', action: 'send-reply', data: { id: cv.id } }) + '</div>';
  }

  /* ================= AUTOMATIONS ================= */
  V.automations = {
    render: function () {
      var toolbar = '<div class="toolbar"><p class="muted">Workflows run automatically in the background. Toggle any on or off.</p><div class="grow"></div>' + btn('New automation', { variant: 'brand', sm: true, action: 'new-automation' }) + '</div>';
      var cards = Store.all('automations').map(function (a) {
        return '<div class="auto-card' + (a.enabled ? '' : ' off') + '"><div class="auto-top"><div class="auto-bolt">' + icon('automation') + '</div>' +
          '<label class="switch"><input type="checkbox" ' + (a.enabled ? 'checked' : '') + ' data-action="toggle-automation" data-id="' + a.id + '"><span class="slider"></span></label></div>' +
          '<div class="auto-name">' + esc(a.name) + '</div><div class="auto-flow"><span class="auto-when">WHEN</span> ' + esc(a.trigger) + '</div>' +
          '<div class="auto-flow"><span class="auto-then">THEN</span> ' + esc(a.action) + '</div><div class="auto-runs mono">' + a.runs + ' runs</div></div>';
      }).join('');
      return toolbar + '<div class="auto-grid rise">' + cards + '</div>';
    }
  };

  /* ================= REPORTS ================= */
  V.reports = {
    render: function () {
      var k = Store.kpis(); var mLabels = []; var base = [22, 28, 26, 34, 31, 0]; var nowM = Store.now.getMonth();
      for (var i = 5; i >= 0; i--) { var d = new Date(Store.now.getFullYear(), nowM - i, 1); mLabels.push(d.toLocaleDateString('en-US', { month: 'short' })); }
      base[5] = Math.round(k.revenueMTD / 1000) || 30;
      var revData = base.map(function (v, i) { return { label: mLabels[i], value: v, color: i === 5 ? 'var(--brand)' : '#c7d2fe' }; });
      var revCard = card(sectionTitle('Revenue', '<span class="mono muted">last 6 months ($k)</span>') + ch.barChart(revData, { h: 200 }), 'rise');
      var stages = [['lead', 'New leads', '#6366f1'], ['contacted', 'Contacted', '#3b82f6'], ['estimate', 'Estimate', '#7c3aed'], ['won', 'Won', '#10b981']];
      var fn = stages.map(function (st) { var arr = Store.all('deals').filter(function (d) { return d.stage === st[0]; }); return { label: st[1], value: arr.reduce(function (s, d) { return s + d.value; }, 0), color: st[2] }; });
      var funnelCard = card(sectionTitle('Pipeline funnel') + ch.funnel(fn), 'rise');
      var won = Store.all('deals').filter(function (d) { return d.stage === 'won'; }).length;
      var lost = Store.all('deals').filter(function (d) { return d.stage === 'lost'; }).length;
      var open = Store.all('deals').filter(function (d) { return d.stage !== 'won' && d.stage !== 'lost'; }).length;
      var winCard = card(sectionTitle('Win rate') + ch.donut([{ value: won, color: '#10b981' }, { value: lost || 0.5, color: '#f43f5e' }, { value: open, color: '#c7d2fe' }], k.winRate + '%', 'won') +
        '<div class="legend"><span><i style="background:#10b981"></i>Won ' + won + '</span><span><i style="background:#f43f5e"></i>Lost ' + lost + '</span><span><i style="background:#c7d2fe"></i>Open ' + open + '</span></div>', 'rise');
      var byClient = {}; Store.all('invoices').filter(function (v) { return v.status === 'paid'; }).forEach(function (v) { byClient[v.contactId] = (byClient[v.contactId] || 0) + Store.invoiceTotal(v); });
      var top = Object.keys(byClient).map(function (id) { return { name: Store.contactName(id), v: byClient[id] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5);
      var topCard = card(sectionTitle('Top clients', '<span class="mono muted">paid</span>') + top.map(function (t) { return '<div class="line-row"><div class="lr-main"><div class="lr-title">' + esc(t.name) + '</div></div><span class="mono">' + money(t.v) + '</span></div>'; }).join(''), 'rise');
      function statBox(label, val, kind) { return '<div class="stat rise"><div class="stat-label mono">' + label + '</div><div class="stat-val mono stat-c-' + kind + '">' + val + '</div></div>'; }
      var strip = '<div class="stat-grid">' + statBox('REVENUE MTD', money(k.revenueMTD), 'green') + statBox('PIPELINE', money(k.pipelineValue), 'indigo') + statBox('OUTSTANDING', money(k.outstanding), 'amber') + statBox('WIN RATE', k.winRate + '%', 'violet') + '</div>';
      return strip + '<div class="grid-2">' + revCard + funnelCard + '</div><div class="grid-2">' + winCard + topCard + '</div>';
    }
  };

  /* ================= SETTINGS ================= */
  V.settings = {
    render: function () {
      var s = Store.state().settings;
      var swatches = ['#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#db2777', '#ea580c'].map(function (c) { return '<button class="swatch' + (c === s.branding.primary ? ' on' : '') + '" style="background:' + c + '" data-action="set-primary" data-color="' + c + '"></button>'; }).join('');
      var biz = card(sectionTitle('Business profile') + '<div class="form-grid">' +
        field('Business name', input('set-name', 'value="' + esc(s.business.name) + '"')) + field('Phone', input('set-phone', 'value="' + esc(s.business.phone) + '"')) +
        field('Email', input('set-email', 'value="' + esc(s.business.email) + '"')) + field('Tax rate (%)', input('set-tax', 'type="number" step="0.1" value="' + s.taxRate + '"')) + '</div>' +
        field('Address', input('set-addr', 'value="' + esc(s.business.address) + '"')) +
        '<div class="form-grid"><div><span class="field-label">Brand color</span><div class="swatches">' + swatches + '</div></div></div><div class="mt12">' + btn('Save changes', { variant: 'brand', action: 'save-settings' }) + '</div>', 'rise');
      var team = card(sectionTitle('Team', btn('Add member', { sm: true, action: 'add-member' })) + Store.all('team').map(function (m) {
        return '<div class="line-row">' + avatar(m.name, 32, m.color) + '<div class="lr-main"><div class="lr-title">' + esc(m.name) + '</div><div class="lr-sub">' + esc(m.role) + ' · ' + esc(m.email) + '</div></div>' + pill(m.status, m.status === 'active' ? 'green' : 'gray') + btn('', { icon: 'trash', sm: true, action: 'remove-member', data: { id: m.id } }) + '</div>';
      }).join(''), 'rise');
      var integ = card(sectionTitle('Integrations') + [['Supabase', 'Sync data across devices & your whole team', 'pipeline'], ['Stripe', 'Take card payments on invoices', 'dollar'], ['QuickBooks', 'Push invoices & payments to your books', 'invoice'], ['Twilio', 'Send real SMS texts to clients', 'phone']].map(function (it) {
        return '<div class="line-row"><span class="int-ic">' + icon(it[2]) + '</span><div class="lr-main"><div class="lr-title">' + it[0] + '</div><div class="lr-sub">' + it[1] + '</div></div>' + btn('Connect', { sm: true, action: 'connect-integration', data: { name: it[0] } }) + '</div>';
      }).join(''), 'rise');
      var danger = card(sectionTitle('Data') + '<p class="muted">Your data is saved on this device. Reset returns everything to the sample set.</p><div class="mt12">' + btn('Reset to sample data', { action: 'reset-data' }) + '</div>', 'rise');
      return '<div class="grid-2">' + biz + team + '</div><div class="grid-2">' + integ + danger + '</div>';
    }
  };

  /* ================= AI ================= */
  function AI_CTX() {
    var k = Store.kpis();
    return 'Revenue MTD ' + money(k.revenueMTD) + '. Pipeline ' + money(k.pipelineValue) + ' across ' + k.openDeals + ' open deals. Outstanding ' + money(k.outstanding) + '. ' +
      'Open estimates: ' + Store.all('estimates').filter(function (e) { return e.status === 'sent'; }).map(function (e) { return e.number + ' ' + Store.contactName(e.contactId) + ' ' + money(Store.estimateTotal(e)); }).join('; ') + '. ' +
      'Overdue invoices: ' + Store.all('invoices').filter(function (v) { return v.status === 'overdue'; }).map(function (v) { return v.number + ' ' + Store.contactName(v.contactId) + ' ' + money(Store.invoiceTotal(v)); }).join('; ') + '. ' +
      'Hot leads: ' + Store.all('deals').filter(function (d) { return d.hot; }).map(function (d) { return d.title + ' ' + money(d.value); }).join('; ') + '.';
  }
  V.ai = {
    render: function () {
      var quick = ['What should I focus on today?', 'Draft a follow-up for the Ridgeline estimate', 'How is the business doing this month?', 'Which leads should I call first?'];
      return '<div class="ai-wrap rise"><div class="ai-msgs" id="ai-msgs"><div class="ai-msg bot"><span class="ai-avt">' + icon('ai') + '</span><div class="ai-bubble">Hey — I\'m your Viper assistant. I can see your jobs, deals, estimates, invoices and clients. Ask me what to prioritize, or have me draft an email.' +
        '<div class="ai-quick">' + quick.map(function (q) { return '<button class="qchip" data-action="ai-quick" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div></div></div></div>' +
        '<div class="ai-compose"><textarea id="ai-in" class="inp" rows="1" placeholder="Ask anything…"></textarea>' + btn('', { variant: 'brand', icon: 'send', action: 'ai-send' }) + '</div></div>';
    },
    mount: function () {
      var ta = document.getElementById('ai-in');
      if (ta) { ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; }); ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); A['ai-send'](); } }); }
    }
  };
  function aiPush(text, who) {
    var box = document.getElementById('ai-msgs'); if (!box) return null;
    var el = document.createElement('div'); el.className = 'ai-msg ' + (who === 'me' ? 'me' : 'bot');
    el.innerHTML = (who === 'me' ? '' : '<span class="ai-avt">' + icon('ai') + '</span>') + '<div class="ai-bubble"></div>';
    el.querySelector('.ai-bubble').textContent = text; box.appendChild(el); box.scrollTop = box.scrollHeight; return el;
  }
  function offlineReply(msg) {
    var m = msg.toLowerCase();
    if (m.indexOf('ridgeline') >= 0) return 'Subject: Following up on your rewire estimate (EST-1014)\n\nHi James,\n\nCircling back on the $24,000 full-building rewire we quoted. We can still hold a crew slot that fits your timeline, but it\'s filling for next month. Happy to walk the scope or adjust anything that helps you move forward — would a quick call this week work?\n\nBest,\nViper Electric · (208) 555-0100\n\n— Demo reply. Add your Anthropic API key (see README) for live drafts.';
    if (m.indexOf('focus') >= 0 || m.indexOf('today') >= 0 || m.indexOf('prior') >= 0) return 'Here\'s how I\'d rank today:\n\n1. Ridgeline EST-1014 ($24k) — 6 days cold, your biggest open deal. Send the follow-up first.\n2. Mesa Industrial ($18k lead) — never contacted. One call could open a big account.\n3. CoreLink INV-2008 ($3.2k) — overdue. Quick reminder while you\'re in your inbox.\n\nJobs today: Hartman 9 AM, Bloom 1 PM — both assigned.\n\n— Demo reply. Add your API key for live help.';
    if (m.indexOf('business') >= 0 || m.indexOf('doing') >= 0 || m.indexOf('month') >= 0) { var k = Store.kpis(); return 'This month:\n\n• Revenue: ' + money(k.revenueMTD) + '\n• Pipeline: ' + money(k.pipelineValue) + ' across ' + k.openDeals + ' open deals\n• Outstanding: ' + money(k.outstanding) + '\n• Win rate: ' + k.winRate + '%\n\nBiggest lever: collect the overdue invoices and close Ridgeline.\n\n— Demo reply. Add your API key for live numbers.'; }
    if (m.indexOf('lead') >= 0 || m.indexOf('call') >= 0) return 'Call these first:\n\n1. Mesa Industrial — $18k, brand-new and uncontacted. Lead with a free site walkthrough.\n2. Sunridge HOA — $9.5k lighting. Board referral, warm.\n3. Peak Fitness — existing client, easy re-engage on the panel upgrade.\n\n— Demo reply. Add your API key for tailored outreach.';
    return 'I\'m running in offline demo mode, so I can show how this works but can\'t reason live yet. Add your Anthropic API key (README, ~2 min) and I\'ll have full context on your jobs, clients, estimates, invoices and finances — and can draft any email ready to send.';
  }
  function aiSend(text) {
    var ta = document.getElementById('ai-in'); text = text || (ta && ta.value.trim()); if (!text) return;
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    aiPush(text, 'me'); var thinking = aiPush('Thinking…', 'bot');
    var sys = 'You are Viper, the built-in assistant for Viper Electric (small electrical contractor, Coeur d\'Alene ID). Be direct and useful. When asked to draft an email, write it ready to send with a subject line first. Business snapshot: ' + AI_CTX();
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, system: sys }) })
      .then(function (r) { if (!r.ok) throw new Error('no backend'); return r.json(); })
      .then(function (data) { thinking.querySelector('.ai-bubble').textContent = data.reply || offlineReply(text); })
      .catch(function () { thinking.querySelector('.ai-bubble').textContent = offlineReply(text); })
      .then(function () { var box = document.getElementById('ai-msgs'); if (box) box.scrollTop = box.scrollHeight; });
  }
  App._aiSend = aiSend;

  /* ================= DRAG/DROP ================= */
  function setupBoard(boardSel, colSel, onDrop) {
    var board = document.querySelector(boardSel); if (!board) return; var dragId = null;
    board.addEventListener('dragstart', function (e) { var c = e.target.closest('[draggable]'); if (!c) return; dragId = c.getAttribute('data-id'); c.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
    board.addEventListener('dragend', function (e) { var c = e.target.closest('[draggable]'); if (c) c.classList.remove('dragging'); });
    Array.prototype.forEach.call(board.querySelectorAll(colSel), function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop-hot'); });
      col.addEventListener('dragleave', function () { col.classList.remove('drop-hot'); });
      col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('drop-hot'); var id = dragId; try { id = e.dataTransfer.getData('text/plain') || dragId; } catch (x) {} if (id) onDrop(id, col.getAttribute('data-stage')); dragId = null; });
    });
  }
  App._setupBoard = setupBoard;

  /* ================= RECORD ROUTER ================= */
  function openRecord(type, id) {
    App._drawerType = type;
    var html = type === 'contact' ? contactDrawer(id) : type === 'deal' ? dealDrawer(id) : type === 'job' ? jobDrawer(id) : type === 'estimate' ? estimateDrawer(id) : type === 'invoice' ? invoiceDrawer(id) : null;
    if (html) App.openDrawer(html);
  }
  App._openRecord = openRecord;

  /* ================= BUILDER FORM ================= */
  function liRow(it) {
    return '<div class="li-edit"><input class="inp li-desc" placeholder="Description" value="' + esc(it.desc || '') + '"><input class="inp li-qty" type="number" min="1" value="' + (it.qty || 1) + '"><input class="inp li-rate" type="number" placeholder="0" value="' + (it.rate || '') + '"><button class="icon-btn" data-action="li-remove">' + icon('x') + '</button></div>';
  }
  function builderRows(items) { return (items && items.length ? items : [{ desc: '', qty: 1, rate: '' }]).map(liRow).join(''); }
  function recalc(root) {
    var sub = 0; Array.prototype.forEach.call(root.querySelectorAll('.li-edit'), function (r) { sub += (+r.querySelector('.li-qty').value || 0) * (+r.querySelector('.li-rate').value || 0); });
    var t = Store.withTax(sub);
    root.querySelector('.bld-sub').textContent = money2(t.sub); root.querySelector('.bld-tax').textContent = money2(t.tax); root.querySelector('.bld-total').textContent = money2(t.total);
  }
  function readItems(root) {
    var items = []; Array.prototype.forEach.call(root.querySelectorAll('.li-edit'), function (r) {
      var desc = r.querySelector('.li-desc').value.trim(), qty = +r.querySelector('.li-qty').value || 1, rate = +r.querySelector('.li-rate').value || 0;
      if (desc || rate) items.push({ desc: desc || 'Item', qty: qty, rate: rate });
    }); return items;
  }
  function builderModal(kind, contactId) {
    var title = kind === 'estimate' ? 'New estimate' : 'New invoice';
    var body = '<div class="form-grid">' + field('Client', '<select class="inp" id="bld-client">' + contactOptions(contactId) + '</select>') + field(kind === 'estimate' ? 'Valid until' : 'Due date', input('bld-date', 'type="date" value="' + Store.iso(Store.dayShift(30)) + '"')) + '</div>' +
      '<div class="bld-head"><span>Description</span><span>Qty</span><span>Rate</span><span></span></div><div class="li-rows" id="bld-rows">' + builderRows() + '</div>' +
      '<button class="add-line" data-action="li-add">' + icon('plus') + ' Add line</button>' +
      '<div class="bld-totals"><div><span>Subtotal</span><span class="mono bld-sub">$0.00</span></div><div><span>Tax</span><span class="mono bld-tax">$0.00</span></div><div class="grand"><span>Total</span><span class="mono bld-total">$0.00</span></div></div>';
    var footer = btn('Cancel', { action: 'close-modal' }) + btn(kind === 'estimate' ? 'Save & send' : 'Create invoice', { variant: 'brand', action: kind === 'estimate' ? 'create-estimate' : 'create-invoice' });
    App.openModal(title, body, footer, { wide: true, mount: function (root) { root.addEventListener('input', function (e) { if (e.target.closest('.li-edit')) recalc(root); }); recalc(root); } });
  }
  App._builderModal = builderModal; App._liRow = liRow; App._recalc = recalc; App._readItems = readItems;
  App._field = field; App._input = input; App._contactOptions = contactOptions; App._PSTAGES = PSTAGES; App._JSTAGES = JSTAGES;
  App._offlineReply = offlineReply;

  /* =================================================================
     ACTIONS
     ================================================================= */
  A['open-record'] = function (el, d) { openRecord(d.type, d.id); };
  A['close-drawer'] = function () { App.closeDrawer(); };
  A['close-modal'] = function () { App.closeModal(); };
  A['toggle-nav'] = function () { document.body.classList.toggle('nav-open'); };

  A['toggle-notif'] = function () {
    var acts = Store.all('activities').slice(0, 8).map(function (a) { return '<div class="act-row"><span class="act-ic">' + icon('spark') + '</span><div><div class="act-text">' + esc(a.text) + '</div><div class="act-when mono">' + esc(f.relDay(a.at)) + '</div></div></div>'; }).join('');
    App.openModal('Notifications', '<div class="act-list">' + acts + '</div>', btn('Mark all read', { variant: 'brand', action: 'mark-notifs-read' }));
  };
  A['mark-notifs-read'] = function () { Store.state().settings.notifRead = true; Store.save(); App.closeModal(); var dot = document.querySelector('.notif .dot'); if (dot) dot.remove(); App.toast('All caught up.'); };

  A['open-search'] = function () {
    var body = '<div class="search-inp big">' + icon('search') + '<input id="cmd-input" placeholder="Search contacts, deals, invoices, pages…"></div><div id="cmd-results" class="cmd-results"></div>';
    App.openModal('Search', body, '', { mount: function (root) {
      var inp = root.querySelector('#cmd-input'), res = root.querySelector('#cmd-results');
      function idx() {
        var out = [];
        Store.all('contacts').forEach(function (c) { out.push({ k: 'Contact', l: c.name, s: c.company, go: function () { App.go('contacts'); setTimeout(function () { openRecord('contact', c.id); }, 60); } }); });
        Store.all('deals').forEach(function (d) { out.push({ k: 'Deal', l: d.title, s: money(d.value), go: function () { App.go('pipeline'); setTimeout(function () { openRecord('deal', d.id); }, 60); } }); });
        Store.all('estimates').forEach(function (e) { out.push({ k: 'Estimate', l: e.number, s: Store.contactName(e.contactId), go: function () { App.go('estimates'); setTimeout(function () { openRecord('estimate', e.id); }, 60); } }); });
        Store.all('invoices').forEach(function (v) { out.push({ k: 'Invoice', l: v.number, s: Store.contactName(v.contactId), go: function () { App.go('invoices'); setTimeout(function () { openRecord('invoice', v.id); }, 60); } }); });
        [['Dashboard', 'home'], ['Pipeline', 'pipeline'], ['Jobs', 'jobs'], ['Schedule', 'schedule'], ['Reports', 'reports'], ['Settings', 'settings']].forEach(function (p) { out.push({ k: 'Page', l: p[0], s: 'Open', go: function () { App.go(p[1]); } }); });
        return out;
      }
      var all = idx();
      function run() {
        var q = inp.value.toLowerCase().trim();
        var hits = !q ? all.slice(0, 6) : all.filter(function (h) { return (h.l + ' ' + h.s + ' ' + h.k).toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
        res.innerHTML = hits.map(function (h, i) { return '<div class="cmd-row" data-i="' + i + '"><span class="cmd-k">' + h.k + '</span><span class="cmd-l">' + esc(h.l) + '</span><span class="cmd-s">' + esc(h.s) + '</span></div>'; }).join('');
        App._cmdHits = hits;
      }
      inp.addEventListener('input', run);
      res.addEventListener('click', function (e) { var row = e.target.closest('.cmd-row'); if (!row) return; var h = App._cmdHits[+row.getAttribute('data-i')]; App.closeModal(); h.go(); });
      run();
    } });
  };

  A['open-create'] = function () {
    var opts = [['New contact', 'new-contact', 'users'], ['New deal', 'new-deal', 'pipeline'], ['New estimate', 'new-estimate', 'estimate'], ['New invoice', 'new-invoice', 'invoice'], ['New job', 'new-job', 'jobs'], ['New task', 'quick-task', 'check']];
    App.openModal('Create', '<div class="create-grid">' + opts.map(function (o) { return '<button class="create-tile" data-action="' + o[1] + '">' + icon(o[2]) + '<span>' + o[0] + '</span></button>'; }).join('') + '</div>');
  };

  /* contacts */
  A['new-contact'] = function (el, d) {
    var body = '<div class="form-grid">' + field('Name', input('nc-name', 'placeholder="Full name"')) + field('Company', input('nc-co', 'placeholder="Company"')) +
      field('Email', input('nc-em', 'placeholder="email@…"')) + field('Phone', input('nc-ph', 'placeholder="(208) …"')) +
      field('Type', '<select class="inp" id="nc-type"><option>Residential</option><option>Commercial</option><option>Industrial</option></select>') +
      field('Stage', '<select class="inp" id="nc-stage"><option value="lead">Lead</option><option value="prospect">Prospect</option><option value="customer">Customer</option></select>') + '</div>' + field('Address', input('nc-addr', 'placeholder="Street, City"'));
    App.openModal('New contact', body, btn('Cancel', { action: 'close-modal' }) + btn('Save contact', { variant: 'brand', action: 'create-contact' }));
  };
  A['create-contact'] = function () {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var name = g('nc-name'); if (!name) { App.toast('Add a name first.', 'error'); return; }
    var c = Store.insert('contacts', { name: name, company: g('nc-co') || name, email: g('nc-em') || '—', phone: g('nc-ph') || '—', type: g('nc-type') || 'Residential', stage: document.getElementById('nc-stage').value, owner: 'u_ops', address: g('nc-addr'), tags: [], createdAt: Store.iso(Store.now), lastContact: Store.iso(Store.now) }, true);
    Store.logActivity('lead', 'New contact added — ' + name);
    App.closeModal(); App.toast(name + ' saved to contacts.'); App.go('contacts'); setTimeout(function () { openRecord('contact', c.id); }, 80);
  };

  /* deals */
  A['new-deal'] = function (el, d) {
    var body = '<div class="form-grid">' + field('Title', input('nd-title', 'placeholder="e.g. Panel upgrade"')) + field('Value', input('nd-val', 'type="number" placeholder="0"')) + '</div>' +
      field('Contact', '<select class="inp" id="nd-contact">' + contactOptions(d && d.contact) + '</select>') +
      field('Stage', '<select class="inp" id="nd-stage">' + PSTAGES.slice(0, 4).map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>');
    App.openModal('New deal', body, btn('Cancel', { action: 'close-modal' }) + btn('Create deal', { variant: 'brand', action: 'create-deal' }));
  };
  A['create-deal'] = function () {
    var title = document.getElementById('nd-title').value.trim(); if (!title) { App.toast('Add a title.', 'error'); return; }
    Store.insert('deals', { title: title, contactId: document.getElementById('nd-contact').value, value: +document.getElementById('nd-val').value || 0, stage: document.getElementById('nd-stage').value, owner: 'u_ops', createdAt: Store.iso(Store.now), note: '' }, true);
    Store.logActivity('deal', 'New deal — ' + title); App.closeModal(); App.toast('Deal added to pipeline.'); App.go('pipeline');
  };
  A['move-deal'] = function (el, d) {
    var deal = Store.get('deals', d.id); if (!deal) return;
    var i = PSTAGES.findIndex(function (s) { return s[0] === deal.stage; }) + (+d.dir); if (i < 0 || i >= PSTAGES.length) return;
    Store.update('deals', d.id, { stage: PSTAGES[i][0] }); if (PSTAGES[i][0] === 'won') Store.logActivity('deal', deal.title + ' moved to Won'); App.refresh();
  };
  A['set-deal-stage'] = function (el, d) { Store.update('deals', d.id, { stage: d.stage }); App.refresh(); if (App._drawerType === 'deal') openRecord('deal', d.id); };

  /* jobs */
  A['new-job'] = function (el, d) {
    var body = '<div class="form-grid">' + field('Title', input('nj-title', 'placeholder="e.g. Panel upgrade"')) + field('Value', input('nj-val', 'type="number" placeholder="0"')) + '</div>' +
      field('Client', '<select class="inp" id="nj-contact">' + contactOptions(d && d.contact) + '</select>') +
      '<div class="form-grid">' + field('Date', input('nj-date', 'type="date" value="' + Store.iso(Store.now) + '"')) + field('Time', input('nj-time', 'type="time" value="09:00"')) + '</div>' +
      field('Assign to', '<select class="inp" id="nj-assign">' + Store.all('team').map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('') + '</select>') +
      field('Notes', '<textarea class="inp" id="nj-notes" rows="2" placeholder="Scope, access, materials…"></textarea>');
    App.openModal('New job', body, btn('Cancel', { action: 'close-modal' }) + btn('Schedule job', { variant: 'brand', action: 'create-job' }));
  };
  A['create-job'] = function () {
    var title = document.getElementById('nj-title').value.trim(); if (!title) { App.toast('Add a title.', 'error'); return; }
    var cid = document.getElementById('nj-contact').value, val = +document.getElementById('nj-val').value || 0;
    Store.insert('jobs', { title: title, contactId: cid, value: val, status: 'scheduled', assignedTo: document.getElementById('nj-assign').value, date: document.getElementById('nj-date').value, time: document.getElementById('nj-time').value, address: (Store.get('contacts', cid) || {}).address || '', notes: document.getElementById('nj-notes').value.trim(), items: val ? [{ desc: title, qty: 1, rate: val }] : [] }, true);
    Store.logActivity('job', 'Job scheduled — ' + title); App.closeModal(); App.toast('Job scheduled. Confirmation text queued.'); App.go('jobs');
  };
  A['move-job'] = function (el, d) {
    var j = Store.get('jobs', d.id); if (!j) return;
    var i = JSTAGES.findIndex(function (s) { return s[0] === j.status; }) + (+d.dir); if (i < 0 || i >= JSTAGES.length) return;
    Store.update('jobs', d.id, { status: JSTAGES[i][0] }); App.refresh(); App.closeDrawer();
  };
  A['complete-job'] = function (el, d) { Store.update('jobs', d.id, { status: 'complete' }); var j = Store.get('jobs', d.id); Store.logActivity('job', 'Job completed — ' + j.title); App.refresh(); App.closeDrawer(); App.toast('Job complete. Ready to invoice.'); };
  A['job-to-invoice'] = function (el, d) {
    var j = Store.get('jobs', d.id); if (!j) return; var n = 'INV-' + (Store.state().counters.inv++);
    Store.insert('invoices', { number: n, contactId: j.contactId, jobId: j.id, items: j.items.length ? j.items : [{ desc: j.title, qty: 1, rate: j.value }], status: 'sent', issuedAt: Store.iso(Store.now), dueAt: Store.iso(Store.dayShift(30)), paidAt: null }, true);
    Store.update('jobs', d.id, { status: 'invoiced' }); Store.logActivity('invoice', 'Invoice ' + n + ' created from job');
    App.closeDrawer(); App.toast('Invoice ' + n + ' created.'); App.go('invoices');
  };

  /* tasks */
  A['add-task'] = function (el, d) {
    var status = (d && d.status) || 'todo';
    App.openModal('New task', field('Task', input('nt-title', 'placeholder="What needs doing?"')) + '<div class="form-grid">' + field('Priority', '<select class="inp" id="nt-prio"><option value="high">High</option><option value="med" selected>Medium</option><option value="low">Low</option></select>') + field('Due', input('nt-due', 'type="date" value="' + Store.iso(Store.dayShift(2)) + '"')) + '</div>',
      btn('Cancel', { action: 'close-modal' }) + btn('Add task', { variant: 'brand', action: 'create-task', data: { status: status } }));
  };
  A['quick-task'] = function () { A['add-task'](null, { status: 'todo' }); };
  A['create-task'] = function (el, d) {
    var title = document.getElementById('nt-title').value.trim(); if (!title) { App.toast('Add a task.', 'error'); return; }
    Store.insert('tasks', { title: title, status: (d && d.status) || 'todo', priority: document.getElementById('nt-prio').value, dueDate: document.getElementById('nt-due').value, assignedTo: 'u_ops', contactId: null }, true);
    App.closeModal(); App.toast('Task added.'); if (App.state.route === 'tasks' || App.state.route === 'home') App.refresh();
  };
  A['move-task'] = function (el, d) {
    var t = Store.get('tasks', d.id); if (!t) return; var order = ['todo', 'doing', 'done']; var i = order.indexOf(t.status) + (+d.dir);
    if (i < 0 || i >= order.length) return; Store.update('tasks', d.id, { status: order[i] }); App.refresh();
  };
  A['del-task'] = function (el, d) { Store.remove('tasks', d.id); App.refresh(); };
  A['task-done'] = function (el, d) { Store.update('tasks', d.id, { status: 'done' }); App.refresh(); App.toast('Nice — task done.'); };

  /* estimates */
  A['new-estimate'] = function (el, d) { App.closeDrawer(); builderModal('estimate', d && d.contact); };
  A['li-add'] = function (el) { el.closest('.modal').querySelector('#bld-rows').insertAdjacentHTML('beforeend', liRow({ desc: '', qty: 1, rate: '' })); };
  A['li-remove'] = function (el) { var root = el.closest('.modal'); el.closest('.li-edit').remove(); recalc(root); };
  A['create-estimate'] = function (el) {
    var root = el.closest('.modal'); var cid = root.querySelector('#bld-client').value; var items = readItems(root);
    if (!items.length) { App.toast('Add at least one line item.', 'error'); return; }
    var n = 'EST-' + (Store.state().counters.est++);
    var e = Store.insert('estimates', { number: n, contactId: cid, dealId: null, items: items, status: 'sent', createdAt: Store.iso(Store.now), validUntil: root.querySelector('#bld-date').value }, true);
    Store.insert('deals', { title: items[0].desc + ' — ' + Store.contactName(cid), contactId: cid, value: Store.estimateTotal(e), stage: 'estimate', owner: 'u_ops', createdAt: Store.iso(Store.now), note: n + ' sent' }, true);
    Store.logActivity('estimate', n + ' sent to ' + Store.contactName(cid));
    App.closeModal(); App.toast(n + ' sent to ' + Store.contactName(cid) + '.'); App.go('estimates'); setTimeout(function () { openRecord('estimate', e.id); }, 80);
  };
  A['send-estimate'] = function (el, d) { Store.update('estimates', d.id, { status: 'sent' }); var e = Store.get('estimates', d.id); Store.logActivity('estimate', e.number + ' sent'); App.refresh(); openRecord('estimate', d.id); App.toast('Estimate sent.'); };
  A['approve-estimate'] = function (el, d) { Store.update('estimates', d.id, { status: 'approved' }); App.refresh(); openRecord('estimate', d.id); App.toast('Marked approved. Convert it to a job when ready.'); };
  A['estimate-to-job'] = function (el, d) {
    var e = Store.get('estimates', d.id); if (!e) return;
    Store.insert('jobs', { title: e.items[0].desc, contactId: e.contactId, value: Store.lineTotal(e.items), status: 'scheduled', assignedTo: 'u_owner', date: Store.iso(Store.dayShift(3)), time: '09:00', address: (Store.get('contacts', e.contactId) || {}).address || '', notes: 'From ' + e.number, items: e.items }, true);
    Store.logActivity('job', 'Job created from ' + e.number); App.closeDrawer(); App.toast('Job created from ' + e.number + '.'); App.go('jobs');
  };
  A['ai-followup'] = function (el, d) { var e = Store.get('estimates', d.id); App.closeDrawer(); App.go('ai'); setTimeout(function () { aiSend('Draft a follow-up email for ' + Store.contactName(e.contactId) + ' about estimate ' + e.number + ' for ' + money(Store.estimateTotal(e)) + '.'); }, 120); };

  /* invoices */
  A['new-invoice'] = function (el, d) { App.closeDrawer(); builderModal('invoice', d && d.contact); };
  A['create-invoice'] = function (el) {
    var root = el.closest('.modal'); var cid = root.querySelector('#bld-client').value; var items = readItems(root);
    if (!items.length) { App.toast('Add at least one line item.', 'error'); return; }
    var n = 'INV-' + (Store.state().counters.inv++);
    var v = Store.insert('invoices', { number: n, contactId: cid, jobId: null, items: items, status: 'sent', issuedAt: Store.iso(Store.now), dueAt: root.querySelector('#bld-date').value, paidAt: null }, true);
    Store.logActivity('invoice', n + ' sent to ' + Store.contactName(cid)); App.closeModal(); App.toast(n + ' sent with pay link.'); App.go('invoices'); setTimeout(function () { openRecord('invoice', v.id); }, 80);
  };
  A['mark-paid'] = function (el, d) {
    Store.update('invoices', d.id, { status: 'paid', paidAt: Store.iso(Store.now) }); var v = Store.get('invoices', d.id);
    Store.logActivity('invoice', 'Payment received — ' + Store.contactName(v.contactId) + ' ' + money(Store.invoiceTotal(v))); App.refresh(); openRecord('invoice', d.id); App.toast('Marked paid. Added to revenue.');
  };
  A['ai-remind'] = function (el, d) { var v = Store.get('invoices', d.id); App.closeDrawer(); App.go('ai'); setTimeout(function () { aiSend('Draft a payment reminder for ' + Store.contactName(v.contactId) + ', invoice ' + v.number + ', ' + money(Store.invoiceTotal(v)) + '.'); }, 120); };

  /* inbox */
  A['open-thread'] = function (el, d) { App.state.thread = d.id; Store.update('conversations', d.id, { unread: false }); App.refresh(); };
  A['send-reply'] = function (el, d) {
    var box = document.getElementById('reply-box'); var text = box && box.value.trim(); if (!text) return;
    var cv = Store.get('conversations', d.id); cv.messages.push({ from: 'me', text: text, at: Store.iso(Store.now) }); cv.at = Store.iso(Store.now); Store.save(); App.refresh(); App.toast('Message sent.');
  };
  A['compose'] = function (el, d) {
    App.closeDrawer();
    App.openModal('New message', field('To', input('cmp-to', 'value="' + esc(d.to || '') + '"')) + field('Subject', input('cmp-sub', 'value="' + esc(d.name ? 'Following up — ' + d.name : '') + '"')) + field('Message', '<textarea class="inp" id="cmp-body" rows="6" placeholder="Write your message…"></textarea>'),
      btn('Cancel', { action: 'close-modal' }) + btn('Send', { variant: 'brand', icon: 'send', action: 'send-compose' }));
  };
  A['send-compose'] = function () { App.closeModal(); App.toast('Message sent.'); };

  /* automations */
  A['toggle-automation'] = function (el, d) { var a = Store.get('automations', d.id); Store.update('automations', d.id, { enabled: !a.enabled }); App.refresh(); };
  A['new-automation'] = function () {
    App.openModal('New automation', field('Name', input('na-name', 'placeholder="e.g. Win-back text"')) + field('When (trigger)', input('na-trig', 'placeholder="e.g. No job booked in 60 days"')) + field('Then (action)', input('na-act', 'placeholder="e.g. Send win-back offer text"')),
      btn('Cancel', { action: 'close-modal' }) + btn('Create', { variant: 'brand', action: 'create-automation' }));
  };
  A['create-automation'] = function () {
    var name = document.getElementById('na-name').value.trim(); if (!name) { App.toast('Name it first.', 'error'); return; }
    Store.insert('automations', { name: name, trigger: document.getElementById('na-trig').value || 'Custom trigger', action: document.getElementById('na-act').value || 'Custom action', enabled: true, runs: 0 }, true);
    App.closeModal(); App.toast('Automation created and turned on.'); App.go('automations');
  };

  /* settings */
  A['set-primary'] = function (el, d) {
    Store.state().settings.branding.primary = d.color; Store.save();
    document.documentElement.style.setProperty('--brand', d.color);
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (x) { x.classList.toggle('on', x.getAttribute('data-color') === d.color); });
    App.toast('Brand color updated.');
  };
  A['save-settings'] = function () {
    var s = Store.state(); var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    s.settings.business.name = g('set-name'); s.settings.business.phone = g('set-phone'); s.settings.business.email = g('set-email');
    s.settings.business.address = g('set-addr'); s.settings.taxRate = parseFloat(g('set-tax')) || 0; Store.save();
    document.querySelector('.brand-name').textContent = s.settings.business.name; App.toast('Settings saved.');
  };
  A['add-member'] = function () {
    App.openModal('Add team member', '<div class="form-grid">' + field('Name', input('tm-name', 'placeholder="Full name"')) + field('Role', input('tm-role', 'placeholder="e.g. Field Tech"')) + '</div>' + field('Email', input('tm-email', 'placeholder="name@viperelectric.com"')),
      btn('Cancel', { action: 'close-modal' }) + btn('Send invite', { variant: 'brand', action: 'create-member' }));
  };
  A['create-member'] = function () {
    var name = document.getElementById('tm-name').value.trim(); if (!name) { App.toast('Add a name.', 'error'); return; }
    Store.insert('team', { name: name, role: document.getElementById('tm-role').value || 'Team', email: document.getElementById('tm-email').value || '', phone: 'Pending', status: 'active', color: App._fmt.avatarColor(name), initials: App._fmt.initials(name) });
    App.closeModal(); App.toast(name + ' invited.'); App.go('settings');
  };
  A['remove-member'] = function (el, d) { Store.remove('team', d.id); App.refresh(); App.toast('Member removed.'); };
  A['connect-integration'] = function (el, d) { App.toast(d.name + ' — connect flow coming from your backend. See README.', 'info'); };
  A['reset-data'] = function () {
    App.openModal('Reset all data?', '<p class="muted">This clears everything you\'ve added on this device and restores the sample data. Can\'t be undone.</p>',
      btn('Cancel', { action: 'close-modal' }) + btn('Reset everything', { variant: 'brand', action: 'reset-confirm' }));
  };
  A['reset-confirm'] = function () { Store.resetAll(); App.closeModal(); App.go('home'); App.toast('Reset to sample data.'); };

  /* ai */
  A['ai-send'] = function () { aiSend(); };
  A['ai-quick'] = function (el, d) { aiSend(d.q); };

  /* calendar */
  A['cal-prev'] = function () { var c = App.state.cal; c.m--; if (c.m < 0) { c.m = 11; c.y--; } App.refresh(); };
  A['cal-next'] = function () { var c = App.state.cal; c.m++; if (c.m > 11) { c.m = 0; c.y++; } App.refresh(); };
  A['cal-day'] = function (el, d) { App.state.cal.sel = d.day; App.refresh(); };

  /* =================================================================
     BOOT
     ================================================================= */
  function start() {
    // apply saved brand color before first paint
    try { document.documentElement.style.setProperty('--brand', Store.state().settings.branding.primary); } catch (e) {}
    (App.launch || App.boot)();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else setTimeout(start, 0); // let pro.js finish wiring first
  }
  App._start = start;
})(typeof window !== 'undefined' ? window : this);
