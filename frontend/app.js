const $ = (id) => document.getElementById(id);

const state = {
  apiBase: initialApiBase(),
  accessToken: localStorage.getItem('powerLawDigital.accessToken') || '',
  refreshToken: localStorage.getItem('powerLawDigital.refreshToken') || '',
  user: readJson('powerLawDigital.user'),
  view: localStorage.getItem('powerLawDigital.view') || 'dashboard',
  selected: {
    inquiryId: localStorage.getItem('powerLawDigital.inquiryId') || '',
    caseId: localStorage.getItem('powerLawDigital.caseId') || '',
    userId: localStorage.getItem('powerLawDigital.userId') || '',
    groupId: localStorage.getItem('powerLawDigital.groupId') || '',
    taskId: localStorage.getItem('powerLawDigital.taskId') || '',
    documentId: localStorage.getItem('powerLawDigital.documentId') || '',
    jobId: localStorage.getItem('powerLawDigital.jobId') || '',
  },
  data: {
    inquiries: [],
    cases: [],
    users: [],
    groups: [],
    jobs: [],
    tasks: [],
    documents: [],
    notes: [],
    currentCase: null,
    currentInquiry: null,
  },
  pagination: {
    inquiries: null,
    cases: null,
    users: null,
    tasks: null,
    documents: null,
    notes: null,
  },
};

const pageMeta = {
  dashboard: ['Dashboard', 'Operational overview'],
  inquiries: ['Inquiries', 'Client intake and assignment'],
  cases: ['Cases', 'Case work, tasks, documents, and notes'],
  staff: ['Staff', 'Employees, roles, and director rotation'],
  groups: ['Groups', 'Team access and case grouping'],
  jobs: ['Email jobs', 'Redis-backed email queue'],
  account: ['Account', 'Profile and password'],
};

const roleLabels = {
  owner: 'Owner',
  director: 'Director',
  senior_lawyer: 'Senior lawyer',
  lawyer: 'Lawyer',
  assistant: 'Assistant',
  auditor: 'Auditor',
  client: 'Client',
};

const viewAccess = {
  dashboard: ['owner', 'director', 'senior_lawyer', 'lawyer', 'assistant', 'auditor', 'client'],
  inquiries: ['owner', 'director', 'senior_lawyer'],
  cases: ['owner', 'director', 'senior_lawyer', 'lawyer', 'assistant', 'auditor'],
  staff: ['owner', 'director'],
  groups: ['owner', 'director'],
  jobs: ['owner', 'director'],
  account: ['owner', 'director', 'senior_lawyer', 'lawyer', 'assistant', 'auditor', 'client'],
};

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function defaultApiBase() {
  if (window.location.protocol.startsWith('http') && window.location.port !== '3001') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3001';
}

