let currentAvg = null;
let animFrame = null;
let importing = false;
let dragSrc = null;

const tbody = document.getElementById('tbody');
const avgEl = document.getElementById('avg-num');
const mentionEl = document.getElementById('mention');
const barFill = document.getElementById('bar-fill');

// ===== row management =====

function createRow(data = {}) {
    const { subject = '', grade = '', max = '20', coeff = '1' } = data;
    const tr = document.createElement('tr');
    tr.setAttribute('draggable', 'true');
    tr.innerHTML = `
        <td><span class="drag-handle" title="Déplacer">⠿</span></td>
        <td><input class="inp" type="text" placeholder="Matière…" value="${subject}"></td>
        <td>
            <div class="grade-wrap">
                <input class="inp inp-num inp-grade" type="number" min="0" step="0.5" placeholder="—" value="${grade}">
                <span class="grade-sep">/</span>
                <input class="inp inp-num inp-max" type="number" min="0.1" step="1" value="${max}" title="Note sur…">
            </div>
        </td>
        <td><input class="inp inp-num" type="number" min="0" step="0.5" value="${coeff}"></td>
        <td><button class="btn-del" title="Supprimer">×</button></td>
    `;

    tr.querySelectorAll('.inp').forEach(inp => {
        inp.addEventListener('input', () => {
            recalc();
            if (!importing) checkAutoAddRow(tr);
        });
    });
    tr.querySelector('.btn-del').addEventListener('click', () => removeRow(tr));

    setupDrag(tr);
    tbody.appendChild(tr);
    if (!importing) recalc();
}

function removeRow(tr) {
    tr.classList.add('row-out');
    setTimeout(() => {
        tr.remove();
        recalc();
    }, 260);
}

// adds a new row when any input in the last row is touched
function checkAutoAddRow(tr) {
    const visible = [...tbody.querySelectorAll('tr:not(.row-out)')];
    if (tr !== visible[visible.length - 1]) return;
    const subjectVal = tr.cells[1]?.querySelector('.inp')?.value.trim();
    const gradeVal = tr.cells[2]?.querySelector('.inp-grade')?.value.trim();
    if (subjectVal !== '' || gradeVal !== '') createRow();
}

// ===== drag & drop reorder =====

function setupDrag(tr) {
    tr.addEventListener('dragstart', e => {
        dragSrc = tr;
        e.dataTransfer.effectAllowed = 'move';
        // delay class add so the ghost image captures the normal state
        requestAnimationFrame(() => tr.classList.add('dragging'));
    });

    tr.addEventListener('dragend', () => {
        tr.classList.remove('dragging');
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
        dragSrc = null;
    });

    tr.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (tr === dragSrc) return;
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
        tr.classList.add('drag-over');
    });

    tr.addEventListener('dragleave', () => {
        tr.classList.remove('drag-over');
    });

    tr.addEventListener('drop', e => {
        e.preventDefault();
        tr.classList.remove('drag-over');
        if (!dragSrc || dragSrc === tr) return;
        const rows = [...tbody.querySelectorAll('tr')];
        const srcIdx = rows.indexOf(dragSrc);
        const tgtIdx = rows.indexOf(tr);
        if (srcIdx < tgtIdx) {
            tr.after(dragSrc);
        } else {
            tr.before(dragSrc);
        }
        recalc();
    });
}

// ===== calculation =====

function recalc() {
    const rows = tbody.querySelectorAll('tr:not(.row-out)');
    let sumWG = 0, sumW = 0;

    rows.forEach(tr => {
        const gradeInp = tr.cells[2]?.querySelector('.inp-grade');
        const maxInp   = tr.cells[2]?.querySelector('.inp-max');
        const coeffInp = tr.cells[3]?.querySelector('.inp');
        if (!gradeInp || !maxInp || !coeffInp) return;
        const g = parseFloat(gradeInp.value);
        const m = parseFloat(maxInp.value) || 20;
        const c = parseFloat(coeffInp.value);
        if (!isNaN(g) && !isNaN(c) && c > 0 && gradeInp.value.trim() !== '') {
            sumWG += (g / m) * 20 * c;
            sumW  += c;
        }
    });

    if (sumW === 0) {
        if (animFrame) cancelAnimationFrame(animFrame);
        currentAvg = null;
        avgEl.textContent = '—';
        mentionEl.textContent = 'Aucune note saisie';
        barFill.style.width = '0%';
        if (!importing) scheduleSave();
        return;
    }

    const avg = Math.min(sumWG / sumW, 20);
    animateAvg(avg);
    barFill.style.width = `${(avg / 20) * 100}%`;
    mentionEl.textContent = getMention(avg);
    if (!importing) scheduleSave();
}

