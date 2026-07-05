/* =====================================================================
   Viper OS — store.js
   State, persistence, and selectors. Designed to map cleanly onto
   Supabase tables later: each collection below is effectively a table,
   ids are stable, and relations use *Id foreign keys.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEY = 'viper-os.v1';

  /* ---- id + date helpers ---------------------------------------- */
  function uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9); }
  var NOW = new Date();
  function dayShift(n) { var d = new Date(NOW); d.setDate(d.getDate() + n); return d; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // LOCAL calendar date (not UTC) — prevents the "off by a day" shift in the
  // evening for timezones west of UTC.
  function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function nowISO() { return new Date().toISOString(); }
  // parse a stored date safely: date-only strings become LOCAL midnight
  function parseDate(s) {
    if (!s) return null;
    if (typeof s === 'string' && s.length === 10 && s.indexOf('T') < 0) {
      var p = s.split('-'); return new Date(+p[0], (+p[1]) - 1, +p[2]);
    }
    return new Date(s);
  }
  // compact captioned placeholder "photo" (SVG data URL) so galleries look alive without heavy binaries
  function svgPhoto(label, c1, c2) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="6"><path d="M40 210h120l30-40 30 60 40-80 30 60h60"/><circle cx="320" cy="70" r="26"/></g><text x="20" y="285" font-family="monospace" font-size="18" fill="#ffffff" fill-opacity="0.9">' + label + '</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /* ---- seed (built relative to "today" so it always looks live) -- */
  function seed() {
    var team = [
      { id: 'u_owner', name: 'Ben Gloe', role: 'Owner / CEO', email: 'viprelectric208@gmail.com', phone: '', status: 'active', color: '#4f46e5', initials: 'BG', hourlyCost: 85 },
      { id: 'u_cofd', name: 'Zach Gardner', role: 'Owner / President', email: 'viprelectric208@gmail.com', phone: '', status: 'active', color: '#0891b2', initials: 'ZG', hourlyCost: 85 },
      { id: 'u_ops', name: 'Office / Dispatch', role: 'Operations', email: 'viprelectric208@gmail.com', phone: '', status: 'active', color: '#7c3aed', initials: 'OD', hourlyCost: 45 }
    ];

    var contacts = [
      { id: 'c_hart', name: 'Sarah Hartman', company: 'Hartman Residence', email: 's.hartman@email.com', phone: '(208) 555-2148', type: 'Residential', stage: 'customer', owner: 'u_ops', address: '14 Lakeshore Dr, Coeur d\'Alene, ID', tags: ['panel', 'repeat'], createdAt: iso(dayShift(-120)), lastContact: iso(NOW) },
      { id: 'c_bloom', name: 'Derek Bloom', company: 'Bloom Electric Co.', email: 'derek@bloomco.com', phone: '(208) 555-3394', type: 'Commercial', stage: 'customer', owner: 'u_owner', address: '88 Industry Way, Post Falls, ID', tags: ['ev', 'partner'], createdAt: iso(dayShift(-86)), lastContact: iso(dayShift(-1)) },
      { id: 'c_ridge', name: 'James Ridge', company: 'Ridgeline Commercial', email: 'james@ridgeline.com', phone: '(208) 555-4277', type: 'Commercial', stage: 'prospect', owner: 'u_owner', address: '2200 Seltice Way, Post Falls, ID', tags: ['rewire', 'big'], createdAt: iso(dayShift(-30)), lastContact: iso(dayShift(-6)) },
      { id: 'c_vista', name: 'Maria Torres', company: 'Vista Medical Center', email: 'm.torres@vistamed.com', phone: '(208) 555-5166', type: 'Commercial', stage: 'prospect', owner: 'u_ops', address: '500 Health Pkwy, Coeur d\'Alene, ID', tags: ['generator'], createdAt: iso(dayShift(-12)), lastContact: iso(dayShift(-2)) },
      { id: 'c_core', name: 'CoreLink Properties', company: 'CoreLink Properties', email: 'ap@corelink.com', phone: '(208) 555-6033', type: 'Commercial', stage: 'customer', owner: 'u_owner', address: '1 Riverstone Dr, Coeur d\'Alene, ID', tags: ['property-mgmt'], createdAt: iso(dayShift(-200)), lastContact: iso(dayShift(-3)) },
      { id: 'c_mesa', name: 'Mesa Industrial Park', company: 'Mesa Industrial', email: 'ops@mesaindustrial.com', phone: '(208) 555-7884', type: 'Industrial', stage: 'lead', owner: 'u_ops', address: '4100 Ramsey Rd, Hayden, ID', tags: ['assessment', 'hot'], createdAt: iso(dayShift(-4)), lastContact: null },
      { id: 'c_harbor', name: 'Harbor Lofts HOA', company: 'Harbor Lofts', email: 'mgmt@harborlofts.com', phone: '(208) 555-8821', type: 'Residential', stage: 'customer', owner: 'u_ops', address: '70 Marina Blvd, Coeur d\'Alene, ID', tags: ['hoa'], createdAt: iso(dayShift(-60)), lastContact: iso(dayShift(-5)) },
      { id: 'c_peak', name: 'Peak Fitness', company: 'Peak Fitness', email: 'owner@peakfit.com', phone: '(208) 555-9540', type: 'Commercial', stage: 'customer', owner: 'u_owner', address: '300 Government Way, Coeur d\'Alene, ID', tags: ['panel'], createdAt: iso(dayShift(-150)), lastContact: iso(dayShift(-15)) },
      { id: 'c_sun', name: 'Sunridge HOA', company: 'Sunridge HOA', email: 'board@sunridge.org', phone: '(208) 555-1190', type: 'Residential', stage: 'lead', owner: 'u_ops', address: '15 Sunridge Loop, Hayden, ID', tags: ['lighting'], createdAt: iso(dayShift(-3)), lastContact: null }
    ];

    var deals = [
      { id: 'd_mesa', title: 'Mesa Industrial — site assessment', contactId: 'c_mesa', value: 18000, stage: 'lead', owner: 'u_ops', createdAt: iso(dayShift(-4)), note: 'Inbound from website. Not contacted yet.', hot: true },
      { id: 'd_sun', title: 'Sunridge HOA — common area lighting', contactId: 'c_sun', value: 9500, stage: 'lead', owner: 'u_ops', createdAt: iso(dayShift(-3)), note: 'Board referral.' },
      { id: 'd_peak', title: 'Peak Fitness — panel upgrade', contactId: 'c_peak', value: 6200, stage: 'contacted', owner: 'u_owner', createdAt: iso(dayShift(-9)), note: 'Existing client, warm.' },
      { id: 'd_vista', title: 'Vista Medical — generator backup', contactId: 'c_vista', value: 14500, stage: 'estimate', owner: 'u_ops', createdAt: iso(dayShift(-8)), note: 'Estimate EST-1015 sent.' },
      { id: 'd_ridge', title: 'Ridgeline — full building rewire', contactId: 'c_ridge', value: 24000, stage: 'estimate', owner: 'u_owner', createdAt: iso(dayShift(-7)), note: 'EST-1014 sent. 6 days no reply.', hot: true },
      { id: 'd_harbor', title: 'Harbor Lofts — unit rewire x4', contactId: 'c_harbor', value: 11200, stage: 'won', owner: 'u_ops', createdAt: iso(dayShift(-20)), note: 'Approved. Scheduled.' },
      { id: 'd_core', title: 'CoreLink — phase 2 fit-out', contactId: 'c_core', value: 28000, stage: 'won', owner: 'u_owner', createdAt: iso(dayShift(-40)), note: 'Paid in full.' }
    ];

    var jobs = [
      { id: 'j_hart', title: '200A panel upgrade', contactId: 'c_hart', value: 4800, status: 'scheduled', assignedTo: 'u_owner', date: iso(NOW), time: '09:00', address: '14 Lakeshore Dr', notes: 'Replace main panel, add 4 circuits.', items: [{ desc: '200A panel + install', qty: 1, rate: 4800 }] },
      { id: 'j_bloom', title: 'EV charger install', contactId: 'c_bloom', value: 3200, status: 'scheduled', assignedTo: 'u_cofd', date: iso(NOW), time: '13:00', address: '88 Industry Way', notes: 'Level 2 charger, 60A circuit.', items: [{ desc: 'Level 2 EV charger + install', qty: 1, rate: 3200 }] },
      { id: 'j_mesaA', title: 'Site assessment', contactId: 'c_mesa', value: 0, status: 'scheduled', assignedTo: 'u_owner', date: iso(NOW), time: '16:00', address: '4100 Ramsey Rd', notes: 'Walkthrough + scope.', items: [] },
      { id: 'j_ridge', title: 'Floor 1 rewire', contactId: 'c_ridge', value: 8000, status: 'in_progress', assignedTo: 'u_cofd', date: iso(dayShift(-1)), time: '08:00', address: '2200 Seltice Way', notes: 'Phase 1 of 3.', items: [{ desc: 'Floor 1 rewire — labor + materials', qty: 1, rate: 8000 }] },
      { id: 'j_harbor', title: 'Unit rewire (4 units)', contactId: 'c_harbor', value: 11200, status: 'scheduled', assignedTo: 'u_cofd', date: iso(dayShift(5)), time: '08:00', address: '70 Marina Blvd', notes: 'All four corner units.', items: [{ desc: 'Unit rewire', qty: 4, rate: 2800 }] },
      { id: 'j_core', title: 'Phase 2 fit-out', contactId: 'c_core', value: 28000, status: 'complete', assignedTo: 'u_owner', date: iso(dayShift(-6)), time: '08:00', address: '1 Riverstone Dr', notes: 'Done. Invoiced + paid.', items: [{ desc: 'Phase 2 commercial electrical', qty: 1, rate: 28000 }] }
    ];

    var estimates = [
      { id: 'e_1014', number: 'EST-1014', contactId: 'c_ridge', dealId: 'd_ridge', items: [{ desc: 'Full building rewire — labor', qty: 1, rate: 18000 }, { desc: 'Materials & panels', qty: 1, rate: 6000 }], status: 'sent', createdAt: iso(dayShift(-7)), validUntil: iso(dayShift(23)) },
      { id: 'e_1015', number: 'EST-1015', contactId: 'c_vista', dealId: 'd_vista', items: [{ desc: 'Standby generator install', qty: 1, rate: 11500 }, { desc: 'Transfer switch & wiring', qty: 1, rate: 3000 }], status: 'sent', createdAt: iso(dayShift(-8)), validUntil: iso(dayShift(22)) },
      { id: 'e_1013', number: 'EST-1013', contactId: 'c_harbor', dealId: 'd_harbor', items: [{ desc: 'Unit rewire', qty: 4, rate: 2800 }], status: 'approved', createdAt: iso(dayShift(-20)), validUntil: iso(dayShift(10)) },
      { id: 'e_1012', number: 'EST-1012', contactId: 'c_peak', dealId: 'd_peak', items: [{ desc: '200A panel upgrade', qty: 1, rate: 6200 }], status: 'draft', createdAt: iso(dayShift(-2)), validUntil: iso(dayShift(28)) }
    ];

    var invoices = [
      { id: 'i_2008', number: 'INV-2008', contactId: 'c_core', jobId: 'j_core', items: [{ desc: 'Commercial fit-out — labor', qty: 1, rate: 3200 }], status: 'overdue', issuedAt: iso(dayShift(-30)), dueAt: iso(dayShift(-13)), paidAt: null },
      { id: 'i_2006', number: 'INV-2006', contactId: 'c_vista', jobId: null, items: [{ desc: 'Office fit-out — final balance', qty: 1, rate: 1800 }], status: 'overdue', issuedAt: iso(dayShift(-24)), dueAt: iso(dayShift(-6)), paidAt: null },
      { id: 'i_2009', number: 'INV-2009', contactId: 'c_bloom', jobId: 'j_bloom', items: [{ desc: 'EV charger install', qty: 1, rate: 3200 }], status: 'sent', issuedAt: iso(dayShift(-2)), dueAt: iso(dayShift(13)), paidAt: null },
      { id: 'i_2007', number: 'INV-2007', contactId: 'c_peak', jobId: null, items: [{ desc: '200A panel upgrade', qty: 1, rate: 6200 }], status: 'paid', issuedAt: iso(dayShift(-18)), dueAt: iso(dayShift(-4)), paidAt: iso(dayShift(-10)) },
      { id: 'i_2005', number: 'INV-2005', contactId: 'c_core', jobId: 'j_core', items: [{ desc: 'Phase 2 commercial electrical', qty: 1, rate: 28000 }], status: 'paid', issuedAt: iso(dayShift(-22)), dueAt: iso(dayShift(-8)), paidAt: iso(dayShift(-9)) }
    ];

    var tasks = [
      { id: 't1', title: 'Send Q3 service pricing sheet to commercial clients', status: 'todo', priority: 'med', dueDate: iso(dayShift(5)), assignedTo: 'u_ops', contactId: null },
      { id: 't2', title: 'Order materials for Harbor Lofts job', status: 'todo', priority: 'high', dueDate: iso(dayShift(3)), assignedTo: 'u_cofd', contactId: 'c_harbor' },
      { id: 't3', title: 'Follow up — Ridgeline rewire estimate', status: 'doing', priority: 'high', dueDate: iso(NOW), assignedTo: 'u_owner', contactId: 'c_ridge' },
      { id: 't4', title: 'Call Mesa Industrial — new lead', status: 'todo', priority: 'high', dueDate: iso(NOW), assignedTo: 'u_ops', contactId: 'c_mesa' },
      { id: 't5', title: 'Reconcile CoreLink payment in books', status: 'done', priority: 'low', dueDate: iso(dayShift(-2)), assignedTo: 'u_ops', contactId: 'c_core' }
    ];

    var conversations = [
      { id: 'cv1', contactId: 'c_ridge', channel: 'email', unread: true, at: iso(dayShift(-6)), messages: [
        { from: 'me', text: 'Hi James — sending over the rewire estimate (EST-1014) for the full building. Happy to walk through scope anytime.', at: iso(dayShift(-7)) },
        { from: 'them', text: 'Thanks, reviewing with the partners this week.', at: iso(dayShift(-6)) }
      ] },
      { id: 'cv2', contactId: 'c_hart', channel: 'sms', unread: false, at: iso(NOW), messages: [
        { from: 'me', text: 'Good morning Sarah! Confirming our 9 AM panel upgrade today. Dale will text when en route.', at: iso(NOW) },
        { from: 'them', text: 'Perfect, see you then!', at: iso(NOW) }
      ] },
      { id: 'cv3', contactId: 'c_mesa', channel: 'email', unread: true, at: iso(dayShift(-4)), messages: [
        { from: 'them', text: 'We need a quote for electrical work at our industrial park. Can someone come assess?', at: iso(dayShift(-4)) }
      ] },
      { id: 'cv4', contactId: 'c_core', channel: 'email', unread: false, at: iso(dayShift(-3)), messages: [
        { from: 'me', text: 'Friendly reminder that INV-2008 ($3,200) is past due. Secure pay link inside. Let me know if you need anything.', at: iso(dayShift(-3)) }
      ] }
    ];

    var automations = [
      { id: 'a1', name: 'New lead instant reply', trigger: 'Contact created with stage = Lead', action: 'Send intro email + create "Call within 24h" task', enabled: true, runs: 42 },
      { id: 'a2', name: 'Estimate follow-up', trigger: 'Estimate sent, no reply after 5 days', action: 'Send follow-up email + notify owner', enabled: true, runs: 18 },
      { id: 'a3', name: 'Job booked confirmation', trigger: 'Job scheduled', action: 'Text client confirmation + add to calendar', enabled: true, runs: 67 },
      { id: 'a4', name: 'On-my-way text', trigger: 'Tech marks job In Progress', action: 'Text client "Tech is on the way"', enabled: true, runs: 51 },
      { id: 'a5', name: 'Invoice on completion', trigger: 'Job marked Complete', action: 'Auto-generate invoice + email pay link', enabled: true, runs: 39 },
      { id: 'a6', name: 'Review request', trigger: 'Invoice paid', action: 'Wait 1 day, then text Google review link', enabled: false, runs: 24 },
      { id: 'a7', name: 'Overdue nudge', trigger: 'Invoice 3 days overdue', action: 'Send firm reminder + notify owner', enabled: true, runs: 11 }
    ];

    var activities = [
      { id: uid('act'), type: 'invoice', text: 'Payment received from Peak Fitness — $6,200', at: iso(dayShift(-10)) },
      { id: uid('act'), type: 'deal', text: 'Harbor Lofts deal moved to Won', at: iso(dayShift(-20)) },
      { id: uid('act'), type: 'lead', text: 'New lead captured — Mesa Industrial Park', at: iso(dayShift(-4)) },
      { id: uid('act'), type: 'estimate', text: 'Estimate EST-1014 sent to Ridgeline Commercial', at: iso(dayShift(-7)) },
      { id: uid('act'), type: 'job', text: 'Job completed — CoreLink phase 2 fit-out', at: iso(dayShift(-6)) }
    ];

    var settings = {
      business: { name: 'Vipr Electric', tagline: 'Licensed electricians · Kootenai & Bonner County, ID', phone: '', email: 'viprelectric208@gmail.com', address: 'Kootenai & Bonner County, ID', hours: 'Mon–Thurs, 7am–5pm', emergency: '24/7 for customers under warranty', warranty: '1-year warranty', serviceArea: 'Kootenai & Bonner County', veteranDiscount: true, owners: 'Ben Gloe (Owner/CEO) · Zach Gardner (Owner/President)' },
      branding: { primary: '#4f46e5', accent: '#06b6d4', logo: null, favicon: null, welcome: 'Here\'s what\'s happening at Vipr Electric today.', loginTagline: 'Licensed electricians · Kootenai & Bonner County', emailFooter: 'Vipr Electric · viprelectric208@gmail.com · Kootenai & Bonner County, ID · Licensed & insured' },
      services: [
        { id: 'svc_host', name: 'Website Hosting', category: 'Web', price: 49, active: true, desc: 'Fast, secure hosting with SSL and backups.' },
        { id: 'svc_maint', name: 'Website Maintenance', category: 'Web', price: 99, active: false, desc: 'Updates, edits, and monitoring each month.' },
        { id: 'svc_seo', name: 'SEO', category: 'Marketing', price: 499, active: false, desc: 'Rank higher and pull in organic leads.' },
        { id: 'svc_lseo', name: 'Local SEO', category: 'Marketing', price: 299, active: true, desc: 'Own the map pack in your service area.' },
        { id: 'svc_gbp', name: 'Google Business Profile', category: 'Marketing', price: 199, active: false, desc: 'Managed posts, photos, and Q&A.' },
        { id: 'svc_rep', name: 'Reputation Management', category: 'Marketing', price: 149, active: false, desc: 'Collect reviews and respond automatically.' },
        { id: 'svc_email', name: 'Email Marketing', category: 'Marketing', price: 199, active: false, desc: 'Campaigns, sequences, and broadcasts.' },
        { id: 'svc_blog', name: 'Blog Writing', category: 'Content', price: 299, active: false, desc: 'Fresh SEO articles every month.' },
        { id: 'svc_ai', name: 'AI Content', category: 'Content', price: 99, active: false, desc: 'On-demand AI copy for any channel.' },
        { id: 'svc_lp', name: 'Landing Pages', category: 'Web', price: 149, active: false, desc: 'High-converting pages for campaigns.' },
        { id: 'svc_funnel', name: 'Funnel Management', category: 'Web', price: 299, active: false, desc: 'Built and optimized sales funnels.' },
        { id: 'svc_analytics', name: 'Monthly Analytics', category: 'Reporting', price: 99, active: true, desc: 'A clear report of what\'s working.' },
        { id: 'svc_leads', name: 'Lead Generation', category: 'Marketing', price: 599, active: false, desc: 'Done-for-you lead campaigns.' },
        { id: 'svc_auto', name: 'Automation Services', category: 'Ops', price: 199, active: false, desc: 'Custom workflows that save hours.' },
        { id: 'svc_forms', name: 'Online Forms', category: 'Ops', price: 49, active: false, desc: 'Branded intake and survey forms.' },
        { id: 'svc_booking', name: 'Appointment Booking', category: 'Ops', price: 79, active: false, desc: 'Online scheduling for your calendar.' }
      ],
      taxRate: 6.0,
      terms: 'Net 30',
      notifRead: false,
      dashboard: ['kpis', 'revenue', 'schedule', 'pipeline', 'activity', 'tasks', 'leaderboard'],
      // what happens automatically as a deal advances through the pipeline
      stageAutomation: {
        contacted: { advanceContact: null, templateId: null, task: null, label: 'Logged first contact' },
        estimate: { advanceContact: 'prospect', templateId: 't_est', task: 'Follow up on estimate in 3 days', label: 'Estimate email queued' },
        won: { advanceContact: 'customer', templateId: 't_won', task: 'Schedule the job', label: 'Deal won — client is now a customer' },
        lost: { advanceContact: null, templateId: null, task: null, label: 'Marked lost' }
      }
    };

    var templates = [
      { id: 't_lead', name: 'New lead welcome', channel: 'email', event: 'new_lead', enabled: true, subject: 'Thanks for reaching out to {{business_name}}', body: 'Hi {{client_name}},\n\nThanks for contacting {{business_name}} — we got your request and someone from our team will reach out within one business day.\n\nIf it\'s urgent, call us any time at {{business_phone}}.\n\nTalk soon,\n{{business_name}}' },
      { id: 't_est', name: 'Estimate sent', channel: 'email', event: 'estimate_sent', enabled: true, subject: 'Your estimate {{estimate_number}} from {{business_name}}', body: 'Hi {{client_name}},\n\nYour estimate for {{job_title}} is ready — total {{amount}}. You can review and approve it here:\n\n{{link}}\n\nThis quote is good for 30 days. Reply with any questions and we\'ll get you on the schedule.\n\nThank you,\n{{business_name}}' },
      { id: 't_est_follow', name: 'Estimate follow-up', channel: 'email', event: 'estimate_followup', enabled: true, subject: 'Following up on estimate {{estimate_number}}', body: 'Hi {{client_name}},\n\nJust circling back on the {{amount}} estimate for {{job_title}}. We can still fit you into the schedule — want us to hold a slot?\n\nHappy to walk through anything,\n{{business_name}} · {{business_phone}}' },
      { id: 't_booked', name: 'Appointment confirmation', channel: 'sms', event: 'job_booked', enabled: true, subject: '', body: 'Hi {{client_name}}, this confirms {{business_name}} is scheduled for {{job_title}} on {{date}} at {{time}}. Your tech will text when on the way. Reply to reschedule.' },
      { id: 't_omw', name: 'On my way', channel: 'sms', event: 'on_my_way', enabled: true, subject: '', body: 'Hi {{client_name}}, {{tech_name}} from {{business_name}} is on the way to {{address}} and should arrive shortly. See you soon!' },
      { id: 't_complete', name: 'Job complete', channel: 'email', event: 'job_complete', enabled: true, subject: 'Your job is complete — {{business_name}}', body: 'Hi {{client_name}},\n\nWe\'ve wrapped up {{job_title}}. Thank you for choosing {{business_name}}!\n\nYour invoice will follow shortly. Photos of the finished work are in your client portal.\n\n{{business_name}}' },
      { id: 't_inv', name: 'Invoice sent', channel: 'email', event: 'invoice_sent', enabled: true, subject: 'Invoice {{invoice_number}} from {{business_name}}', body: 'Hi {{client_name}},\n\nYour invoice {{invoice_number}} for {{amount}} is ready. Pay securely online here:\n\n{{link}}\n\nThank you for your business,\n{{business_name}}' },
      { id: 't_receipt', name: 'Payment receipt', channel: 'sms', event: 'payment_received', enabled: true, subject: '', body: 'Thanks {{client_name}}! We received your payment of {{amount}}. A receipt is in your portal. We appreciate your business — {{business_name}}' },
      { id: 't_won', name: 'Deal won / welcome', channel: 'email', event: 'deal_won', enabled: true, subject: 'Welcome aboard — {{business_name}}', body: 'Hi {{client_name}},\n\nExcited to work with you on {{job_title}}! We\'ll be in touch to lock in a date. You now have a client portal where you can track progress and see photos.\n\n{{business_name}}' },
      { id: 't_review', name: 'Review request', channel: 'sms', event: 'review_request', enabled: false, subject: '', body: 'Hi {{client_name}}, it was a pleasure working with you! If you have a minute, a quick review really helps our small business: {{link}}  — {{business_name}}' },
      { id: 't_overdue', name: 'Overdue reminder', channel: 'email', event: 'invoice_overdue', enabled: true, subject: 'Friendly reminder: invoice {{invoice_number}} is past due', body: 'Hi {{client_name}},\n\nA quick reminder that invoice {{invoice_number}} for {{amount}} is now past due. You can pay securely here:\n\n{{link}}\n\nIf you\'ve already sent payment, thank you — please disregard.\n{{business_name}}' }
    ];

    var outbox = [
      { id: uid('ob'), contactId: 'c_ridge', channel: 'email', templateId: 't_est', subject: 'Your estimate EST-1014 from Viper Electric', body: 'Hi James, your estimate for the full building rewire is ready — total $25,440...', status: 'sent', at: iso(dayShift(-7)) },
      { id: uid('ob'), contactId: 'c_hart', channel: 'sms', templateId: 't_booked', subject: '', body: 'Hi Sarah, this confirms Viper Electric is scheduled for 200A panel upgrade today at 9:00 AM...', status: 'sent', at: iso(NOW) },
      { id: uid('ob'), contactId: 'c_core', channel: 'email', templateId: 't_overdue', subject: 'Friendly reminder: invoice INV-2008 is past due', body: 'Hi CoreLink, a quick reminder that invoice INV-2008 for $3,392 is now past due...', status: 'sent', at: iso(dayShift(-3)) }
    ];

    // give jobs a photo array + status timeline (field-tech uploads land here; portal reads them)
    jobs.forEach(function (j) {
      j.photos = j.photos || [];
      j.statusLog = j.statusLog || [{ status: j.status, at: j.date + 'T08:00:00.000Z', by: j.assignedTo }];
      if (j.onMyWayAt === undefined) j.onMyWayAt = null;
    });
    // sample progress photos so the portal + field views look real out of the box
    var jr = jobs.find(function (x) { return x.id === 'j_ridge'; });
    if (jr) jr.photos = [
      { id: uid('ph'), url: svgPhoto('Panel demo — before', '#1e293b', '#334155'), caption: 'Old panel removed', at: iso(dayShift(-1)) + 'T09:20:00.000Z', by: 'u_cofd' },
      { id: uid('ph'), url: svgPhoto('Rough-in complete', '#4f46e5', '#06b6d4'), caption: 'New runs pulled to floor 1', at: iso(dayShift(-1)) + 'T13:05:00.000Z', by: 'u_cofd' }
    ];
    var jc = jobs.find(function (x) { return x.id === 'j_core'; });
    if (jc) jc.photos = [
      { id: uid('ph'), url: svgPhoto('Phase 2 — finished', '#0d9488', '#10b981'), caption: 'Final walkthrough', at: iso(dayShift(-6)) + 'T15:40:00.000Z', by: 'u_owner' }
    ];
    // job costs (materials/expenses) → power margin math
    jobs.forEach(function (j) { j.costs = j.costs || []; });
    if (jr) jr.costs = [{ id: uid('co'), desc: 'Wire, breakers, conduit', amount: 1650 }];
    if (jc) jc.costs = [{ id: uid('co'), desc: 'Panels, gear, materials', amount: 9200 }];

    // reusable priced services (the price book)
    var catalog = [
      // ★ bread-and-butter
      { id: 'sv_panel', name: 'Panel upgrade / service change', category: 'Panels', unit: 'each', rate: 3200, cost: 1400 },
      { id: 'sv_ev', name: 'EV charger install', category: 'EV', unit: 'each', rate: 1850, cost: 800 },
      { id: 'sv_newconstruct', name: 'New construction — residential', category: 'New Construction', unit: 'project', rate: 8500, cost: 4200 },
      { id: 'sv_quote', name: 'Free quote / estimate', category: 'Service', unit: 'visit', rate: 0, cost: 25 },
      { id: 'sv_rewire', name: 'Remodel / re-wire / addition', category: 'Rewire', unit: 'project', rate: 3800, cost: 1700 },
      { id: 'sv_lighting', name: 'Lighting & device upgrade / replacement', category: 'Lighting', unit: 'each', rate: 225, cost: 70 },
      // standard catalog
      { id: 'sv_inspect', name: 'Safety inspection', category: 'Service', unit: 'visit', rate: 189, cost: 40 },
      { id: 'sv_pedestal', name: 'Pedestal install', category: 'Power', unit: 'each', rate: 950, cost: 380 },
      { id: 'sv_gen', name: 'Generator + transfer switch install', category: 'Power', unit: 'each', rate: 6800, cost: 3400 },
      { id: 'sv_lightdesign', name: 'Lighting design + install', category: 'Lighting', unit: 'project', rate: 2400, cost: 1000 },
      { id: 'sv_surge', name: 'Whole-home surge protection', category: 'Panels', unit: 'each', rate: 595, cost: 190 },
      { id: 'sv_data', name: 'Data / communications system', category: 'Low Voltage', unit: 'project', rate: 1400, cost: 520 },
      { id: 'sv_call', name: 'Service call / diagnostic', category: 'Service', unit: 'visit', rate: 129, cost: 30 },
      { id: 'sv_outlet', name: 'Outlet / receptacle install', category: 'Devices', unit: 'each', rate: 185, cost: 45 }
    ];

    // inbound quote requests (public "Client Hub" intake)
    var requests = [
      { id: 'rq_ellis', name: 'Tom Ellison', email: 'tom.ellison@email.com', phone: '(208) 555-4410', address: '822 Foster Ave, Coeur d\'Alene, ID', type: 'Residential', service: 'EV charger install', details: 'Tesla wall connector in the garage, panel is close by.', preferred: 'This week', status: 'new', createdAt: iso(dayShift(-1)) },
      { id: 'rq_lark', name: 'Larkspur Cafe', email: 'hello@larkspurcafe.com', phone: '(208) 555-7732', address: '5 Sherman Ave, Coeur d\'Alene, ID', type: 'Commercial', service: 'Lighting + dedicated circuits', details: 'Adding espresso equipment, need two 20A circuits and track lighting.', preferred: 'Next 2 weeks', status: 'new', createdAt: iso(NOW) }
    ];

    // time tracking (clock in/out per job)
    var timesheets = [
      { id: uid('ts'), jobId: 'j_ridge', userId: 'u_cofd', start: iso(dayShift(-1)) + 'T08:05:00.000Z', end: iso(dayShift(-1)) + 'T14:35:00.000Z', minutes: 390 },
      { id: uid('ts'), jobId: 'j_core', userId: 'u_owner', start: iso(dayShift(-6)) + 'T08:00:00.000Z', end: iso(dayShift(-6)) + 'T16:00:00.000Z', minutes: 480 }
    ];

    return {
      team: team, contacts: contacts, deals: deals, jobs: jobs, estimates: estimates,
      invoices: invoices, tasks: tasks, conversations: conversations, automations: automations,
      templates: templates, outbox: outbox, catalog: catalog, requests: requests, timesheets: timesheets,
      activities: activities, settings: settings, counters: { est: 1016, inv: 2010, job: 100 }
    };
  }

  /* ---- persistence ---------------------------------------------- */
  function clone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }

  var state = load();
  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      if (!raw) return seed();
      var parsed = JSON.parse(raw);
      var base = seed();
      // shallow-merge top-level collections so new keys appear for existing installs
      Object.keys(base).forEach(function (k) { if (!(k in parsed)) parsed[k] = base[k]; });
      if (!parsed.settings) parsed.settings = base.settings;
      return migrate(parsed, base);
    } catch (e) { return seed(); }
  }
  // back-fill newer fields onto records saved by earlier versions
  function migrate(s, base) {
    var b = base || seed();
    var st = s.settings;
    if (!st.branding) st.branding = { primary: '#4f46e5' };
    if (st.branding.logo === undefined) st.branding.logo = null;
    if (st.branding.accent === undefined) st.branding.accent = '#06b6d4';
    if (st.branding.favicon === undefined) st.branding.favicon = null;
    if (st.branding.welcome === undefined) st.branding.welcome = 'Here\'s what\'s happening today.';
    if (st.branding.loginTagline === undefined) st.branding.loginTagline = 'Operations, sales, and dispatch in one place.';
    if (st.branding.emailFooter === undefined) st.branding.emailFooter = b.settings.branding.emailFooter;
    if (!st.services) st.services = b.settings.services;
    var bd = st.business || (st.business = {});
    ['hours', 'emergency', 'warranty', 'serviceArea', 'owners'].forEach(function (k) { if (bd[k] === undefined) bd[k] = b.settings.business[k] || ''; });
    if (bd.veteranDiscount === undefined) bd.veteranDiscount = !!b.settings.business.veteranDiscount;
    if (!st.dashboard) st.dashboard = b.settings.dashboard.slice();
    if (!st.stageAutomation) st.stageAutomation = b.settings.stageAutomation;
    if (!s.templates || !s.templates.length) s.templates = b.templates;
    if (!s.outbox) s.outbox = [];
    if (!s.catalog || !s.catalog.length) s.catalog = b.catalog;
    if (!s.requests) s.requests = [];
    if (!s.timesheets) s.timesheets = [];
    (s.team || []).forEach(function (m) { if (m.hourlyCost === undefined) m.hourlyCost = 50; });
    (s.jobs || []).forEach(function (j) {
      if (!j.photos) j.photos = [];
      if (!j.costs) j.costs = [];
      if (!j.statusLog) j.statusLog = [{ status: j.status, at: (j.date || iso(NOW)) + 'T08:00:00.000Z', by: j.assignedTo }];
      if (j.onMyWayAt === undefined) j.onMyWayAt = null;
    });
    return s;
  }
  function save() {
    try { global.localStorage && global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (Store.onChange) Store.onChange();
  }

  /* ---- generic CRUD --------------------------------------------- */
  function all(coll) { return state[coll] || []; }
  function get(coll, id) { return (state[coll] || []).find(function (r) { return r.id === id; }); }
  function insert(coll, obj, atFront) {
    if (!obj.id) obj.id = uid(coll.slice(0, 3));
    if (atFront) state[coll].unshift(obj); else state[coll].push(obj);
    save(); return obj;
  }
  function update(coll, id, patch) {
    var r = get(coll, id); if (!r) return null;
    Object.assign(r, patch); save(); return r;
  }
  function remove(coll, id) {
    state[coll] = (state[coll] || []).filter(function (r) { return r.id !== id; }); save();
  }
  function logActivity(type, text) {
    state.activities.unshift({ id: uid('act'), type: type, text: text, at: iso(NOW) });
    if (state.activities.length > 40) state.activities.pop();
  }

  /* ---- selectors / computed ------------------------------------- */
  function contactName(id) { var c = get('contacts', id); return c ? c.name : '—'; }
  function teamMember(id) { return get('team', id); }
  function lineTotal(items) { return (items || []).reduce(function (s, it) { return s + (it.qty || 1) * (it.rate || 0); }, 0); }
  function withTax(sub) { var t = sub * (state.settings.taxRate || 0) / 100; return { sub: sub, tax: t, total: sub + t }; }
  function estimateTotal(e) { return withTax(lineTotal(e.items)).total; }
  function invoiceTotal(v) { return withTax(lineTotal(v.items)).total; }

  function thisMonth(dateStr) {
    if (!dateStr) return false;
    var d = parseDate(dateStr);
    return d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear();
  }

  var kpis = function () {
    var paid = all('invoices').filter(function (v) { return v.status === 'paid'; });
    var revenueMTD = paid.filter(function (v) { return thisMonth(v.paidAt); }).reduce(function (s, v) { return s + invoiceTotal(v); }, 0);
    var outstanding = all('invoices').filter(function (v) { return v.status !== 'paid'; }).reduce(function (s, v) { return s + invoiceTotal(v); }, 0);
    var openDeals = all('deals').filter(function (d) { return d.stage !== 'won' && d.stage !== 'lost'; });
    var pipelineValue = openDeals.reduce(function (s, d) { return s + (d.value || 0); }, 0);
    var jobsToday = all('jobs').filter(function (j) { return j.date === iso(NOW); });
    var won = all('deals').filter(function (d) { return d.stage === 'won'; }).length;
    var lost = all('deals').filter(function (d) { return d.stage === 'lost'; }).length;
    var winRate = (won + lost) ? Math.round(won / (won + lost) * 100) : 100;
    return {
      revenueMTD: revenueMTD, outstanding: outstanding, pipelineValue: pipelineValue,
      jobsToday: jobsToday, openDeals: openDeals.length, winRate: winRate,
      unreadMsgs: all('conversations').filter(function (c) { return c.unread; }).length
    };
  };

  function resetAll() {
    state = seed();
    try { global.localStorage && global.localStorage.removeItem(KEY); } catch (e) {}
    save();
  }

  /* ---- stage progression (Lead → Prospect → Customer) ----------- */
  var STAGE_RANK = { lead: 0, prospect: 1, customer: 2 };
  function advanceContactStage(contactId, toStage) {
    var c = get('contacts', contactId); if (!c) return null;
    if ((STAGE_RANK[toStage] || 0) > (STAGE_RANK[c.stage] || 0)) {
      var from = c.stage; c.stage = toStage; c.lastContact = iso(NOW); save();
      logActivity('lead', c.name + ' advanced from ' + cap(from) + ' to ' + cap(toStage));
      return { changed: true, from: from, to: toStage };
    }
    c.lastContact = iso(NOW); save();
    return { changed: false, to: c.stage };
  }
  function cap(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }

  /* ---- templates + outbox --------------------------------------- */
  function template(id) { return get('templates', id); }
  function templateForEvent(ev) { return all('templates').filter(function (t) { return t.event === ev && t.enabled; })[0]; }
  function renderTemplate(tpl, ctx) {
    ctx = ctx || {}; var s = state.settings;
    var vars = {
      client_name: ctx.client_name || 'there',
      business_name: s.business.name,
      business_phone: s.business.phone,
      business_email: s.business.email,
      amount: ctx.amount || '',
      job_title: ctx.job_title || 'your project',
      date: ctx.date || '',
      time: ctx.time || '',
      tech_name: ctx.tech_name || 'Your technician',
      estimate_number: ctx.estimate_number || '',
      invoice_number: ctx.invoice_number || '',
      address: ctx.address || '',
      link: ctx.link || (s.business.name.toLowerCase().replace(/[^a-z]/g, '') + '.com/portal')
    };
    function fill(str) { return String(str || '').replace(/\{\{(\w+)\}\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); }
    return { subject: fill(tpl.subject), body: fill(tpl.body), channel: tpl.channel };
  }
  var MERGE_VARS = ['client_name', 'business_name', 'business_phone', 'job_title', 'amount', 'date', 'time', 'tech_name', 'estimate_number', 'invoice_number', 'address', 'link'];
  function recordOutbox(rec) {
    rec.id = uid('ob'); rec.at = rec.at || nowISO(); rec.status = rec.status || 'sent';
    state.outbox.unshift(rec);
    if (state.outbox.length > 200) state.outbox.pop();
    // also drop it into the conversation thread with that contact so it shows in the inbox
    if (rec.contactId) {
      var cv = all('conversations').filter(function (c) { return c.contactId === rec.contactId && c.channel === rec.channel; })[0];
      var line = (rec.subject ? rec.subject + ' — ' : '') + rec.body;
      if (cv) { cv.messages.push({ from: 'me', text: line, at: iso(NOW) }); cv.at = iso(NOW); }
      else state.conversations.unshift({ id: uid('cv'), contactId: rec.contactId, channel: rec.channel, unread: false, at: iso(NOW), messages: [{ from: 'me', text: line, at: iso(NOW) }] });
    }
    save(); return rec;
  }

  /* ---- richer metrics ------------------------------------------- */
  function monthKey(d) { return d.getFullYear() + '-' + d.getMonth(); }
  function revenueSeries(n) {
    n = n || 6; var out = []; var paid = all('invoices').filter(function (v) { return v.status === 'paid' && v.paidAt; });
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
      var key = monthKey(d);
      var val = paid.filter(function (v) { var pd = parseDate(v.paidAt); return monthKey(pd) === key; }).reduce(function (s, v) { return s + invoiceTotal(v); }, 0);
      out.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value: val });
    }
    return out;
  }
  function within(dateStr, days) {
    if (!dateStr) return false; var d = parseDate(dateStr); var diff = (d - NOW) / 86400000;
    return diff >= -0.5 && diff <= days;
  }
  function extraKpis() {
    var inv = all('invoices');
    var overdue = inv.filter(function (v) { return v.status === 'overdue'; });
    var unpaid = inv.filter(function (v) { return v.status !== 'paid'; });
    var jobs = all('jobs');
    var doneJobs = jobs.filter(function (j) { return j.status === 'complete' || j.status === 'invoiced'; });
    var jobVals = doneJobs.map(function (j) { return j.value || 0; }).filter(Boolean);
    var paidInv = inv.filter(function (v) { return v.status === 'paid'; });
    return {
      collectedMTD: paidInv.filter(function (v) { return thisMonth(v.paidAt); }).reduce(function (s, v) { return s + invoiceTotal(v); }, 0),
      overdueAmount: overdue.reduce(function (s, v) { return s + invoiceTotal(v); }, 0),
      overdueCount: overdue.length,
      unpaidCount: unpaid.length,
      jobsThisWeek: jobs.filter(function (j) { return within(j.date, 7) && (j.status === 'scheduled' || j.status === 'in_progress'); }).length,
      upcoming: jobs.filter(function (j) { return within(j.date, 7); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
      avgJobValue: jobVals.length ? Math.round(jobVals.reduce(function (s, v) { return s + v; }, 0) / jobVals.length) : 0,
      newLeads7: all('contacts').filter(function (c) { return within(c.createdAt, 0) || (c.createdAt && (NOW - parseDate(c.createdAt)) / 86400000 <= 7); }).length,
      activeJobs: jobs.filter(function (j) { return j.status === 'in_progress'; }).length,
      completedJobs: doneJobs.length
    };
  }
  function techLeaderboard() {
    return all('team').map(function (m) {
      var mj = all('jobs').filter(function (j) { return j.assignedTo === m.id; });
      var done = mj.filter(function (j) { return j.status === 'complete' || j.status === 'invoiced'; }).length;
      var revenue = mj.filter(function (j) { return j.status === 'complete' || j.status === 'invoiced'; }).reduce(function (s, j) { return s + (j.value || 0); }, 0);
      return { id: m.id, name: m.name, color: m.color, jobs: mj.length, done: done, revenue: revenue };
    }).sort(function (a, b) { return b.revenue - a.revenue; });
  }
  function jobsForTech(userId, dateStr) {
    return all('jobs').filter(function (j) { return j.assignedTo === userId && (!dateStr || j.date === dateStr); })
      .sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
  }
  function jobsForContact(contactId) {
    return all('jobs').filter(function (j) { return j.contactId === contactId; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  /* ---- time tracking + job costing ------------------------------ */
  function timesheetsForJob(jobId) { return all('timesheets').filter(function (t) { return t.jobId === jobId; }); }
  function openTimesheet(jobId, userId) { return all('timesheets').filter(function (t) { return t.jobId === jobId && t.userId === userId && !t.end; })[0]; }
  function jobLaborMinutes(job) { return timesheetsForJob(job.id).reduce(function (s, t) { return s + (t.minutes || 0); }, 0); }
  function jobLaborCost(job) {
    return timesheetsForJob(job.id).reduce(function (s, t) {
      var m = teamMember(t.userId); return s + ((t.minutes || 0) / 60) * ((m && m.hourlyCost) || 50);
    }, 0);
  }
  function jobMaterialCost(job) { return (job.costs || []).reduce(function (s, c) { return s + (c.amount || 0); }, 0); }
  function jobRevenue(job) {
    var inv = all('invoices').filter(function (v) { return v.jobId === job.id; });
    if (inv.length) return inv.reduce(function (s, v) { return s + invoiceTotal(v); }, 0);
    return withTax(lineTotal(job.items && job.items.length ? job.items : [{ qty: 1, rate: job.value || 0 }])).total;
  }
  function jobProfit(job) {
    var rev = jobRevenue(job), cost = jobLaborCost(job) + jobMaterialCost(job);
    return { revenue: rev, labor: jobLaborCost(job), material: jobMaterialCost(job), cost: cost, profit: rev - cost, margin: rev ? Math.round((rev - cost) / rev * 100) : 0 };
  }
  function profitByJob() {
    return all('jobs').filter(function (j) { return j.status === 'complete' || j.status === 'invoiced'; })
      .map(function (j) { var p = jobProfit(j); return { id: j.id, title: j.title, contact: contactName(j.contactId), revenue: p.revenue, profit: p.profit, margin: p.margin }; })
      .sort(function (a, b) { return b.profit - a.profit; });
  }
  function arAging() {
    var buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    all('invoices').filter(function (v) { return v.status !== 'paid'; }).forEach(function (v) {
      var days = Math.round((NOW - parseDate(v.dueAt)) / 86400000); var amt = invoiceTotal(v);
      if (days <= 0) buckets.current += amt; else if (days <= 30) buckets.d30 += amt; else if (days <= 60) buckets.d60 += amt; else buckets.d90 += amt;
    });
    return buckets;
  }

  /* ---- time-based automation runner (fires once per condition) --- */
  function daysAgo(dateStr) { return dateStr ? Math.round((NOW - parseDate(dateStr)) / 86400000) : 0; }
  function runAutomations(send) {
    var fired = [];
    var a2 = get('automations', 'a2');
    if (a2 && a2.enabled) {
      all('estimates').filter(function (e) { return e.status === 'sent' && !e.followupSentAt && daysAgo(e.createdAt) >= 5; }).forEach(function (e) {
        e.followupSentAt = iso(NOW);
        if (send) send(e.contactId, 't_est_follow', { estimate_number: e.number, job_title: e.items[0] ? e.items[0].desc : 'your project' });
        logActivity('estimate', 'Auto follow-up sent for ' + e.number);
        a2.runs++; fired.push('followup:' + e.number);
      });
    }
    var a7 = get('automations', 'a7');
    if (a7 && a7.enabled) {
      all('invoices').filter(function (v) { return v.status === 'overdue' && !v.reminderSentAt; }).forEach(function (v) {
        v.reminderSentAt = iso(NOW);
        if (send) send(v.contactId, 't_overdue', { invoice_number: v.number });
        logActivity('invoice', 'Auto overdue reminder sent for ' + v.number);
        a7.runs++; fired.push('overdue:' + v.number);
      });
    }
    if (fired.length) save();
    return fired;
  }

  /* ---- backup / restore ----------------------------------------- */
  function mrr() {
    var s = (state.settings && state.settings.services) || [];
    return s.filter(function (x) { return x.active; }).reduce(function (t, x) { return t + (x.price || 0); }, 0);
  }

  function exportData() { return JSON.stringify(state, null, 2); }
  function ensureShape() { try { state = migrate(state); } catch (e) {} return state; }
  function importData(objOrStr) {
    try {
      var obj = typeof objOrStr === 'string' ? JSON.parse(objOrStr) : objOrStr;
      if (!obj || !obj.contacts) return false;
      state = migrate(obj); save(); return true;
    } catch (e) { return false; }
  }

  /* ---- public api ----------------------------------------------- */
  var Store = {
    KEY: KEY, uid: uid, now: NOW, iso: iso, dayShift: dayShift, clone: clone, nowISO: nowISO,
    state: function () { return state; },
    all: all, get: get, insert: insert, update: update, remove: remove,
    save: save, resetAll: resetAll, logActivity: logActivity,
    contactName: contactName, teamMember: teamMember,
    lineTotal: lineTotal, withTax: withTax, estimateTotal: estimateTotal, invoiceTotal: invoiceTotal,
    kpis: kpis, onChange: null,
    advanceContactStage: advanceContactStage, cap: cap,
    template: template, templateForEvent: templateForEvent, renderTemplate: renderTemplate, recordOutbox: recordOutbox, MERGE_VARS: MERGE_VARS,
    revenueSeries: revenueSeries, extraKpis: extraKpis, techLeaderboard: techLeaderboard,
    jobsForTech: jobsForTech, jobsForContact: jobsForContact,
    timesheetsForJob: timesheetsForJob, openTimesheet: openTimesheet, jobLaborMinutes: jobLaborMinutes,
    jobProfit: jobProfit, profitByJob: profitByJob, arAging: arAging,
    runAutomations: runAutomations, exportData: exportData, importData: importData, mrr: mrr, ensureShape: ensureShape
  };
  global.Store = Store;
})(typeof window !== 'undefined' ? window : this);