function initialApiBase() {
  const fallback = defaultApiBase();
  const stored = localStorage.getItem('powerLawDigital.apiBase');
  if (!stored) return fallback;

  try {
    const storedUrl = new URL(stored, window.location.origin);
    if (!isLocalHostname(window.location.hostname) && isLocalHostname(storedUrl.hostname)) {
      return fallback;
    }
    return stored.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function saveSession() {
  localStorage.setItem('powerLawDigital.apiBase', state.apiBase);
  localStorage.setItem('powerLawDigital.accessToken', state.accessToken);
  localStorage.setItem('powerLawDigital.refreshToken', state.refreshToken);
  localStorage.setItem('powerLawDigital.user', JSON.stringify(state.user || null));
  localStorage.setItem('powerLawDigital.view', state.view);
  for (const [key, value] of Object.entries(state.selected)) {
    localStorage.setItem(`powerLawDigital.${key}`, value || '');
  }
}

function clearSession() {
  state.accessToken = '';
  state.refreshToken = '';
  state.user = null;
  saveSession();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

function roleName(role) {
  return roleLabels[role] || role || 'n/a';
}

function badge(value) {
  const text = escapeHtml(value || 'n/a');
  const normalized = String(value || '').toLowerCase();
  let tone = '';
  if (['active', 'verified', 'completed', 'done', 'email_verified', 'processing'].includes(normalized)) tone = 'green';
  if (['pending_verification', 'ready_for_review', 'queued', 'todo', 'in_progress'].includes(normalized)) tone = 'amber';
  if (['failed', 'closed', 'inactive'].includes(normalized)) tone = 'red';
  return `<span class="badge ${tone}">${text}</span>`;
}

function setOutput(value) {
  $('output').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function setAlert(message, type = 'info') {
  const alert = $('alert');
  if (!message) {
    alert.classList.add('hidden');
    alert.textContent = '';
    return;
  }
  alert.textContent = message;
  alert.className = `alert ${type === 'error' ? 'error' : ''}`;
}

function getErrorMessage(err) {
  const body = err?.body || err;
  if (typeof body === 'string') return body;
  if (body?.detail && typeof body.detail === 'object') {
    return Object.entries(body.detail).map(([key, value]) => `${key}: ${value}`).join('; ');
  }
  return body?.message || body?.error || err?.message || 'Request failed';
}

function syncApiInputs() {
  if ($('apiBasePublic')) $('apiBasePublic').value = state.apiBase;
  if ($('apiBaseApp')) $('apiBaseApp').value = state.apiBase;
}

async function api(path, options = {}) {
  return request(path, options, false);
}

async function request(path, options = {}, didRefresh) {
  const headers = { ...(options.headers || {}) };
  if (options.auth !== false && state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }
  const isBinary = options.body instanceof Blob || options.body instanceof ArrayBuffer;
  if (options.body && !isBinary) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${state.apiBase}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? (isBinary ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (response.status === 401 && options.auth !== false && state.refreshToken && !didRefresh) {
      await refreshAccessToken();
      return request(path, options, true);
    }
    throw { status: response.status, body };
  }

  if (response.status === 204) return { status: 204 };
  if (contentType.includes('application/json')) return response.json();
  return response.blob();
}

async function refreshAccessToken() {
  const response = await fetch(`${state.apiBase}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: state.refreshToken }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    clearSession();
    updateShell();
    throw { status: response.status, body };
  }

  const result = await response.json();
  state.accessToken = result.access_token;
  state.refreshToken = result.refresh_token;
  saveSession();
  return result;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function run(action, dataset = {}) {
  if (!actions[action]) return;
  try {
    setAlert('');
    setBusy(true);
    const result = await actions[action](dataset);
    if (result !== undefined) setOutput(result);
  } catch (err) {
    const message = getErrorMessage(err);
    setAlert(message, 'error');
    setOutput(err);
  } finally {
    setBusy(false);
    updateShell();
  }
}

function setBusy(isBusy) {
  document.body.classList.toggle('is-busy', isBusy);
}

function updateShell() {
  syncApiInputs();
  const authenticated = Boolean(state.accessToken);
  $('publicView').classList.toggle('hidden', authenticated);
  $('appView').classList.toggle('hidden', !authenticated);
  $('authStatus').textContent = authenticated ? 'Authenticated' : 'No active session';
  if ($('sidebarRole')) $('sidebarRole').textContent = state.user ? roleName(state.user.role) : 'Not signed in';
  if ($('sessionName')) $('sessionName').textContent = state.user?.full_name || 'Unknown user';
  if ($('sessionEmail')) $('sessionEmail').textContent = state.user?.email || 'No email';
  applyRoleVisibility();
  showView(state.view, false);
}

function canAccessView(view) {
  if (!state.user?.role) return view === 'dashboard';
  return (viewAccess[view] || []).includes(state.user.role);
}

function applyRoleVisibility() {
  document.querySelectorAll('[data-view]').forEach((item) => {
    item.classList.toggle('hidden', !canAccessView(item.dataset.view));
  });

  const isManagement = ['owner', 'director'].includes(state.user?.role);
  document.querySelectorAll('[data-action="createStaff"], [data-action="makeDirector"], [data-action="resetStaffPassword"], [data-action="deactivateUser"]').forEach((item) => {
    item.classList.toggle('hidden', !isManagement);
  });
}

function showView(view, shouldLoad = true) {
  if (!canAccessView(view)) view = 'dashboard';
  state.view = view;
  saveSession();

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('hidden', section.dataset.section !== view);
  });

  const [title, subtitle] = pageMeta[view] || pageMeta.dashboard;
  $('pageTitle').textContent = title;
  $('pageSubtitle').textContent = subtitle;

  if (shouldLoad) {
    const loaders = {
      dashboard: actions.loadDashboard,
      inquiries: actions.loadInquiries,
      cases: actions.loadCases,
      staff: actions.loadUsers,
      groups: actions.loadGroups,
      jobs: actions.loadEmailJobs,
      account: actions.loadProfile,
    };
    loaders[view]?.().catch((err) => {
      setAlert(getErrorMessage(err), 'error');
      setOutput(err);
    });
  }
}

function optionList(items, valueKey, labelFn, selected = '', placeholder = 'Select') {
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const item of items || []) {
    const value = item[valueKey];
    const label = labelFn(item);
    options.push(`<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`);
  }
  return options.join('');
}

function renderUserSelects() {
  const lawyers = state.data.users.filter((user) => ['lawyer', 'senior_lawyer'].includes(user.role) && user.is_active);
  const users = state.data.users.filter((user) => user.is_active);
  const cases = state.data.cases;
  const lawyerOptions = optionList(lawyers, 'id', (u) => `${u.full_name} - ${roleName(u.role)}`, '', 'Select lawyer');
  const userOptions = optionList(users, 'id', (u) => `${u.full_name} - ${roleName(u.role)}`, state.selected.userId, 'Select user');
  const caseOptions = optionList(cases, 'id', (c) => `${c.inquiry?.full_name || c.id} - ${c.status}`, state.selected.caseId, 'Select case');

  ['assignLawyerId', 'reassignLawyerId', 'caseFilterLawyer'].forEach((id) => {
    if ($(id)) $(id).innerHTML = id === 'caseFilterLawyer'
      ? `<option value="">All lawyers</option>${lawyerOptions.replace('<option value="">Select lawyer</option>', '')}`
      : lawyerOptions;
  });
  if ($('groupMemberUserId')) $('groupMemberUserId').innerHTML = userOptions;
  if ($('groupCaseId')) $('groupCaseId').innerHTML = caseOptions;
}

function renderDashboard() {
  const openInquiries = state.data.inquiries.filter((i) => i.status !== 'assigned' && i.status !== 'closed').length;
  const activeCases = state.data.cases.filter((c) => c.status === 'active' || c.status === 'ready_for_review').length;
  const activeUsers = state.data.users.filter((u) => u.is_active && u.role !== 'client').length;
  $('metricInquiries').textContent = openInquiries;
  $('metricCases').textContent = activeCases;
  $('metricUsers').textContent = activeUsers;
  $('metricJobs').textContent = state.data.jobs.length;

  $('dashboardInquiries').innerHTML = renderList(
    state.data.inquiries.slice(0, 5),
    (item) => `
      <div class="list-item-header"><strong>${escapeHtml(item.full_name)}</strong>${badge(item.status)}</div>
      <p>${escapeHtml(item.category)} · ${formatDate(item.created_at)}</p>
    `,
    'No inquiries loaded.'
  );
  $('dashboardCases').innerHTML = renderList(
    state.data.cases.slice(0, 5),
    (item) => `
      <div class="list-item-header"><strong>${escapeHtml(item.inquiry?.full_name || item.id)}</strong>${badge(item.status)}</div>
      <p>${escapeHtml(item.lawyer?.full_name || 'Unassigned')} · ${item.open_tasks_count || 0} tasks</p>
    `,
    'No cases loaded.'
  );
}

function renderLoadMore(buttonId, nextCursor) {
  const button = $(buttonId);
  if (!button) return;
  button.classList.toggle('hidden', !nextCursor);
}

function renderList(items, renderItem, emptyText) {
  if (!items || items.length === 0) return `<div class="list-item"><p>${escapeHtml(emptyText)}</p></div>`;
  return items.map((item) => `<div class="list-item">${renderItem(item)}</div>`).join('');
}

function renderInquiries() {
  $('inquiryCount').textContent = `${state.data.inquiries.length} items`;
  $('inquiriesTable').innerHTML = state.data.inquiries.length ? state.data.inquiries.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.full_name)}</strong><br><span class="muted">${escapeHtml(item.id)}</span></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${badge(item.status)}</td>
      <td>${formatDate(item.created_at)}</td>
      <td><div class="row-actions"><button class="secondary" data-action="selectInquiry" data-id="${escapeHtml(item.id)}">Open</button></div></td>
    </tr>
  `).join('') : `<tr><td colspan="5">No inquiries found.</td></tr>`;
  renderLoadMore('loadMoreInquiries', state.pagination.inquiries);
}

function renderInquiryDetail(inquiry) {
  $('selectedInquiryLabel').textContent = inquiry ? inquiry.id : 'No inquiry selected';
  $('inquiryDetail').innerHTML = inquiry ? `
    <strong>${escapeHtml(inquiry.full_name)}</strong><br>
    ${escapeHtml(inquiry.email || '')} ${inquiry.phone ? `· ${escapeHtml(inquiry.phone)}` : ''}<br>
    ${badge(inquiry.status)} ${escapeHtml(inquiry.category || '')}<br>
    <span class="muted">${escapeHtml(inquiry.description || '')}</span>
  ` : 'Select an inquiry from the list.';
}

function renderCases() {
  $('caseCount').textContent = `${state.data.cases.length} items`;
  $('casesTable').innerHTML = state.data.cases.length ? state.data.cases.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.id.slice(0, 8))}</strong><br><span class="muted">${formatDate(item.last_activity_at)}</span></td>
      <td>${escapeHtml(item.inquiry?.full_name || 'n/a')}<br><span class="muted">${escapeHtml(item.inquiry?.category || '')}</span></td>
      <td>${escapeHtml(item.lawyer?.full_name || 'n/a')}<br><span class="muted">${escapeHtml(item.lawyer?.email || '')}</span></td>
      <td>${badge(item.status)}<br><span class="muted">${item.open_tasks_count || 0} tasks</span></td>
      <td><div class="row-actions"><button class="secondary" data-action="selectCase" data-id="${escapeHtml(item.id)}">Open</button></div></td>
    </tr>
  `).join('') : `<tr><td colspan="5">No cases found.</td></tr>`;
  renderUserSelects();
  renderLoadMore('loadMoreCases', state.pagination.cases);
}

function renderCaseDetail(c) {
  $('selectedCaseLabel').textContent = c ? c.id : 'No case selected';
  if (!c) {
    $('caseDetail').innerHTML = 'Select a case from the list.';
    return;
  }
  $('caseStatus').value = c.status || 'active';
  $('caseDetail').innerHTML = `
    <strong>${escapeHtml(c.inquiry?.full_name || 'Case')}</strong><br>
    ${escapeHtml(c.inquiry?.email || '')} ${c.inquiry?.phone ? `· ${escapeHtml(c.inquiry.phone)}` : ''}<br>
    ${badge(c.status)} ${escapeHtml(c.inquiry?.category || '')}<br>
    Lawyer: ${escapeHtml(c.lawyer?.full_name || 'n/a')}<br>
    <span class="muted">${escapeHtml(c.inquiry?.description || '')}</span>
  `;
}

function renderTasks() {
  $('tasksList').innerHTML = renderList(state.data.tasks, (task) => `
    <div class="list-item-header"><strong>${escapeHtml(task.title)}</strong>${badge(task.status)}</div>
    <p>Priority: ${escapeHtml(task.priority || 'medium')} · Due: ${formatDate(task.due_date)}</p>
    <div class="row-actions">
      <button class="secondary" data-action="selectTask" data-id="${escapeHtml(task.id)}">Select</button>
      <button class="danger" data-action="deleteTask" data-id="${escapeHtml(task.id)}">Delete</button>
    </div>
  `, 'No tasks for selected case.');
  renderLoadMore('loadMoreTasks', state.pagination.tasks);
}

function renderDocuments() {
  $('documentsList').innerHTML = renderList(state.data.documents, (doc) => `
    <div class="list-item-header"><strong>${escapeHtml(doc.filename)}</strong>${badge(doc.encrypted ? 'encrypted' : 'stored')}</div>
    <p>${escapeHtml(doc.mime_type || '')} · ${doc.file_size_bytes || 0} bytes</p>
    <p>SHA-256: ${escapeHtml(doc.sha256_hash || 'n/a')}</p>
    <div class="row-actions">
      <button class="secondary" data-action="downloadDocument" data-id="${escapeHtml(doc.id)}">Download</button>
    </div>
  `, 'No documents for selected case.');
  renderLoadMore('loadMoreDocuments', state.pagination.documents);
}

function renderNotes() {
  $('notesList').innerHTML = renderList(state.data.notes, (note) => `
    <div class="list-item-header"><strong>${escapeHtml(note.author?.full_name || 'Author')}</strong><span class="muted">${formatDate(note.created_at)}</span></div>
    <p>${escapeHtml(note.body)}</p>
  `, 'No notes for selected case.');
  renderLoadMore('loadMoreNotes', state.pagination.notes);
}

function renderUsers() {
  $('usersTable').innerHTML = state.data.users.length ? state.data.users.map((user) => `
    <tr>
      <td><strong>${escapeHtml(user.full_name)}</strong><br><span class="muted">${escapeHtml(user.id)}</span></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${badge(roleName(user.role))}</td>
      <td>${badge(user.is_active ? 'active' : 'inactive')}<br><span class="muted">${user.must_change_password ? 'temporary password' : 'password set'}</span></td>
      <td><div class="row-actions"><button class="secondary" data-action="selectUser" data-id="${escapeHtml(user.id)}">Select</button></div></td>
    </tr>
  `).join('') : `<tr><td colspan="5">No users found.</td></tr>`;
  renderUserSelects();
  renderLoadMore('loadMoreUsers', state.pagination.users);
}

function renderGroups() {
  $('groupsList').innerHTML = renderList(state.data.groups, (group) => `
    <div class="list-item-header"><strong>${escapeHtml(group.name)}</strong>${badge(group.type)}</div>
    <p>${escapeHtml(group.slug || group.id)}</p>
    <p>${(group.members || []).length} members · ${(group.cases || []).length} cases</p>
    <div class="row-actions"><button class="secondary" data-action="selectGroup" data-id="${escapeHtml(group.id)}">Select</button></div>
  `, 'No groups found.');
}

function renderJobs() {
  $('jobCount').textContent = `${state.data.jobs.length} jobs`;
  $('jobsTable').innerHTML = state.data.jobs.length ? state.data.jobs.map((job) => `
    <tr>
      <td>${badge(job.status)}</td>
      <td>${escapeHtml(job.payload?.to || 'n/a')}<br><span class="muted">${escapeHtml(job.payload?.subject || '')}</span></td>
      <td>${job.attempts || 0}/${job.max_attempts || 0}</td>
      <td>${formatDate(job.created_at)}</td>
      <td><div class="row-actions"><button class="secondary" data-action="selectJob" data-id="${escapeHtml(job.id)}">Open</button></div></td>
    </tr>
  `).join('') : `<tr><td colspan="5">No email jobs found.</td></tr>`;
}

function renderProfile() {
  const user = state.user;
  $('profileDetail').innerHTML = user ? `
    <strong>${escapeHtml(user.full_name)}</strong><br>
    ${escapeHtml(user.email)}<br>
    ${badge(roleName(user.role))} ${badge(user.is_active ? 'active' : 'inactive')}<br>
    ${user.must_change_password ? badge('password change required') : ''}
  ` : 'No profile loaded.';
}

async function loadProfileData() {
  const user = await api('/users/me');
  state.user = user;
  saveSession();
  renderProfile();
  return user;
}

async function loadUsersData({ append = false } = {}) {
  const result = await api(`/users/all${query({
    limit: 100,
    role: $('userRoleFilter')?.value,
    q: $('userSearch')?.value,
    cursor: append ? state.pagination.users : '',
  })}`);
  state.data.users = append ? [...state.data.users, ...(result.items || [])] : result.items || [];
  state.pagination.users = result.pagination?.next_cursor || null;
  renderUsers();
  return result;
}

async function loadInquiriesData({ append = false } = {}) {
  const result = await api(`/inquiries${query({
    limit: 100,
    status: $('inquiryStatus')?.value,
    category: $('inquiryCategory')?.value,
    q: $('inquirySearch')?.value,
    cursor: append ? state.pagination.inquiries : '',
  })}`);
  state.data.inquiries = append ? [...state.data.inquiries, ...(result.items || [])] : result.items || [];
  state.pagination.inquiries = result.pagination?.next_cursor || null;
  renderInquiries();
  return result;
}

async function loadCasesData({ append = false } = {}) {
  const result = await api(`/cases${query({
    limit: 100,
    status: $('caseFilterStatus')?.value,
    lawyer_id: $('caseFilterLawyer')?.value,
    cursor: append ? state.pagination.cases : '',
  })}`);
  state.data.cases = append ? [...state.data.cases, ...(result.items || [])] : result.items || [];
  state.pagination.cases = result.pagination?.next_cursor || null;
  renderCases();
  return result;
}

async function loadGroupsData() {
  const result = await api('/groups');
  state.data.groups = result.items || [];
  renderGroups();
  return result;
}

async function loadJobsData() {
  const result = await api(`/jobs/email${query({ limit: 100, status: $('jobStatus')?.value })}`);
  state.data.jobs = result.items || [];
  renderJobs();
  return result;
}

async function bootstrap() {
  const results = {};
  try { results.profile = await loadProfileData(); } catch (err) { results.profile_error = getErrorMessage(err); }
  try { results.users = await loadUsersData(); } catch (err) { results.users_error = getErrorMessage(err); }
  try { results.inquiries = await loadInquiriesData(); } catch (err) { results.inquiries_error = getErrorMessage(err); }
  try { results.cases = await loadCasesData(); } catch (err) { results.cases_error = getErrorMessage(err); }
  try { results.groups = await loadGroupsData(); } catch (err) { results.groups_error = getErrorMessage(err); }
  try { results.jobs = await loadJobsData(); } catch (err) { results.jobs_error = getErrorMessage(err); }
  renderDashboard();
  updateShell();
  return results;
}

const actions = {
  async login() {
    const result = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: $('loginEmail').value, password: $('loginPassword').value },
    });
    state.accessToken = result.access_token;
    state.refreshToken = result.refresh_token;
    state.user = result.user;
    saveSession();
    updateShell();
    await bootstrap();
    return result;
  },
  async logout() {
    if (state.refreshToken) {
      await api('/auth/logout', { method: 'POST', auth: false, body: { refresh_token: state.refreshToken } }).catch(() => {});
    }
    clearSession();
    updateShell();
    return { logged_out: true };
  },
  async refreshSession() {
    if (!state.refreshToken) throw new Error('No refresh token available.');
    const result = await refreshAccessToken();
    return result;
  },
  async registerDirector() {
    const result = await api('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        full_name: $('registerName').value,
        email: $('registerEmail').value,
        password: $('registerPassword').value,
      },
    });
    $('verifyEmail').value = result.email || $('registerEmail').value;
    return result;
  },
  async registerClient() {
    const result = await api('/auth/client/register', {
      method: 'POST',
      auth: false,
      body: {
        full_name: $('registerName').value,
        email: $('registerEmail').value,
        password: $('registerPassword').value,
      },
    });
    $('verifyEmail').value = result.user?.email || $('registerEmail').value;
    return result;
  },
  verifyEmail() {
    return api('/auth/verify-email', {
      method: 'POST',
      auth: false,
      body: { email: $('verifyEmail').value, code: $('verifyCode').value },
    });
  },
  resendVerification() {
    return api('/auth/resend-verification', {
      method: 'POST',
      auth: false,
      body: { email: $('verifyEmail').value },
    });
  },
  forgotPassword() {
    return api('/auth/password/forgot', {
      method: 'POST',
      auth: false,
      body: { email: $('resetEmail').value },
    });
  },
  resetPassword() {
    return api('/auth/password/reset', {
      method: 'POST',
      auth: false,
      body: {
        email: $('resetEmail').value,
        code: $('resetCode').value,
        new_password: $('resetPassword').value,
      },
    });
  },
  async changeTemporaryPassword() {
    const result = await api('/users/me', {
      method: 'PATCH',
      body: {
        current_password: $('currentPassword').value,
        new_password: $('newPassword').value,
      },
    });
    await loadProfileData();
    return result;
  },
  async submitInquiry() {
    const result = await api('/submit', {
      method: 'POST',
      auth: false,
      body: {
        full_name: $('clientName').value,
        email: $('clientEmail').value,
        phone: $('clientPhone').value,
        category: $('category').value,
        description: $('description').value,
      },
    });
    state.selected.inquiryId = result.inquiry_id;
    $('inquiryId').value = result.inquiry_id;
    $('publicInquiryStatus').textContent = result.inquiry_id;
    saveSession();
    return result;
  },
  verifyInquiry() {
    return api('/submit/verify', {
      method: 'POST',
      auth: false,
      body: { inquiry_id: $('inquiryId').value, code: $('otpCode').value },
    });
  },
  resendOtp() {
    return api('/submit/resend', {
      method: 'POST',
      auth: false,
      body: { inquiry_id: $('inquiryId').value },
    });
  },
  async loadDashboard() {
    const result = await bootstrap();
    renderDashboard();
    return result;
  },
  async loadProfile() {
    return loadProfileData();
  },
  async loadUsers() {
    const result = await loadUsersData();
    renderDashboard();
    return result;
  },
  async loadMoreUsers() {
    if (!state.pagination.users) return { items: [], pagination: { next_cursor: null } };
    return loadUsersData({ append: true });
  },
  async createStaff() {
    const body = {
      full_name: $('staffName').value,
      email: $('staffEmail').value,
      role: $('staffRole').value,
    };
    if ($('staffPhone').value) body.phone = $('staffPhone').value;
    const result = await api('/users', { method: 'POST', body });
    state.selected.userId = result.user?.id || '';
    $('staffResult').innerHTML = `
      <strong>${escapeHtml(result.user?.full_name || '')}</strong><br>
      ${escapeHtml(result.user?.email || '')}<br>
      Temporary password: <strong>${escapeHtml(result.temp_password || '')}</strong>
    `;
    await loadUsersData();
    saveSession();
    return result;
  },
  selectUser({ id }) {
    state.selected.userId = id;
    saveSession();
    const user = state.data.users.find((item) => item.id === id);
    $('selectedUserLabel').textContent = user ? `${user.full_name} - ${roleName(user.role)}` : id;
    if ($('groupMemberUserId')) $('groupMemberUserId').value = id;
    return user || { id };
  },
  async makeDirector() {
    if (!state.selected.userId) throw new Error('Select a user first.');
    const result = await api(`/users/${state.selected.userId}/make-director`, { method: 'PATCH' });
    await loadUsersData();
    return result;
  },
  async resetStaffPassword() {
    if (!state.selected.userId) throw new Error('Select a user first.');
    const result = await api(`/users/${state.selected.userId}/reset-password`, { method: 'PATCH' });
    $('staffResult').innerHTML = `
      <strong>${escapeHtml(result.user?.full_name || '')}</strong><br>
      Temporary password: <strong>${escapeHtml(result.temp_password || '')}</strong>
    `;
    await loadUsersData();
    return result;
  },
  async deactivateUser() {
    if (!state.selected.userId) throw new Error('Select a user first.');
    const result = await api(`/users/${state.selected.userId}/deactivate`, { method: 'PATCH' });
    await loadUsersData();
    return result;
  },
  async loadInquiries() {
    const result = await loadInquiriesData();
    renderDashboard();
    return result;
  },
  async loadMoreInquiries() {
    if (!state.pagination.inquiries) return { items: [], pagination: { next_cursor: null } };
    const result = await loadInquiriesData({ append: true });
    renderDashboard();
    return result;
  },
  async selectInquiry({ id }) {
    state.selected.inquiryId = id;
    saveSession();
    const inquiry = await api(`/inquiries/${id}`);
    state.data.currentInquiry = inquiry;
    renderInquiryDetail(inquiry);
    return inquiry;
  },
  async assignInquiry() {
    const id = state.selected.inquiryId;
    if (!id) throw new Error('Select an inquiry first.');
    const lawyerId = $('assignLawyerId').value;
    if (!lawyerId) throw new Error('Select a lawyer.');
    const result = await api(`/inquiries/${id}/assign`, {
      method: 'POST',
      body: { lawyer_id: lawyerId, note: $('assignNote').value || null },
    });
    state.selected.caseId = result.case_id;
    await loadInquiriesData();
    await loadCasesData();
    renderDashboard();
    saveSession();
    return result;
  },
  async loadCases() {
    const result = await loadCasesData();
    renderDashboard();
    return result;
  },
  async loadMoreCases() {
    if (!state.pagination.cases) return { items: [], pagination: { next_cursor: null } };
    const result = await loadCasesData({ append: true });
    renderDashboard();
    return result;
  },
  async selectCase({ id }) {
    state.selected.caseId = id;
    saveSession();
    const c = await api(`/cases/${id}`);
    state.data.currentCase = c;
    renderCaseDetail(c);
    state.data.tasks = c.tasks || [];
    state.data.documents = c.documents || [];
    state.data.notes = c.notes || [];
    renderTasks();
    renderDocuments();
    renderNotes();
    if ($('groupCaseId')) $('groupCaseId').value = id;
    return c;
  },
  async updateCaseStatus() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const result = await api(`/cases/${state.selected.caseId}/status`, {
      method: 'PATCH',
      body: { status: $('caseStatus').value },
    });
    await actions.selectCase({ id: state.selected.caseId });
    await loadCasesData();
    return result;
  },
  async reassignCase() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    if (!$('reassignLawyerId').value) throw new Error('Select a lawyer.');
    const result = await api(`/cases/${state.selected.caseId}/reassign`, {
      method: 'PATCH',
      body: {
        lawyer_id: $('reassignLawyerId').value,
        reason: $('reassignReason').value || null,
      },
    });
    await actions.selectCase({ id: state.selected.caseId });
    await loadCasesData();
    return result;
  },
  async loadTasks() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const result = await api(`/cases/${state.selected.caseId}/tasks?limit=100`);
    state.data.tasks = result.items || [];
    state.pagination.tasks = result.pagination?.next_cursor || null;
    renderTasks();
    return result;
  },
  async loadMoreTasks() {
    if (!state.selected.caseId || !state.pagination.tasks) return { items: [], pagination: { next_cursor: null } };
    const result = await api(`/cases/${state.selected.caseId}/tasks${query({ limit: 100, cursor: state.pagination.tasks })}`);
    state.data.tasks = [...state.data.tasks, ...(result.items || [])];
    state.pagination.tasks = result.pagination?.next_cursor || null;
    renderTasks();
    return result;
  },
  selectTask({ id }) {
    state.selected.taskId = id;
    saveSession();
    const task = state.data.tasks.find((item) => item.id === id);
    if (task) {
      $('taskTitle').value = task.title || '';
      $('taskPriority').value = task.priority || 'medium';
      $('taskStatus').value = task.status || 'todo';
      $('taskDueDate').value = task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';
    }
    return task || { id };
  },
  async createTask() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const body = {
      title: $('taskTitle').value,
      priority: $('taskPriority').value,
    };
    if ($('taskDueDate').value) body.due_date = new Date($('taskDueDate').value).toISOString();
    const result = await api(`/cases/${state.selected.caseId}/tasks`, { method: 'POST', body });
    state.selected.taskId = result.id;
    await actions.loadTasks();
    saveSession();
    return result;
  },
  async updateSelectedTask() {
    if (!state.selected.caseId || !state.selected.taskId) throw new Error('Select a task first.');
    const body = {
      title: $('taskTitle').value,
      priority: $('taskPriority').value,
      status: $('taskStatus').value,
    };
    if ($('taskDueDate').value) body.due_date = new Date($('taskDueDate').value).toISOString();
    const result = await api(`/cases/${state.selected.caseId}/tasks/${state.selected.taskId}`, { method: 'PATCH', body });
    await actions.loadTasks();
    return result;
  },
  async deleteTask({ id }) {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    await api(`/cases/${state.selected.caseId}/tasks/${id}`, { method: 'DELETE' });
    await actions.loadTasks();
    return { deleted: id };
  },
  async loadDocuments() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const result = await api(`/cases/${state.selected.caseId}/documents?limit=100`);
    state.data.documents = result.items || [];
    state.pagination.documents = result.pagination?.next_cursor || null;
    renderDocuments();
    return result;
  },
  async loadMoreDocuments() {
    if (!state.selected.caseId || !state.pagination.documents) return { items: [], pagination: { next_cursor: null } };
    const result = await api(`/cases/${state.selected.caseId}/documents${query({ limit: 100, cursor: state.pagination.documents })}`);
    state.data.documents = [...state.data.documents, ...(result.items || [])];
    state.pagination.documents = result.pagination?.next_cursor || null;
    renderDocuments();
    return result;
  },
  async uploadDocument() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const file = $('documentFile').files[0];
    if (!file) throw new Error('Choose a file.');
    const result = await api(`/cases/${state.selected.caseId}/documents`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name,
        'X-Description': $('documentDescription').value || '',
      },
    });
    state.selected.documentId = result.id;
    await actions.loadDocuments();
    saveSession();
    return result;
  },
  async downloadDocument({ id }) {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const documentId = id || state.selected.documentId;
    if (!documentId) throw new Error('Select a document.');
    const blob = await api(`/cases/${state.selected.caseId}/documents/${documentId}/download`);
    const doc = state.data.documents.find((item) => item.id === documentId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc?.filename || 'document';
    link.click();
    URL.revokeObjectURL(url);
    return { downloaded: documentId, bytes: blob.size };
  },
  async loadNotes() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const result = await api(`/cases/${state.selected.caseId}/notes?limit=100`);
    state.data.notes = result.items || [];
    state.pagination.notes = result.pagination?.next_cursor || null;
    renderNotes();
    return result;
  },
  async loadMoreNotes() {
    if (!state.selected.caseId || !state.pagination.notes) return { items: [], pagination: { next_cursor: null } };
    const result = await api(`/cases/${state.selected.caseId}/notes${query({ limit: 100, cursor: state.pagination.notes })}`);
    state.data.notes = [...state.data.notes, ...(result.items || [])];
    state.pagination.notes = result.pagination?.next_cursor || null;
    renderNotes();
    return result;
  },
  async createNote() {
    if (!state.selected.caseId) throw new Error('Select a case first.');
    const result = await api(`/cases/${state.selected.caseId}/notes`, {
      method: 'POST',
      body: { body: $('noteBody').value },
    });
    await actions.loadNotes();
    return result;
  },
  async loadGroups() {
    const result = await loadGroupsData();
    return result;
  },
  selectGroup({ id }) {
    state.selected.groupId = id;
    saveSession();
    const group = state.data.groups.find((item) => item.id === id);
    $('selectedGroupLabel').textContent = group ? `${group.name} - ${group.type}` : id;
    return group || { id };
  },
  async createGroup() {
    const result = await api('/groups', {
      method: 'POST',
      body: { name: $('groupName').value, type: $('groupType').value },
    });
    state.selected.groupId = result.id;
    await loadGroupsData();
    saveSession();
    return result;
  },
  async addGroupMember() {
    if (!state.selected.groupId) throw new Error('Select a group first.');
    const userId = $('groupMemberUserId').value || state.selected.userId;
    if (!userId) throw new Error('Select a user.');
    const result = await api(`/groups/${state.selected.groupId}/members`, {
      method: 'POST',
      body: { user_id: userId },
    });
    await loadGroupsData();
    return result;
  },
  async attachCaseToGroup() {
    if (!state.selected.groupId) throw new Error('Select a group first.');
    const caseId = $('groupCaseId').value || state.selected.caseId;
    if (!caseId) throw new Error('Select a case.');
    const result = await api(`/groups/${state.selected.groupId}/cases`, {
      method: 'POST',
      body: { case_id: caseId },
    });
    await loadGroupsData();
    return result;
  },
  async loadEmailJobs() {
    const result = await loadJobsData();
    renderDashboard();
    return result;
  },
  async selectJob({ id }) {
    state.selected.jobId = id;
    saveSession();
    const result = await api(`/jobs/email/${id}`);
    $('selectedJobLabel').textContent = id;
    $('jobDetail').textContent = JSON.stringify(result, null, 2);
    return result;
  },
  clearResponse() {
    setOutput('Ready.');
    return undefined;
  },
};

document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    showView(viewButton.dataset.view, true);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  event.preventDefault();
  run(actionButton.dataset.action, actionButton.dataset);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'apiBasePublic' || event.target.id === 'apiBaseApp') {
    state.apiBase = event.target.value.replace(/\/$/, '');
    saveSession();
    syncApiInputs();
  }
  if (event.target.id === 'inquiryId') {
    state.selected.inquiryId = event.target.value;
    saveSession();
  }
});

async function init() {
  syncApiInputs();
  if ($('inquiryId')) $('inquiryId').value = state.selected.inquiryId;
  updateShell();
  if (state.accessToken) {
    try {
      await loadProfileData();
      await bootstrap();
      updateShell();
    } catch {
      clearSession();
      updateShell();
    }
  }
}

init();
