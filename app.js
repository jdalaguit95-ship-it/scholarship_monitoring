const SUPABASE_URL = 'https://krragpawusyekclwzugt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycmFncGF3dXN5ZWtjbHd6dWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MDQyNDksImV4cCI6MjEwNjI4MDI0OX0.h8yj33Sd0D_dNqKBySYpQ6GpAT_EOhoR_rzjAYEQmN0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let programs = [];
let scholars = [];
let submissions = [];
function getCurUser() {
  return JSON.parse(localStorage.getItem('curUser') || 'null');
}

function checkAuth(requiredRole) {
  const role = localStorage.getItem('role');
  const cur = getCurUser();
  if (!role || !cur) {
    location.href = 'login.html';
    return null;
  }
  if (requiredRole && role !== requiredRole) {
    if (!(role === 'admin' && requiredRole === 'staff')) {
      alert('Access denied');
      location.href = 'login.html';
      return null;
    }
  }
  const el = document.getElementById('userInfo');
  if (el) el.innerText = `${cur.full_name} (${role.toUpperCase()})`;
  return cur;
}

function toggle(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function goToIndex() { location.href = 'index.html'; }

// ================= LOGIN =================
async function login() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const selectedRole = document.getElementById('role').value;

  if (!email || !password) return alert('Email and Password required');

  // DEMO MODE: 123456 = login bisan unsa basta naa sa profiles table
  if (password === '123456') {
    const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('email', email).maybeSingle();
    
    if (error) return alert('DB Error: ' + error.message);
    if (!profile) return alert('Wala pa ang user sa Supabase. Buhati sa Authentication > Users > Add user + profiles table');

    if (profile.role !== selectedRole) {
      return alert(`Role mismatch. Sa database ang role kay ${profile.role}, pero imong gi-pili ${selectedRole}`);
    }

    localStorage.setItem('curUser', JSON.stringify(profile));
    localStorage.setItem('role', profile.role);

    if (profile.role === 'admin') location.href = 'admin.html';
    else if (profile.role === 'staff') location.href = 'staff.html';
    else location.href = 'student.html';
    return;
  }

  // REAL SUPABASE AUTH LOGIN
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return alert('Login failed: ' + error.message);

  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', data.user.id).single();
  if (!profile) return alert('No profile record found');

  if (profile.role !== selectedRole) return alert(`Role mismatch. You are ${profile.role}`);

  localStorage.setItem('curUser', JSON.stringify(profile));
  localStorage.setItem('role', profile.role);

  if (profile.role === 'admin') location.href = 'admin.html';
  else if (profile.role === 'staff') location.href = 'staff.html';
  else location.href = 'student.html';
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  location.href = 'login.html';
}

// ================= ADMIN / STAFF - LOAD ALL =================
async function renderAll() {
  const { data: pData } = await supabaseClient.from('scholarship_programs').select('*').order('program_name');
  programs = pData || [];

  const { data: sData } = await supabaseClient.from('scholars').select('*, scholarship_programs(program_name)').order('created_at', { ascending: false });
  scholars = sData || [];

  const { data: subData } = await supabaseClient.from('grade_submissions').select('*, scholars(full_name, student_id)').order('submitted_at', { ascending: false });
  submissions = subData || [];

  // Stats
  const totalEl = document.getElementById('totalScholars');
  if (totalEl) totalEl.innerText = scholars.length;
  const pendingEl = document.getElementById('pendingCount');
  if (pendingEl) pendingEl.innerText = submissions.filter(x => x.submission_status !== 'Verified').length;
  const verifiedEl = document.getElementById('verifiedCount');
  if (verifiedEl) verifiedEl.innerText = submissions.filter(x => x.submission_status === 'Verified').length;
  const compliantEl = document.getElementById('compliantCount');
  if (compliantEl) compliantEl.innerText = submissions.filter(x => x.compliance_result === 'Compliant').length;
  const deficientEl = document.getElementById('deficiencyCount');
  if (deficientEl) deficientEl.innerText = submissions.filter(x => x.compliance_result === 'With Deficiency').length;

  renderPrograms();
  renderScholars();
  renderSubmissions();
  renderCompliance();
}