function getMention(avg) {
    if (avg >= 18) return 'Félicitations du jury';
    if (avg >= 16) return 'Très Bien';
    if (avg >= 14) return 'Bien';
    if (avg >= 12) return 'Assez Bien';
    if (avg >= 10) return 'Passable';
    return 'Insuffisant';
}

// ===== animated count-up =====

function animateAvg(target) {
    if (animFrame) cancelAnimationFrame(animFrame);

    avgEl.classList.remove('bump');
    void avgEl.offsetWidth;
    avgEl.classList.add('bump');

    const startVal = currentAvg ?? target;
    const startTime = performance.now();
    const duration = 650;

    function step(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const val = startVal + (target - startVal) * ease;
        avgEl.textContent = val.toFixed(2);
        if (t < 1) {
            animFrame = requestAnimationFrame(step);
        } else {
            currentAvg = target;
            avgEl.textContent = target.toFixed(2);
        }
    }
    animFrame = requestAnimationFrame(step);
}

// ===== JSON export/import =====

function getRowData() {
    return [...tbody.querySelectorAll('tr:not(.row-out)')].map(tr => ({
        subject: tr.cells[1]?.querySelector('.inp')?.value    ?? '',
        grade:   tr.cells[2]?.querySelector('.inp-grade')?.value ?? '',
        max:     tr.cells[2]?.querySelector('.inp-max')?.value   ?? '20',
        coeff:   tr.cells[3]?.querySelector('.inp')?.value    ?? '1',
    }));
}

document.getElementById('btn-export-json').addEventListener('click', () => {
    const data = { notes: getRowData() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notes.json';
    link.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!Array.isArray(data.notes)) throw new Error('format invalide');
            importing = true;
            tbody.innerHTML = '';
            currentAvg = null;
            data.notes.forEach(row => createRow(row));
            importing = false;
            recalc();
        } catch {
            alert('Fichier JSON invalide ou format non reconnu.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ===== theme switcher =====

const themeButtons = document.querySelectorAll('.theme');

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        themeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.documentElement.setAttribute('data-theme', btn.dataset.theme);
        localStorage.setItem('theme', btn.dataset.theme);
    });
});

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeButtons.forEach(b => b.classList.toggle('active', b.dataset.theme === savedTheme));
}

// ===== ripple effect =====

function setupRipple(btn) {
    btn.addEventListener('click', e => {
        const r = document.createElement('span');
        r.className = 'ripple';
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(r);
        setTimeout(() => r.remove(), 600);
    });
}

document.querySelectorAll('.btn-action').forEach(setupRipple);

// ===== capture helpers =====

function hideUIControls(hidden) {
    const sel = '.btn-del, .th-del, .drag-handle, .th-drag';
    document.querySelectorAll(sel).forEach(el => {
        el.style.visibility = hidden ? 'hidden' : '';
    });
}

async function captureArea() {
    const el = document.getElementById('capture');
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    // resolved bg color (getComputedStyle resolves CSS vars)
    const bgColor = window.getComputedStyle(el).backgroundColor;
    // scroll to top so html2canvas finds the element at the right position
    const prevScrollY = window.scrollY;
    window.scrollTo(0, 0);
    hideUIControls(true);
    try {
        return await html2canvas(el, {
            scale: Math.min(window.devicePixelRatio || 1, 2),
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: bgColor || '#161b22',
            scrollX: 0,
            scrollY: 0,
            // preserve theme on the cloned doc so CSS vars resolve correctly
            onclone: (clonedDoc) => {
                clonedDoc.documentElement.setAttribute('data-theme', theme);
            },
        });
    } finally {
        hideUIControls(false);
        window.scrollTo(0, prevScrollY);
    }
}

// ===== export PNG =====

document.getElementById('btn-png').addEventListener('click', async () => {
    const btn = document.getElementById('btn-png');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Génération…';
    try {
        const canvas = await captureArea();
        const link = document.createElement('a');
        link.download = 'notes.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } finally {
        btn.disabled = false;
        btn.innerHTML = label;
    }
});

// ===== export PDF =====