function renderPrograms() {
  const body = document.getElementById('programsBody');
  if (!body) return;
  body.innerHTML = programs.map(p => `<tr><td>${p.program_name}</td><td>${p.required_gwa}</td><td>${p.min_units}</td><td>${p.allow_failing_grade ? 'Yes' : 'No'}</td></tr>`).join('');
  const sel = document.getElementById('f_scholarship');
  if (sel) sel.innerHTML = programs.map(p => `<option value="${p.id}">${p.program_name}</option>`).join('');
}

function renderScholars() {
  const body = document.getElementById('scholarsBody');
  if (!body) return;
  const q = (document.getElementById('searchScholar')?.value || '').toLowerCase();
  const list = scholars.filter(s => !q || s.full_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q));
  body.innerHTML = list.map(s => `<tr><td>${s.student_id}</td><td>${s.full_name}</td><td>${s.degree_program || ''}</td><td>${s.scholarship_programs?.program_name || ''}</td><td><span class="badge ${s.status === 'Compliant' ? 'compliant' : s.status === 'With Deficiency' ? 'deficiency' : 'pending'}">${s.status}</span></td></tr>`).join('');
}

function renderSubmissions() {
  const body = document.getElementById('submissionsBody') || document.getElementById('staffSubmissionsBody');
  if (!body) return;
  body.innerHTML = submissions.map(sub => `
    <tr>
      <td>${sub.scholars?.full_name || ''} (${sub.scholars?.student_id || ''})</td>
      <td>${sub.academic_year} ${sub.semester}</td>
      <td>GWA:${sub.gwa} Units:${sub.units_enrolled} Fail:${sub.failed_subjects}</td>
      <td><span class="badge ${sub.submission_status === 'Verified' ? 'verified' : 'pending'}">${sub.submission_status}</span></td>
      <td><span class="badge ${sub.compliance_result === 'Compliant' ? 'compliant' : sub.compliance_result === 'With Deficiency' ? 'deficiency' : 'pending'}">${sub.compliance_result || 'Pending'}</span></td>
      <td>${sub.submission_status !== 'Verified' ? `<button class="btn btn-sm btn-success" onclick="verify('${sub.id}')">Verify (FR-06)</button>` : 'Done'}</td>
    </tr>`).join('');
}

function renderCompliance() {
  const body = document.getElementById('complianceBody');
  if (!body) return;
  body.innerHTML = submissions.filter(s => s.submission_status === 'Verified').map(s => `<tr><td>${s.scholars?.full_name || ''}</td><td>${s.academic_year} ${s.semester}</td><td>GWA:${s.gwa} Units:${s.units_enrolled}</td><td><span class="badge ${s.compliance_result === 'Compliant' ? 'compliant' : 'deficiency'}">${s.compliance_result}</span></td></tr>`).join('');
}

async function addProgram() {
  const name = document.getElementById('p_name').value.trim();
  const gwa = parseFloat(document.getElementById('p_gwa').value);
  const units = parseInt(document.getElementById('p_units').value);
  const allow = document.getElementById('p_allow').value === 'true';
  if (!name || isNaN(gwa) || isNaN(units)) return alert('Fill all');
  const cur = getCurUser();
  const { error } = await supabaseClient.from('scholarship_programs').insert({ program_name: name, required_gwa: gwa, min_units: units, allow_failing_grade: allow, created_by: cur.id });
  if (error) return alert(error.message);
  alert('Program added'); renderAll();
}

async function saveScholar() {
  const sid = document.getElementById('f_student_id').value.trim();
  const name = document.getElementById('f_full_name').value.trim();
  const deg = document.getElementById('f_degree').value.trim();
  const year = document.getElementById('f_year').value;
  const prog = document.getElementById('f_scholarship').value;
  if (!sid || !name) return alert('ID and Name required');
  const { error } = await supabaseClient.from('scholars').insert({ student_id: sid, full_name: name, degree_program: deg, year_level: year, scholarship_id: prog, status: 'Active' });
  if (error) return alert(error.message);
  toggle('scholarForm'); renderAll();
}

async function verify(id) {
  const cur = getCurUser();
  const { error } = await supabaseClient.from('grade_submissions').update({ submission_status: 'Verified', verified_by: cur.id, verified_at: new Date().toISOString() }).eq('id', id);
  if (error) return alert(error.message);
  alert('Verified! Trigger will set Compliant/Deficiency'); renderAll();
}

// ================= STUDENT =================
async function renderAllStudent() {
  const cur = getCurUser();
  if (!cur) return;
  let { data: myScholar } = await supabaseClient.from('scholars').select('*, scholarship_programs(program_name, required_gwa, min_units)').eq('profile_id', cur.id).maybeSingle();
  if (!myScholar && cur.student_id) {
    const { data } = await supabaseClient.from('scholars').select('*, scholarship_programs(program_name, required_gwa, min_units)').eq('student_id', cur.student_id).maybeSingle();
    myScholar = data;
  }
  if (!myScholar && cur.email) {
    const { data } = await supabaseClient.from('scholars').select('*, scholarship_programs(program_name, required_gwa, min_units)').ilike('email', cur.email).maybeSingle();
    myScholar = data;
  }

  const profileEl = document.getElementById('myProfile');
  if (profileEl) {
    profileEl.innerHTML = myScholar ? `<p><b>${myScholar.full_name}</b> - ${myScholar.student_id}<br>Course: ${myScholar.degree_program} (${myScholar.year_level})<br>Scholarship: ${myScholar.scholarship_programs?.program_name || 'None'}<br>Requirement: GWA ≤ ${myScholar.scholarship_programs?.required_gwa || '-'}, Units ≥ ${myScholar.scholarship_programs?.min_units || '-'}<br>Status: <span class="badge ${myScholar.status === 'Compliant' ? 'compliant' : myScholar.status === 'With Deficiency' ? 'deficiency' : 'pending'}">${myScholar.status}</span></p>` : 'No scholar record found. Contact admin.';
  }

  if (!myScholar) return;
  const { data: mySubs } = await supabaseClient.from('grade_submissions').select('*').eq('scholar_id', myScholar.id).order('submitted_at', { ascending: false });
  const body = document.getElementById('mySubmissionsBody');
  if (body) body.innerHTML = (mySubs || []).map(s => `<tr><td>${s.academic_year} ${s.semester}</td><td>${s.gwa}</td><td><span class="badge ${s.submission_status === 'Verified' ? 'verified' : 'pending'}">${s.submission_status}</span></td><td><span class="badge ${s.compliance_result === 'Compliant' ? 'compliant' : s.compliance_result === 'With Deficiency' ? 'deficiency' : 'pending'}">${s.compliance_result || 'Pending'}</span></td></tr>`).join('');
}

async function submitGradeStudent() {
  const cur = getCurUser();
  let { data: myScholar } = await supabaseClient.from('scholars').select('id').eq('profile_id', cur.id).maybeSingle();
  if (!myScholar && cur.student_id) {
    const { data } = await supabaseClient.from('scholars').select('id').eq('student_id', cur.student_id).maybeSingle();
    myScholar = data;
  }
  if (!myScholar) return alert('No scholar record');
  const gwa = parseFloat(document.getElementById('s_gwa').value);
  const units = parseInt(document.getElementById('s_units').value);
  if (isNaN(gwa) || gwa < 1 || gwa > 5) return alert('GWA 1.0-5.0');
  if (isNaN(units)) return alert('Units required');
  const { error } = await supabaseClient.from('grade_submissions').insert({
    scholar_id: myScholar.id, academic_year: document.getElementById('s_ay').value, semester: document.getElementById('s_sem').value,
    gwa, units_enrolled: units, failed_subjects: parseInt(document.getElementById('s_failed').value || 0), incomplete_subjects: parseInt(document.getElementById('s_incomplete').value || 0),
    submission_status: 'For Verification', compliance_result: 'Pending'
  });
  if (error) return alert(error.message);
  alert('Submitted for Verification (FR-04 PASS)'); renderAllStudent();
}