document.getElementById('btn-pdf').addEventListener('click', async () => {
    const btn = document.getElementById('btn-pdf');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Génération…';
    try {
        const canvas = await captureArea();
        const { jsPDF } = window.jspdf;
        const w = canvas.width / 2;
        const h = canvas.height / 2;
        const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
        pdf.save('notes.pdf');
    } finally {
        btn.disabled = false;
        btn.innerHTML = label;
    }
});

// ===== add row button =====

document.getElementById('btn-add').addEventListener('click', createRow);

// ===== sessions / localStorage =====

const STORAGE_KEY = 'calc_notes_v1';
let sessions = [];
let activeId = null;
let saveTimer = null;

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
}

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lists: sessions, activeId }));
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentList, 800);
}

function saveCurrentList() {
    if (!activeId) return;
    const s = sessions.find(s => s.id === activeId);
    if (!s) return;
    s.name = document.getElementById('session-name').value.trim() || 'Sans titre';
    s.notes = getRowData();
    persist();
    flashSaveIndicator();
}

function flashSaveIndicator() {
    const el = document.getElementById('save-indicator');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
}

function newSession(name = 'Nouvelle liste') {
    const s = { id: genId(), name, notes: [] };
    sessions.push(s);
    return s;
}

// loads a session into the DOM without saving current first
function loadSession(id) {
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    activeId = id;
    document.getElementById('session-name').value = s.name;
    importing = true;
    tbody.innerHTML = '';
    currentAvg = null;
    if (s.notes.length > 0) {
        s.notes.forEach(row => createRow(row));
    } else {
        createRow(); createRow(); createRow();
    }
    importing = false;
    recalc();
    persist();
    renderSessionsList();
}

// saves current then loads another
function switchToSession(id) {
    if (id === activeId) return;
    saveCurrentList();
    loadSession(id);
}

function deleteSession(id) {
    if (sessions.length <= 1) return;
    sessions = sessions.filter(s => s.id !== id);
    if (activeId === id) {
        loadSession(sessions[0].id);
    } else {
        persist();
        renderSessionsList();
    }
}

function renderSessionsList() {
    const ul = document.getElementById('sessions-list');
    ul.innerHTML = '';
    sessions.forEach((s, i) => {
        const filled = s.notes.filter(n => (n.subject || '').trim() || (n.grade || '').trim()).length;
        const li = document.createElement('li');
        li.className = `session-item${s.id === activeId ? ' active' : ''}`;
        li.innerHTML = `
            <span class="session-item-name">${s.name}</span>
            <span class="session-item-count">${filled} matière${filled !== 1 ? 's' : ''}</span>
            <button class="btn-session-del"${sessions.length === 1 ? ' disabled' : ''} title="Supprimer">×</button>
        `;
        li.addEventListener('click', e => {
            if (e.target.closest('.btn-session-del')) return;
            switchToSession(s.id);
            closePanel();
        });
        li.querySelector('.btn-session-del').addEventListener('click', e => {
            e.stopPropagation();
            deleteSession(s.id);
        });
        ul.appendChild(li);
    });
}

const panel    = document.getElementById('sessions-panel');
const togBtn   = document.getElementById('btn-sess-toggle');
const sessBar  = document.getElementById('sessions-bar');

function openPanel() {
    saveCurrentList();
    renderSessionsList();
    panel.classList.add('open');
    togBtn.classList.add('open');
}

function closePanel() {
    panel.classList.remove('open');
    togBtn.classList.remove('open');
}

togBtn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.contains('open') ? closePanel() : openPanel();
});

document.addEventListener('click', e => {
    if (!sessBar.contains(e.target)) closePanel();
});

document.getElementById('btn-sess-new').addEventListener('click', () => {
    saveCurrentList();
    const s = newSession();
    loadSession(s.id);
    closePanel();
    setTimeout(() => {
        const inp = document.getElementById('session-name');
        inp.select();
        inp.focus();
    }, 60);
});

document.getElementById('session-name').addEventListener('input', scheduleSave);

// ===== init =====

(function initSessions() {
    const stored = readStorage();
    if (stored && Array.isArray(stored.lists) && stored.lists.length > 0) {
        sessions = stored.lists;
        const id = stored.activeId && sessions.find(s => s.id === stored.activeId)
            ? stored.activeId
            : sessions[0].id;
        loadSession(id);
    } else {
        const s = newSession('Mes notes');
        loadSession(s.id);
    }
}());
