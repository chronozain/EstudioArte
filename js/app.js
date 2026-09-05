import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
    authDomain: "bd-personal-c3e4d.firebaseapp.com",
    databaseURL: "https://bd-personal-c3e4d-default-rtdb.firebaseio.com",
    projectId: "bd-personal-c3e4d",
    storageBucket: "bd-personal-c3e4d.firebasestorage.app",
    messagingSenderId: "739560517872",
    appId: "1:739560517872:web:8df36c57591b3220985235"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
} catch (e) {
    console.warn("Firebase init error:", e);
}

// --- LOCAL STORAGE PERSISTENCE & SAFE DB WRAPPERS ---
const LOCAL_STORAGE_KEY = 'escuela_arte_db_v2';

function getLocalDb() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error("Local storage error:", e);
    }
    const seedData = {
        alumnos: {
            "alu_1": {
                nombre: "Valentina",
                apellidos: "García",
                contacto: "555-123-4567",
                esMayor: false,
                tutor: { nombre: "María García", telefono: "555-987-6543" },
                fechaRegistro: new Date().toISOString()
            },
            "alu_2": {
                nombre: "Mateo",
                apellidos: "López",
                contacto: "555-234-5678",
                esMayor: true,
                tutor: { nombre: "", telefono: "" },
                fechaRegistro: new Date().toISOString()
            }
        },
        pagos_tipo_a: {
            "pago_a_1": {
                alumnoId: "alu_1",
                monto: 1200,
                faltante: 0,
                concepto: "mensualidad",
                fechaCreacion: new Date().toISOString(),
                fechaVencimiento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
                clasesBase: 4,
                clasesExtra: 0,
                medioPago: "Efectivo",
                observaciones: "Mensualidad inicial"
            }
        },
        pagos_paquetes: {
            "paq_1": {
                alumnoId: "alu_2",
                monto: 1800,
                faltante: 0,
                tipoPaquete: 6,
                clasesBase: 6,
                fechaCreacion: new Date().toISOString(),
                fechaVencimiento: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                medioPago: "Transferencia",
                observaciones: "Paquete de dibujo"
            }
        },
        pagos_tipo_b: {},
        asistencias: {
            "alu_1": {
                "asist_1": { pagoId: "pago_a_1", tomada: true, fechaTomada: new Date().toISOString(), tipo: 'base', origenPago: 'mensualidad' },
                "asist_2": { pagoId: "pago_a_1", tomada: false, tipo: 'base', origenPago: 'mensualidad' },
                "asist_3": { pagoId: "pago_a_1", tomada: false, tipo: 'base', origenPago: 'mensualidad' },
                "asist_4": { pagoId: "pago_a_1", tomada: false, tipo: 'base', origenPago: 'mensualidad' }
            },
            "alu_2": {
                "asist_5": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' },
                "asist_6": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' },
                "asist_7": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' },
                "asist_8": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' },
                "asist_9": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' },
                "asist_10": { pagoId: "paq_1", tomada: false, tipo: 'base', origenPago: 'paquete' }
            }
        }
    };
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seedData));
    } catch (e) {}
    return seedData;
}

function saveLocalDb(data) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Error saving local DB:", e);
    }
}

function getLocalNode(path) {
    const ldb = getLocalDb();
    if (!path) return ldb;
    const parts = path.split('/').filter(Boolean);
    let curr = ldb;
    for (const p of parts) {
        if (curr && typeof curr === 'object' && p in curr) {
            curr = curr[p];
        } else {
            return undefined;
        }
    }
    return curr;
}

async function safeGet(path) {
    if (db) {
        try {
            const snap = await get(ref(db, path));
            return {
                exists: () => snap.exists(),
                val: () => snap.val()
            };
        } catch (e) {
            console.warn(`Firebase get failed for '${path}', using local storage fallback:`, e.message || e);
        }
    }
    const val = getLocalNode(path);
    return {
        exists: () => val !== undefined && val !== null,
        val: () => val
    };
}

async function safeSet(path, val) {
    const ldb = getLocalDb();
    const parts = path.split('/').filter(Boolean);
    let curr = ldb;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') curr[parts[i]] = {};
        curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = val;
    saveLocalDb(ldb);

    if (db) {
        try {
            await set(ref(db, path), val);
        } catch (e) {
            console.warn(`Firebase set failed for '${path}':`, e.message || e);
        }
    }
}

async function safeUpdate(path, updObj) {
    const ldb = getLocalDb();
    const parts = path.split('/').filter(Boolean);
    let curr = ldb;
    for (let i = 0; i < parts.length; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
    }
    Object.assign(curr, updObj);
    saveLocalDb(ldb);

    if (db) {
        try {
            await update(ref(db, path), updObj);
        } catch (e) {
            console.warn(`Firebase update failed for '${path}':`, e.message || e);
        }
    }
}

async function safeRemove(path) {
    const ldb = getLocalDb();
    const parts = path.split('/').filter(Boolean);
    let curr = ldb;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) {
            curr = null;
            break;
        }
        curr = curr[parts[i]];
    }
    if (curr && parts.length > 0) {
        delete curr[parts[parts.length - 1]];
        saveLocalDb(ldb);
    }

    if (db) {
        try {
            await remove(ref(db, path));
        } catch (e) {
            console.warn(`Firebase remove failed for '${path}':`, e.message || e);
        }
    }
}

async function safePush(path, val) {
    let finalKey = null;

    if (db) {
        try {
            const pRef = push(ref(db, path));
            finalKey = pRef.key;
            if (val !== undefined) {
                await set(pRef, val);
            }
        } catch (e) {
            console.warn(`Firebase push failed for '${path}':`, e.message || e);
        }
    }

    if (!finalKey) {
        finalKey = 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }

    const ldb = getLocalDb();
    const parts = path.split('/').filter(Boolean);
    let curr = ldb;
    for (const p of parts) {
        if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
        curr = curr[p];
    }
    if (val !== undefined) {
        curr[finalKey] = val;
    }
    saveLocalDb(ldb);

    return { key: finalKey };
}

function safeOnValue(path, callback) {
    let handled = false;
    if (db) {
        try {
            return onValue(ref(db, path), snapshot => {
                handled = true;
                callback({
                    exists: () => snapshot.exists(),
                    val: () => snapshot.val()
                });
            }, error => {
                console.warn(`Firebase onValue failed for '${path}':`, error.message || error);
                if (!handled) {
                    const val = getLocalNode(path);
                    callback({
                        exists: () => val !== undefined && val !== null,
                        val: () => val
                    });
                }
            });
        } catch (e) {
            console.warn(`Firebase onValue setup error for '${path}':`, e.message || e);
        }
    }
    const val = getLocalNode(path);
    callback({
        exists: () => val !== undefined && val !== null,
        val: () => val
    });
}

// --- APP MANAGER ---
window.app = {
    showModal: id => document.getElementById(id)?.classList.remove('hidden-view'),
    hideModal: id => document.getElementById(id)?.classList.add('hidden-view'),
    changeView: (view) => {
        ['dashboard-view', 'alumnos-view', 'pagos-view', 'ajustes-view', 'profile-view', 'finanzas-view', 'paquetes-view'].forEach(v =>
            document.getElementById(v)?.classList.add('hidden-view')
        );
        const target = document.getElementById(view) || document.getElementById(view + '-view') || document.getElementById(view.replace('-view', ''));
        if (target) target.classList.remove('hidden-view');

        document.querySelectorAll('.nav-btn').forEach(b => {
            const navKey = b.dataset.nav;
            const activeKey = (view.includes('-') ? view.split('-')[0] : view.replace('-view', ''));
            b.classList.toggle('text-accent', navKey === activeKey);
            b.classList.toggle('text-gray-400', navKey !== activeKey);
        });

        if (view === 'finanzas-view') {
            const mesSel = document.getElementById('finanzas-mes');
            const anioSel = document.getElementById('finanzas-anio');
            if (mesSel && anioSel && mesSel.value !== "") {
                cargarFinanzas(mesSel.value, anioSel.value);
            }
        }

        if (view === 'paquetes-view') {
            loadActivePaquetes();
        }
    }
};

// --- AUTH ---
if (auth) {
    onAuthStateChanged(auth, user => {
        if (user || localStorage.getItem('auth_user')) {
            document.getElementById('login-view').classList.add('hidden-view');
            document.querySelector('nav')?.classList.remove('hidden-view');
            window.app.changeView('dashboard-view');
            refreshData();
        } else {
            document.getElementById('login-view').classList.remove('hidden-view');
            document.querySelector('nav')?.classList.add('hidden-view');
        }
    });
} else {
    if (localStorage.getItem('auth_user')) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.querySelector('nav')?.classList.remove('hidden-view');
        window.app.changeView('dashboard-view');
        refreshData();
    } else {
        document.getElementById('login-view').classList.remove('hidden-view');
        document.querySelector('nav')?.classList.add('hidden-view');
    }
}

document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) errorDiv.classList.add('hidden-view');

    const rawUser = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const email = rawUser.includes('@') ? rawUser : `${rawUser.toLowerCase()}@escueladearte.com`;

    let authSuccess = false;
    if (auth) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            authSuccess = true;
        } catch (e) {
            console.warn("Firebase auth error, checking fallback:", e.message || e);
        }
    }
    
    if (!authSuccess && rawUser && password) {
        localStorage.setItem('auth_user', JSON.stringify({ email, name: rawUser }));
        authSuccess = true;
    }

    if (authSuccess) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.querySelector('nav')?.classList.remove('hidden-view');
        window.app.changeView('dashboard-view');
        refreshData();
    } else {
        if (errorDiv) {
            errorDiv.textContent = 'Usuario o contraseña incorrectos';
            errorDiv.classList.remove('hidden-view');
        }
    }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (auth) signOut(auth).catch(() => {});
    localStorage.removeItem('auth_user');
    document.getElementById('login-view').classList.remove('hidden-view');
    document.querySelector('nav')?.classList.add('hidden-view');
    window.app.changeView('login-view');
});

// Toggle Password
document.getElementById('toggle-password')?.addEventListener('click', () => {
    const pass = document.getElementById('password');
    const icon = document.getElementById('toggle-password');
    if (!pass) return;
    pass.type = pass.type === 'password' ? 'text' : 'password';
    if (icon) icon.textContent = pass.type === 'password' ? 'visibility' : 'visibility_off';
});

// --- DATA REFRESH ---
function refreshData() {
    loadActiveStudents();
    loadFullStudents();
    initFinanzasFilters();
    loadActivePaquetes();
}

// --- CACHE DE ALERTAS PARA LA CAMPANA (mensualidades + paquetes) ---
let alertasMensualidadCache = [];
let alertasPaqueteCache = [];

// Switch Dashboard Tab
window.app.switchDashboardTab = (tab) => {
    const btnMens = document.getElementById('tab-btn-mensualidad');
    const btnPaq = document.getElementById('tab-btn-paquete');
    const contentMens = document.getElementById('tab-content-mensualidad');
    const contentPaq = document.getElementById('tab-content-paquete');

    if (!btnMens || !btnPaq || !contentMens || !contentPaq) return;

    if (tab === 'mensualidad') {
        contentMens.classList.remove('hidden-view');
        contentPaq.classList.add('hidden-view');

        btnMens.className = "flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all bg-white text-teal-800 shadow-xs flex items-center justify-center gap-1.5";
        btnPaq.className = "flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5";
    } else {
        contentPaq.classList.remove('hidden-view');
        contentMens.classList.add('hidden-view');

        btnPaq.className = "flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all bg-white text-purple-800 shadow-xs flex items-center justify-center gap-1.5";
        btnMens.className = "flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5";
    }
};

// 1. Alumnos activos (mensualidad)
let loadActiveStudentsSeq = 0;

async function loadActiveStudents(filter = '') {
    const seq = ++loadActiveStudentsSeq;
    const container = document.getElementById('active-students-list');
    if (!container) return;

    const [aluSnap, pagosASnap, asistSnap] = await Promise.all([
        safeGet('alumnos'),
        safeGet('pagos_tipo_a'),
        safeGet('asistencias')
    ]);

    if (seq !== loadActiveStudentsSeq) return;

    if (!aluSnap.exists()) {
        container.innerHTML = '<p class="text-xs font-semibold text-slate-400 text-center py-6">No hay alumnos registrados.</p>';
        alertasMensualidadCache = [];
        renderNotifDrawer();
        return;
    }

    const hoy = new Date();
    const pagosA = pagosASnap.val() || {};
    const asistencias = asistSnap.val() || {};
    const alertas = [];
    const cards = [];

    // Limpiar pagos gemelos en pagos_tipo_a si existieran
    const mensEntries = Object.entries(pagosA);
    for (const [id, m] of mensEntries) {
        if (id.startsWith('id_') && m && m.alumnoId) {
            const tieneGemelo = mensEntries.some(([otroId, otroM]) =>
                otroId !== id &&
                otroM.alumnoId === m.alumnoId &&
                otroM.fechaCreacion === m.fechaCreacion
            );
            if (tieneGemelo) {
                delete pagosA[id];
                await safeRemove(`pagos_tipo_a/${id}`);
            }
        }
    }

    const alumnosObj = aluSnap.val();
    for (const [id, s] of Object.entries(alumnosObj)) {
        const fullName = `${s.nombre || ''} ${s.apellidos || ''}`.trim();
        if (filter && !fullName.toLowerCase().includes(filter.toLowerCase())) continue;

        const pagoKey = Object.keys(pagosA).find(k => pagosA[k].alumnoId === id && new Date(pagosA[k].fechaVencimiento) > hoy);
        if (pagoKey) {
            const p = pagosA[pagoKey];
            const maxMens = parseInt((p.clasesBase || 4) + (p.clasesExtra || 0));
            if (asistencias[id]) {
                await sanitizeAsistenciasForPago(id, pagoKey, maxMens, asistencias[id]);
            }
            if (seq !== loadActiveStudentsSeq) return;

            const aluAsist = asistencias[id] ? Object.values(asistencias[id]).filter(a => a.pagoId === pagoKey) : [];
            const disponibles = Math.min(maxMens, aluAsist.filter(a => !a.tomada).length);
            const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

            const dias = Math.ceil((new Date(p.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24));
            if (dias <= 5) alertas.push({ nombre: fullName, dias });

            cards.push(`
                <div class="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/70 flex items-center justify-between cursor-pointer hover:border-teal-300 hover:shadow-sm active:scale-[0.99] transition-all"
                    onclick="window.app.openProfile('${id}')">
                    <div class="flex items-center gap-3.5">
                        <div class="size-11 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 p-0.5 shadow-xs shrink-0 flex items-center justify-center">
                            <div class="w-full h-full bg-white rounded-full flex items-center justify-center font-extrabold text-teal-700 text-sm">
                                ${s.nombre ? s.nombre[0] : 'A'}${s.apellidos ? s.apellidos[0] : ''}
                            </div>
                        </div>
                        <div>
                            <p class="font-bold text-slate-900 text-sm">${fullName}</p>
                            <div class="flex gap-2 text-[10px] font-bold tracking-tight mt-1">
                                <span class="bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full">${disponibles} Clases Disp.</span>
                                <span class="bg-slate-50 border border-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">Saldo: ${saldoTxt}</span>
                            </div>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-slate-300 text-xl">chevron_right</span>
                </div>
            `);
        }
    }

    if (seq !== loadActiveStudentsSeq) return;

    if (cards.length === 0) {
        container.innerHTML = `<p class="text-xs font-semibold text-slate-400 text-center py-6">No hay alumnos con mensualidad activa ${filter ? 'que coincidan' : ''}.</p>`;
    } else {
        container.innerHTML = cards.join('');
    }

    alertasMensualidadCache = alertas;
    renderNotifDrawer();
}

// Función para sanear asistencias duplicadas por el bug de doble inserción
async function sanitizeAsistenciasForPago(aluId, pagoId, maxAllowed, asistenciasAlumno) {
    if (!aluId || !pagoId || !asistenciasAlumno) return;
    const entries = Object.entries(asistenciasAlumno).filter(([, a]) => a && a.pagoId === pagoId);
    if (entries.length <= maxAllowed) return;

    // Priorizar mantener las clases tomadas
    const tomadas = entries.filter(([, a]) => a.tomada);
    const noTomadas = entries.filter(([, a]) => !a.tomada);

    // Calcular cuántas no tomadas conservar para no rebasar el límite nominal
    const cupoRestante = Math.max(0, maxAllowed - tomadas.length);
    const aConservar = noTomadas.slice(0, cupoRestante);
    const aEliminar = noTomadas.slice(cupoRestante);

    for (const [aid] of aEliminar) {
        delete asistenciasAlumno[aid];
        await safeRemove(`asistencias/${aluId}/${aid}`);
    }
}

// 1B. Alumnos con paquete activo
let loadActivePaquetesSeq = 0;

async function loadActivePaquetes(filter = '') {
    const seq = ++loadActivePaquetesSeq;

    const containers = [
        document.getElementById('active-paquetes-list'),
        document.getElementById('dashboard-paquetes-list')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const [paqSnap, asistSnap, alumnosSnap] = await Promise.all([
        safeGet('pagos_paquetes'),
        safeGet('asistencias'),
        safeGet('alumnos')
    ]);

    if (seq !== loadActivePaquetesSeq) return;

    const paquetes = paqSnap.exists() ? paqSnap.val() : {};
    const asistencias = asistSnap.exists() ? asistSnap.val() : {};
    const alumnos = alumnosSnap.exists() ? alumnosSnap.val() : {};
    const hoy = new Date();
    const alertas = [];

    // 1. Limpiar paquetes gemelos creados por el bug de safePush (id_... vs -...)
    const paqEntries = Object.entries(paquetes);
    for (const [id, p] of paqEntries) {
        if (id.startsWith('id_') && p && p.alumnoId) {
            const tieneGemelo = paqEntries.some(([otroId, otroP]) =>
                otroId !== id &&
                otroP.alumnoId === p.alumnoId &&
                otroP.fechaCreacion === p.fechaCreacion
            );
            if (tieneGemelo) {
                delete paquetes[id];
                await safeRemove(`pagos_paquetes/${id}`);
            }
        }
    }

    // 2. Sanear asistencias duplicadas en paquetes
    for (const [id, p] of Object.entries(paquetes)) {
        if (p && p.alumnoId && asistencias[p.alumnoId]) {
            const maxBase = parseInt(p.clasesBase || p.tipoPaquete || 4);
            await sanitizeAsistenciasForPago(p.alumnoId, id, maxBase, asistencias[p.alumnoId]);
        }
    }

    if (seq !== loadActivePaquetesSeq) return;

    const activos = Object.entries(paquetes).filter(([id, p]) => {
        if (new Date(p.fechaVencimiento) <= hoy) return false;
        const clases = asistencias[p.alumnoId] ? Object.values(asistencias[p.alumnoId]).filter(a => a.pagoId === id) : [];
        return clases.some(a => !a.tomada);
    });

    const cards = [];
    const processedKeys = new Set();

    activos.forEach(([id, p]) => {
        const s = alumnos[p.alumnoId];
        if (!s) return;

        // Clave única para evitar duplicación de tarjetas
        const cardKey = p.alumnoId + '_' + id;
        if (processedKeys.has(cardKey)) return;
        processedKeys.add(cardKey);

        const fullName = `${s.nombre || ''} ${s.apellidos || ''}`.trim();
        if (filter && !fullName.toLowerCase().includes(filter.toLowerCase())) return;

        const maxBase = parseInt(p.clasesBase || p.tipoPaquete || 4);
        const clases = asistencias[p.alumnoId] ? Object.values(asistencias[p.alumnoId]).filter(a => a.pagoId === id) : [];
        const disponibles = Math.min(maxBase, clases.filter(a => !a.tomada).length);
        const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

        const dias = Math.ceil((new Date(p.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24));
        if (dias <= 5) alertas.push({ nombre: fullName, dias });

        cards.push(`
            <div class="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/70 flex items-center justify-between cursor-pointer hover:border-purple-300 hover:shadow-sm active:scale-[0.99] transition-all"
                onclick="window.app.openProfile('${p.alumnoId}')">
                <div class="flex items-center gap-3.5">
                    <div class="size-11 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 shadow-xs shrink-0 flex items-center justify-center">
                        <div class="w-full h-full bg-white rounded-full flex items-center justify-center font-extrabold text-purple-700 text-sm">
                            ${s.nombre ? s.nombre[0] : 'A'}${s.apellidos ? s.apellidos[0] : ''}
                        </div>
                    </div>
                    <div>
                        <p class="font-bold text-slate-900 text-sm">${fullName}</p>
                        <div class="flex gap-2 text-[10px] font-bold tracking-tight mt-1">
                            <span class="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full">${disponibles} Clases Disp.</span>
                            <span class="bg-slate-50 border border-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">Saldo: ${saldoTxt}</span>
                        </div>
                    </div>
                </div>
                <span class="material-symbols-outlined text-slate-300 text-xl">chevron_right</span>
            </div>
        `);
    });

    if (seq !== loadActivePaquetesSeq) return;

    // Renderizado atómico en los contenedores
    containers.forEach(container => {
        if (cards.length === 0) {
            container.innerHTML = `<p class="text-xs font-semibold text-slate-400 text-center py-6">No hay paquetes activos ${filter ? 'que coincidan' : ''}.</p>`;
        } else {
            container.innerHTML = cards.join('');
        }
    });

    alertasPaqueteCache = alertas;
    renderNotifDrawer();
}

function renderNotifDrawer() {
    updateNotifDrawer(alertasMensualidadCache, alertasPaqueteCache);
}

function updateNotifDrawer(alertasMens, alertasPaq) {
    const badge = document.getElementById('notif-badge');
    const listMens = document.getElementById('notif-list-mensualidad');
    const listPaq = document.getElementById('notif-list-paquete');
    if (!badge || !listMens || !listPaq) return;

    const total = alertasMens.length + alertasPaq.length;

    if (total === 0) {
        badge.classList.add('hidden-view');
    } else {
        badge.textContent = total;
        badge.classList.remove('hidden-view');
    }

    const renderLista = (alertas) => {
        if (alertas.length === 0) {
            return `
            <div class="flex items-center gap-2 py-2 text-green-600">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                <p class="text-sm font-bold">Todo al día ✓</p>
            </div>`;
        }
        return alertas
            .sort((a, b) => a.dias - b.dias)
            .map(a => {
                const urgente = a.dias <= 2;
                return `
                <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-base ${urgente ? 'text-red-400' : 'text-orange-400'}">schedule</span>
                        <p class="text-sm font-bold text-slate-700">${a.nombre}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${urgente ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}">
                        ${a.dias === 1 ? 'Vence mañana' : `${a.dias} días`}
                    </span>
                </div>`;
            }).join('');
    };

    listMens.innerHTML = renderLista(alertasMens);
    listPaq.innerHTML = renderLista(alertasPaq);
}

window.app.toggleNotifDrawer = () => {
    const drawer = document.getElementById('notif-drawer');
    if (drawer) drawer.classList.toggle('hidden-view');
};

document.addEventListener('click', (e) => {
    const drawer = document.getElementById('notif-drawer');
    const btn = document.getElementById('notif-btn');
    if (drawer && btn && !drawer.contains(e.target) && !btn.contains(e.target)) {
        drawer.classList.add('hidden-view');
    }
});

// 2. Lista completa alumnos
function loadFullStudents(filter = '') {
    safeOnValue('alumnos', snapshot => {
        const container = document.getElementById('full-students-list');
        if (!container) return;
        container.innerHTML = '';
        if (!snapshot.exists()) return;

        Object.entries(snapshot.val()).forEach(([id, s]) => {
            if (`${s.nombre} ${s.apellidos || ''}`.toLowerCase().includes(filter.toLowerCase())) {
                const div = document.createElement('div');
                div.className = "bg-white p-3.5 rounded-2xl flex items-center justify-between border border-slate-200/70 shadow-xs hover:border-slate-300 transition-all";
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 p-0.5 shadow-xs shrink-0 flex items-center justify-center">
                            <div class="w-full h-full bg-white rounded-full flex items-center justify-center font-extrabold text-teal-700 text-xs">
                                ${s.nombre ? s.nombre[0] : 'A'}${s.apellidos ? s.apellidos[0] : ''}
                            </div>
                        </div>
                        <div><p class="font-bold text-sm text-slate-900">${s.nombre || ''} ${s.apellidos || ''}</p><p class="text-xs text-slate-400">${s.contacto || ''}</p></div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="window.app.editAlumno('${id}')" class="p-2 rounded-xl text-teal-600 hover:bg-teal-50 transition-colors material-symbols-outlined text-xl">edit_square</button>
                        <button onclick="window.app.openQuickProfile('${id}')" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors material-symbols-outlined text-xl">visibility</button>
                    </div>
                `;
                container.appendChild(div);
            }
        });
    });
}

document.getElementById('search-alumno')?.addEventListener('input', e => loadFullStudents(e.target.value));
document.getElementById('search-active-mensualidad')?.addEventListener('input', e => loadActiveStudents(e.target.value));
document.getElementById('search-active-paquete')?.addEventListener('input', e => loadActivePaquetes(e.target.value));

// --- EDITAR ALUMNO ---
window.app.editAlumno = async (id) => {
    const snap = await safeGet(`alumnos/${id}`);
    const s = snap.val();
    if (!s) return alert('Alumno no encontrado');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-name').value = s.nombre || '';
    document.getElementById('edit-lastname').value = s.apellidos || '';
    document.getElementById('edit-contact').value = s.contacto || '';
    document.getElementById('edit-tutor-name').value = s.tutor?.nombre || '';
    document.getElementById('edit-tutor-phone').value = s.tutor?.telefono || '';
    document.getElementById('edit-avatar').textContent = `${s.nombre ? s.nombre[0] : 'A'}${s.apellidos ? s.apellidos[0] : ''}`;
    window.app.showModal('modal-edit-alumno');
};

document.getElementById('edit-student-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const upd = {
        nombre: document.getElementById('edit-name').value,
        apellidos: document.getElementById('edit-lastname').value,
        contacto: document.getElementById('edit-contact').value,
        tutor: {
            nombre: document.getElementById('edit-tutor-name').value,
            telefono: document.getElementById('edit-tutor-phone').value
        }
    };
    await safeUpdate(`alumnos/${id}`, upd);
    alert("Cambios guardados");
    window.app.hideModal('modal-edit-alumno');
    refreshData();
});

// --- PERFIL ---
async function openProfile(aluId) {
    const [alumnoSnap, pagosASnap, pagosPSnap, asistSnap] = await Promise.all([
        safeGet(`alumnos/${aluId}`),
        safeGet('pagos_tipo_a'),
        safeGet('pagos_paquetes'),
        safeGet(`asistencias/${aluId}`)
    ]);

    const s = alumnoSnap.val();
    if (!s) return alert('Alumno no encontrado');

    const pagosA = pagosASnap.exists() ? pagosASnap.val() : {};
    const pagosP = pagosPSnap.exists() ? pagosPSnap.val() : {};
    const todasAsistencias = asistSnap.exists() ? asistSnap.val() : {};
    const hoy = new Date();

    // Limpiar paquetes gemelos creados por el bug de safePush (id_... vs -...)
    const paqEntries = Object.entries(pagosP);
    for (const [id, p] of paqEntries) {
        if (id.startsWith('id_') && p && p.alumnoId === aluId) {
            const tieneGemelo = paqEntries.some(([otroId, otroP]) =>
                otroId !== id &&
                otroP.alumnoId === aluId &&
                otroP.fechaCreacion === p.fechaCreacion
            );
            if (tieneGemelo) {
                delete pagosP[id];
                await safeRemove(`pagos_paquetes/${id}`);
            }
        }
    }

    // Sanear posibles asistencias duplicadas del alumno
    for (const [id, p] of Object.entries(pagosP)) {
        if (p.alumnoId === aluId) {
            const maxBase = parseInt(p.clasesBase || p.tipoPaquete || 4);
            await sanitizeAsistenciasForPago(aluId, id, maxBase, todasAsistencias);
        }
    }
    for (const [id, m] of Object.entries(pagosA)) {
        if (m.alumnoId === aluId) {
            const maxBase = parseInt((m.clasesBase || 4) + (m.clasesExtra || 0));
            await sanitizeAsistenciasForPago(aluId, id, maxBase, todasAsistencias);
        }
    }

    const mensEntry = Object.entries(pagosA).find(([id, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy);
    const mKey = mensEntry ? mensEntry[0] : null;
    const mData = mensEntry ? mensEntry[1] : null;

    const paqActivos = Object.entries(pagosP).filter(([id, p]) => {
        if (p.alumnoId !== aluId || new Date(p.fechaVencimiento) <= hoy) return false;
        const clases = Object.values(todasAsistencias).filter(a => a.pagoId === id);
        return clases.some(a => !a.tomada);
    });

    window.app.changeView('profile-view');
    const container = document.getElementById('profile-content');
    if (!container) return;

    // Historial completo de pagos (mensualidades y paquetes: activos, completados y vencidos)
    const historialA = Object.entries(pagosA)
        .filter(([, p]) => p.alumnoId === aluId)
        .map(([k, p]) => ({ id: k, data: p, tipo: 'Mensualidad', tipoKey: 'A' }));

    const historialP = Object.entries(pagosP)
        .filter(([, p]) => p.alumnoId === aluId)
        .map(([k, p]) => ({
            id: k,
            data: p,
            tipo: `Paquete (${p.tipoPaquete || p.clasesBase || 4} Clases)`,
            tipoKey: 'P'
        }));

    const historial = [...historialA, ...historialP]
        .sort((a, b) => {
            const fechaA = new Date(a.data.fechaCreacion || a.data.fecha || a.data.fechaVencimiento || 0);
            const fechaB = new Date(b.data.fechaCreacion || b.data.fecha || b.data.fechaVencimiento || 0);
            return fechaB - fechaA;
        });

    const renderBloquePlan = (key, data, tipoLabel) => {
        if (!key || !data) return '';
        const vencimiento = new Date(data.fechaVencimiento);
        const dias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
        const diasTxt = dias <= 0 ? 'Vencido' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
        const badgeClass = dias <= 0 ? "bg-red-50 text-red-600" : (dias <= 5 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600");

        const clasesPlan = Object.entries(todasAsistencias).filter(([aid, a]) => a.pagoId === key);
        const totalBase = parseInt(data.clasesBase || data.tipoPaquete || 4);

        const filasClases = clasesPlan.map(([aid, a], i) => {
            const esUltimaBase = i === (totalBase - 1);
            const bloqueadaPorFaltante = esUltimaBase && data.faltante > 0;
            const vencida = !a.tomada && vencimiento < hoy;
            const bloqueada = bloqueadaPorFaltante || vencida;

            let statusClass = 'bg-blue-50 text-blue-600';
            let statusTxt = 'Marcar';
            let subtitulo = 'Pendiente';

            if (a.tomada) {
                statusClass = 'bg-green-500 text-white';
                statusTxt = 'Tomada ✓';
                subtitulo = `Tomada ✓ - ${new Date(a.fechaTomada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;
            } else if (vencida) {
                statusClass = 'bg-gray-100 text-gray-400';
                statusTxt = 'Vencida';
                subtitulo = 'No se tomó a tiempo';
            } else if (bloqueadaPorFaltante) {
                statusClass = 'bg-gray-100 text-gray-400';
                statusTxt = 'Bloqueada ($)';
            }

            return `
                <div class="flex items-center justify-between border-b border-gray-50 pb-3">
                    <div>
                        <p class="font-bold text-sm">Clase ${i + 1} ${i < totalBase ? '(Base)' : '(Extra)'}</p>
                        <p class="text-[10px] text-gray-400">${subtitulo}</p>
                    </div>
                    <button
                        ${(!a.tomada && !bloqueada) ? `onclick="window.app.checkIn('${aluId}', '${aid}')"` : ''}
                        class="px-4 py-2 rounded-lg text-xs font-bold ${statusClass}">
                        ${statusTxt}
                    </button>
                </div>`;
        }).join('');

        return `
        <div class="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/70 mb-4">
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-extrabold text-slate-900 text-sm">${tipoLabel}</h3>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${badgeClass}">${diasTxt}</span>
            </div>
            <p class="text-xs text-slate-400 mb-4">ID: <span class="font-mono text-slate-600">#${key.slice(-6)}</span> · Faltante: ${data.faltante > 0 ? `<span class="text-rose-600 font-bold">$${data.faltante}</span>` : `<span class="text-emerald-600 font-bold">Pagado ✓</span>`}</p>
            <div class="space-y-3">${filasClases}</div>
        </div>`;
    };

    const bloquesActivosHtml = [
        mKey ? renderBloquePlan(mKey, mData, 'Mensualidad Activa') : '',
        ...paqActivos.map(([id, data], i) => renderBloquePlan(id, data, paqActivos.length > 1 ? `Paquete Activo #${i + 1} (${data.tipoPaquete || data.clasesBase || 4} Clases)` : 'Paquete Activo'))
    ].filter(Boolean).join('');

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/70 flex flex-col items-center text-center mb-4">
            <div class="size-20 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 p-1 shadow-md mb-3 flex items-center justify-center">
                <div class="w-full h-full bg-white rounded-full flex items-center justify-center text-teal-700 text-3xl font-extrabold">
                    ${s.nombre ? s.nombre[0] : 'A'}${s.apellidos ? s.apellidos[0] : ''}
                </div>
            </div>
            <h2 class="text-lg font-extrabold text-slate-900">${s.nombre || ''} ${s.apellidos || ''}</h2>
            <p class="text-xs text-slate-400 mb-4">${(!mKey && paqActivos.length === 0) ? 'Sin plan activo' : ''}</p>
            <div class="flex gap-3 w-full">
                <a href="tel:${s.contacto || '#'}" class="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-center font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-base">call</span>
                    <span>Llamar</span>
                </a>
                <button class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-base">chat</span>
                    <span>Mensaje</span>
                </button>
            </div>
        </div>

        ${bloquesActivosHtml}

        <div class="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/70">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Historial de Pagos</h3>
                <span class="text-[10px] font-bold text-slate-400">${historial.length} registro${historial.length !== 1 ? 's' : ''}</span>
            </div>
            ${historial.length === 0 ? '<p class="text-sm text-gray-500">No hay pagos registrados.</p>' : `
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="border-b border-gray-100">
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">ID</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">Concepto</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">Fecha Pago</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">Monto / Saldo</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">Clases</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-2">Estado</th>
                            <th class="text-left text-gray-400 font-bold pb-2">Vence</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        ${historial.map(h => {
                            const clasesPlan = Object.values(todasAsistencias).filter(a => a.pagoId === h.id);
                            const totalBase = parseInt(h.data.clasesBase || h.data.tipoPaquete || 4);
                            const totalClases = h.tipoKey === 'A' ? (totalBase + parseInt(h.data.clasesExtra || 0)) : totalBase;
                            const clasesTomadas = clasesPlan.filter(a => a.tomada).length;
                            const esVencido = new Date(h.data.fechaVencimiento) <= hoy;
                            const esCompleto = clasesTomadas >= totalClases;

                            let estadoBadge = '';
                            if (esVencido) {
                                estadoBadge = '<span class="bg-rose-50 text-rose-600 font-extrabold px-2 py-0.5 rounded-full text-[10px]">Vencido</span>';
                            } else if (esCompleto) {
                                estadoBadge = '<span class="bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-full text-[10px]">Agotado ✓</span>';
                            } else {
                                estadoBadge = '<span class="bg-purple-50 text-purple-700 font-extrabold px-2 py-0.5 rounded-full text-[10px]">Activo</span>';
                            }

                            const fechaPagoTxt = h.data.fechaCreacion
                                ? new Date(h.data.fechaCreacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                : (h.data.fecha ? new Date(h.data.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
                            const fechaVenceTxt = h.data.fechaVencimiento
                                ? new Date(h.data.fechaVencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '-';

                            const saldoTxt = h.data.faltante > 0
                                ? `<span class="font-bold text-slate-700">$${h.data.monto}</span> <span class="text-rose-500 font-bold block text-[10px]">Debe $${h.data.faltante}</span>`
                                : `<span class="font-bold text-slate-700">$${h.data.monto}</span> <span class="text-emerald-600 font-bold block text-[10px]">Pagado ✓</span>`;

                            return `
                            <tr>
                                <td class="py-2.5 pr-2 font-mono text-gray-500">#${h.id.slice(-6)}</td>
                                <td class="py-2.5 pr-2 font-medium text-slate-800">${h.tipo}</td>
                                <td class="py-2.5 pr-2 text-slate-500">${fechaPagoTxt}</td>
                                <td class="py-2.5 pr-2">${saldoTxt}</td>
                                <td class="py-2.5 pr-2">
                                    <span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full text-[11px]">${clasesTomadas}/${totalClases}</span>
                                </td>
                                <td class="py-2.5 pr-2">${estadoBadge}</td>
                                <td class="py-2.5 text-gray-400">${fechaVenceTxt}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    `;
}

window.app.openProfile = async (id) => openProfile(id);
window.app.openQuickProfile = async (id) => openProfile(id);

window.app.checkIn = async (aluId, aid) => {
    await safeUpdate(`asistencias/${aluId}/${aid}`, { tomada: true, fechaTomada: new Date().toISOString() });
    alert("Asistencia marcada");
    window.app.changeView('dashboard-view');
    refreshData();
};

// --- FINANZAS ---
function initFinanzasFilters() {
    const mesSel = document.getElementById('finanzas-mes');
    const anioSel = document.getElementById('finanzas-anio');
    if (!mesSel || !anioSel) return;

    if (mesSel.dataset.initialized) return;
    mesSel.dataset.initialized = 'true';

    mesSel.innerHTML = '';
    anioSel.innerHTML = '';

    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const hoy = new Date();

    meses.forEach((m, i) => {
        const opt = new Option(m, i);
        if (i === hoy.getMonth()) opt.selected = true;
        mesSel.add(opt);
    });

    for (let a = hoy.getFullYear(); a >= 2024; a--) {
        const opt = new Option(a, a);
        anioSel.add(opt);
    }

    [mesSel, anioSel].forEach(el => el.addEventListener('change', () => {
        cargarFinanzas(mesSel.value, anioSel.value);
    }));
}

async function cargarFinanzas(mes, anio) {
    const mesNum  = parseInt(mes);
    const anioNum = parseInt(anio);

    const elIngresos = document.getElementById('total-ingresos');
    const elDeuda = document.getElementById('total-deuda');
    const elResMens = document.getElementById('res-mensualidades');
    const elResExtra = document.getElementById('res-clases-extra');
    const elResPaq = document.getElementById('res-paquetes');
    const elResB = document.getElementById('res-tipo-b');
    const elHistorial = document.getElementById('lista-historial-finanzas');

    if (elIngresos) elIngresos.textContent = '...';
    if (elDeuda) elDeuda.textContent = '...';
    if (elResMens) elResMens.textContent = '...';
    if (elResExtra) elResExtra.textContent = '...';
    if (elResPaq) elResPaq.textContent = '...';
    if (elResB) elResB.textContent = '...';
    if (elHistorial) elHistorial.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Cargando...</p>';

    const [pagosASnap, pagosPSnap, pagosBSnap, asistSnap, alumnosSnap] = await Promise.all([
        safeGet('pagos_tipo_a'),
        safeGet('pagos_paquetes'),
        safeGet('pagos_tipo_b'),
        safeGet('asistencias'),
        safeGet('alumnos')
    ]);

    const pagosA    = pagosASnap.exists()   ? pagosASnap.val()   : {};
    const pagosP    = pagosPSnap.exists()   ? pagosPSnap.val()   : {};
    const pagosB    = pagosBSnap.exists()   ? pagosBSnap.val()   : {};
    const asistAll  = asistSnap.exists()    ? asistSnap.val()    : {};
    const alumnos   = alumnosSnap.exists()  ? alumnosSnap.val()  : {};

    const esMismoMes = (fechaISO) => {
        if (!fechaISO) return false;
        const d = new Date(fechaISO);
        return d.getMonth() === mesNum && d.getFullYear() === anioNum;
    };

    const fmt = (n) => '$' + parseFloat(n || 0).toFixed(2);

    const idsA = Object.entries(pagosA)
        .filter(([, p]) => esMismoMes(p.fechaCreacion || p.fechaVencimiento))
        .map(([id, p]) => {
            const alu = alumnos[p.alumnoId] || {};
            const asistAlumno = asistAll[p.alumnoId]
                ? Object.values(asistAll[p.alumnoId]).filter(a => a.pagoId === id)
                : [];
            const clasesTomadas  = asistAlumno.filter(a => a.tomada).length;
            const clasesTotal    = asistAlumno.length;
            const monto          = parseFloat(p.monto   || 0);
            const faltante       = parseFloat(p.faltante || 0);
            const ingreso        = monto - faltante;

            return {
                id, tipo: 'A',
                alumnoNombre: `${alu.nombre || ''} ${alu.apellidos || ''}`.trim(),
                alumnoId: p.alumnoId,
                monto, faltante, ingreso,
                clasesTomadas, clasesTotal,
                clasesBase:  p.clasesBase  || 0,
                clasesExtra: p.clasesExtra || 0,
                fechaVencimiento: p.fechaVencimiento,
                fechaCreacion:    p.fechaCreacion,
                medioPago:    p.medioPago   || '-',
                observaciones: p.observaciones || '',
                concepto: p.concepto || 'mensualidad',
                raw: p
            };
        });

    const idsP = Object.entries(pagosP)
        .filter(([, p]) => esMismoMes(p.fechaCreacion || p.fechaVencimiento))
        .map(([id, p]) => {
            const alu = alumnos[p.alumnoId] || {};
            const asistAlumno = asistAll[p.alumnoId]
                ? Object.values(asistAll[p.alumnoId]).filter(a => a.pagoId === id)
                : [];
            const clasesTomadas = asistAlumno.filter(a => a.tomada).length;
            const clasesTotal   = asistAlumno.length;
            const monto         = parseFloat(p.monto    || 0);
            const faltante      = parseFloat(p.faltante || 0);
            const ingreso       = monto - faltante;

            return {
                id, tipo: 'P',
                alumnoNombre: `${alu.nombre || ''} ${alu.apellidos || ''}`.trim(),
                alumnoId: p.alumnoId,
                monto, faltante, ingreso,
                clasesTomadas, clasesTotal,
                clasesBase: p.clasesBase || p.tipoPaquete || 0,
                fechaVencimiento: p.fechaVencimiento,
                fechaCreacion: p.fechaCreacion,
                medioPago: p.medioPago || '-',
                observaciones: p.observaciones || '',
                concepto: 'paquete_clases',
                raw: p
            };
        });

    const extraerUltimoAbonoFecha = (p) => {
        if (!p.observaciones) return p.fecha || null;
        const regex = /\[Abono:.*?-\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/g;
        let match, ultimaFecha = null;
        while ((match = regex.exec(p.observaciones)) !== null) {
            const partes = match[1].split('/');
            const d = new Date(`${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`);
            if (!ultimaFecha || d > ultimaFecha) ultimaFecha = d;
        }
        if (!ultimaFecha && p.fecha) ultimaFecha = new Date(p.fecha);
        return ultimaFecha;
    };

    const idsB = Object.entries(pagosB)
        .filter(([, p]) => {
            const ultima = extraerUltimoAbonoFecha(p);
            if (!ultima) return false;
            return ultima.getMonth() === mesNum && ultima.getFullYear() === anioNum;
        })
        .map(([id, p]) => {
            const ultima   = extraerUltimoAbonoFecha(p);
            const monto    = parseFloat(p.monto    || 0);
            const faltante = parseFloat(p.faltante || 0);
            const ingreso  = monto - faltante;
            return {
                id, tipo: 'B',
                descripcion:   p.descripcion   || 'Actividad Extra',
                monto, faltante, ingreso,
                medioPago:     p.medioPago     || '-',
                observaciones: p.observaciones || '',
                fechaUltimoMovimiento: ultima ? ultima.toISOString() : null,
                fechaCreacion: p.fecha || null,
                raw: p
            };
        });

    const todosIds = [...idsA, ...idsP, ...idsB];

    let totalIngresos      = 0;
    let totalDeuda         = 0;
    let totalMensualidades = 0;
    let totalClasesExtra   = 0;
    let totalPaquetes      = 0;
    let totalTipoB         = 0;

    idsA.forEach(r => {
        totalIngresos += r.ingreso;
        totalDeuda    += r.faltante;
        if ((r.clasesExtra || 0) > 0 && r.observaciones.includes('[+')) {
            const precioPorClase = r.clasesTotal > 0 ? r.monto / r.clasesTotal : 0;
            const montoExtra     = precioPorClase * r.clasesExtra;
            totalClasesExtra    += montoExtra - (montoExtra * (r.faltante / r.monto));
            totalMensualidades  += r.ingreso - (montoExtra - (montoExtra * (r.faltante / r.monto)));
        } else {
            totalMensualidades += r.ingreso;
        }
    });

    idsP.forEach(r => {
        totalIngresos += r.ingreso;
        totalDeuda    += r.faltante;
        totalPaquetes += r.ingreso;
    });

    idsB.forEach(r => {
        totalIngresos += r.ingreso;
        totalDeuda    += r.faltante;
        totalTipoB    += r.ingreso;
    });

    if (elIngresos) elIngresos.textContent = fmt(totalIngresos);
    if (elDeuda) elDeuda.textContent = fmt(totalDeuda);
    if (elResMens) elResMens.textContent = fmt(totalMensualidades);
    if (elResExtra) elResExtra.textContent = fmt(totalClasesExtra);
    if (elResPaq) elResPaq.textContent = fmt(totalPaquetes);
    if (elResB) elResB.textContent = fmt(totalTipoB);

    if (elHistorial) {
        if (todosIds.length === 0) {
            elHistorial.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">No hay registros cerrados en este período.</p>';
            return;
        }

        const filas = todosIds.map(r => {
            const badgeTipo = r.tipo === 'A'
                ? `<span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Mensualidad</span>`
                : r.tipo === 'P'
                ? `<span class="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Paquete</span>`
                : `<span class="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Actividad B</span>`;

            const badgeFaltante = r.faltante > 0
                ? `<span class="text-red-500 font-bold">${fmt(r.faltante)}</span>`
                : `<span class="text-green-600 font-bold">Liquidado ✓</span>`;

            const esDetallable = (r.tipo === 'A' || r.tipo === 'P');
            const clickAttr = esDetallable
                ? `onclick="window.app.abrirDetalleFinanzas('${r.id}', '${r.tipo}')" style="cursor:pointer"`
                : '';

            const chevron = esDetallable
                ? `<span class="material-symbols-outlined text-gray-300 text-base">chevron_right</span>`
                : `<span class="w-5"></span>`;

            const nombre = esDetallable
                ? `<p class="font-bold text-sm text-slate-800">${r.alumnoNombre || 'Sin nombre'}</p>`
                : `<p class="font-bold text-sm text-slate-800">${r.descripcion}</p>`;

            const obs = r.observaciones
                ? `<p class="text-[10px] text-gray-400 mt-0.5 line-clamp-1">${r.observaciones.replace(/\n/g, ' · ')}</p>`
                : '';

            return `
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3" ${clickAttr}>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            ${badgeTipo}
                            <span class="font-mono text-[10px] text-gray-400">#${r.id.slice(-6)}</span>
                        </div>
                        ${nombre}
                        <div class="flex gap-3 mt-1 flex-wrap">
                            <span class="text-xs text-gray-500">Monto: <span class="font-bold text-slate-700">${fmt(r.monto)}</span></span>
                            <span class="text-xs text-gray-500">Faltante: ${badgeFaltante}</span>
                        </div>
                        ${obs}
                    </div>
                    ${chevron}
                </div>`;
        }).join('');

        elHistorial.innerHTML = filas;
    }
}

window.app.abrirDetalleFinanzas = async (pagoId, tipo = 'A') => {
    const nodo = tipo === 'P' ? 'pagos_paquetes' : 'pagos_tipo_a';

    const [pagosSnap, alumnosSnap, asistSnap] = await Promise.all([
        safeGet(nodo),
        safeGet('alumnos'),
        safeGet('asistencias')
    ]);

    const pagos    = pagosSnap.val()   || {};
    const alumnos  = alumnosSnap.val() || {};
    const asistAll = asistSnap.val()   || {};

    const pData = pagos[pagoId];
    if (!pData) return alert('No se encontró el registro.');

    const alu    = alumnos[pData.alumnoId] || {};
    const nombre = `${alu.nombre || ''} ${alu.apellidos || ''}`.trim() || 'Sin nombre';

    const asistAlumno = asistAll[pData.alumnoId]
        ? Object.entries(asistAll[pData.alumnoId]).filter(([, a]) => a.pagoId === pagoId)
        : [];

    const clasesBase  = pData.clasesBase  || 0;
    const clasesExtra = pData.clasesExtra || 0;
    const totalClases = clasesBase + clasesExtra;
    const tomadas     = asistAlumno.filter(([, a]) => a.tomada).length;

    const fmtFecha = (iso) => iso
        ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-';

    const filasClases = asistAlumno.map(([, a], i) => {
        const esTipo = i < clasesBase ? 'Base' : 'Extra';
        const estado = a.tomada
            ? `<span class="text-green-600 font-bold text-xs">Tomada ✓ ${fmtFecha(a.fechaTomada)}</span>`
            : `<span class="text-gray-400 text-xs">Pendiente</span>`;
        return `
            <tr class="border-b border-gray-50">
                <td class="py-2 text-xs text-gray-500">Clase ${i + 1}</td>
                <td class="py-2"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${i < clasesBase ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}">${esTipo}</span></td>
                <td class="py-2">${estado}</td>
            </tr>`;
    }).join('');

    const modal = document.getElementById('modal-detalle-finanzas');
    if (modal) {
        document.getElementById('detalle-fin-nombre').textContent    = nombre;
        document.getElementById('detalle-fin-id').textContent        = (tipo === 'P' ? 'Paquete #' : '#') + pagoId.slice(-6);
        document.getElementById('detalle-fin-monto').textContent     = '$' + parseFloat(pData.monto || 0).toFixed(2);
        document.getElementById('detalle-fin-faltante').textContent  = '$' + parseFloat(pData.faltante || 0).toFixed(2);
        document.getElementById('detalle-fin-vencio').textContent    = fmtFecha(pData.fechaVencimiento);
        document.getElementById('detalle-fin-creado').textContent    = fmtFecha(pData.fechaCreacion);
        document.getElementById('detalle-fin-medio').textContent     = pData.medioPago || '-';
        document.getElementById('detalle-fin-clases-resumen').textContent = tipo === 'P'
            ? `${tomadas} de ${totalClases} (paquete de ${clasesBase} clases)`
            : `${tomadas} de ${totalClases} (${clasesBase} base + ${clasesExtra} extra)`;
        document.getElementById('detalle-fin-obs').textContent       = pData.observaciones || 'Sin observaciones';
        document.getElementById('detalle-fin-tabla-clases').innerHTML = filasClases;

        modal.classList.remove('hidden-view');
    }
};

// --- PAGOS ---
function resetPagoForm() {
    const form = document.getElementById('register-pago-form');
    if (form) form.reset();

    const aluInput = document.getElementById('pago-alumno-id');
    if (aluInput) aluInput.value = '';
    document.getElementById('pago-id-container')?.classList.add('hidden-view');
    document.getElementById('extra-classes-container')?.classList.add('hidden-view');
    document.getElementById('tipo-b-logic')?.classList.add('hidden-view');
    document.getElementById('seccion-alumno-pago')?.classList.remove('hidden-view');
    const faltante = document.getElementById('faltante');
    if (faltante) faltante.disabled = false;
    document.getElementById('select-id-b')?.classList.add('hidden-view');
    const sugg = document.getElementById('pago-alumno-suggestions');
    if (sugg) sugg.innerHTML = '';
    document.getElementById('plan-clases-container')?.classList.add('hidden-view');

    const selId = document.getElementById('pago-id-select');
    if (selId) selId.innerHTML = '<option value="">Seleccionar ID...</option>';
}

document.getElementById('concepto')?.addEventListener('change', async (e) => {
    const concepto = e.target.value;
    const planContainer = document.getElementById('plan-clases-container');
    const aluId = document.getElementById('pago-alumno-id')?.value;
    const pIdContainer = document.getElementById('pago-id-container');
    const extraContainer = document.getElementById('extra-classes-container');
    const selId = document.getElementById('pago-id-select');
    const seccionAlumno = document.getElementById('seccion-alumno-pago');
    const tipoBLogic = document.getElementById('tipo-b-logic');

    if (pIdContainer) pIdContainer.classList.add('hidden-view');
    if (extraContainer) extraContainer.classList.add('hidden-view');
    if (tipoBLogic) tipoBLogic.classList.add('hidden-view');
    if (seccionAlumno) seccionAlumno.classList.remove('hidden-view');
    if (selId) selId.innerHTML = '<option value="">Seleccionar ID...</option>';

    if (concepto === 'mensualidad' || concepto === 'paquete_clases') {
        if (planContainer) planContainer.classList.remove('hidden-view');
    } else {
        if (planContainer) planContainer.classList.add('hidden-view');
    }

    if (concepto === 'actividad_b') {
        if (seccionAlumno) seccionAlumno.classList.add('hidden-view');
        if (tipoBLogic) tipoBLogic.classList.remove('hidden-view');
        return;
    }

    if (!aluId) return;

    const hoy = new Date();

    if (concepto === 'mensualidad') {
        const snap = await safeGet('pagos_tipo_a');
        let pagoActivoEncontrado = null;
        if (snap.exists()) {
            const pagos = snap.val();
            pagoActivoEncontrado = Object.entries(pagos).find(([id, p]) =>
                p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy
            );
        }
        if (pagoActivoEncontrado) {
            alert('Este alumno ya tiene una mensualidad activa.');
            e.target.value = '';
        }
        return;
    }

    if (concepto === 'paquete_clases') {
        const [snapA, snapP, snapAsist] = await Promise.all([
            safeGet('pagos_tipo_a'),
            safeGet('pagos_paquetes'),
            safeGet(`asistencias/${aluId}`)
        ]);
        const pagosA = snapA.exists() ? snapA.val() : {};
        const pagosP = snapP.exists() ? snapP.val() : {};
        const asistAlu = snapAsist.exists() ? snapAsist.val() : {};

        const paqueteActivoId = Object.keys(pagosP).find(id => {
            const p = pagosP[id];
            if (p.alumnoId !== aluId || new Date(p.fechaVencimiento) <= hoy) return false;
            const clases = Object.values(asistAlu).filter(a => a.pagoId === id);
            return clases.some(a => !a.tomada);
        });
        if (paqueteActivoId) {
            alert('Este alumno ya tiene un paquete activo con clases pendientes.');
            e.target.value = '';
            return;
        }

        const mensActivaId = Object.keys(pagosA).find(id => pagosA[id].alumnoId === aluId && new Date(pagosA[id].fechaVencimiento) > hoy);
        if (mensActivaId) {
            const clasesMens = Object.values(asistAlu).filter(a => a.pagoId === mensActivaId);
            if (clasesMens.some(a => !a.tomada)) {
                alert('Este alumno tiene una mensualidad activa con clases pendientes. Debe agotarlas, o esperar a que venza, antes de comprar un paquete.');
                e.target.value = '';
            }
        }
        return;
    }

    if (concepto === 'pago_parcial') {
        const [snapA, snapP] = await Promise.all([
            safeGet('pagos_tipo_a'),
            safeGet('pagos_paquetes')
        ]);
        const pagosA = snapA.exists() ? snapA.val() : {};
        const pagosP = snapP.exists() ? snapP.val() : {};

        const activoA = Object.entries(pagosA).find(([id, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy && parseFloat(p.faltante || 0) > 0);
        const activoP = Object.entries(pagosP).find(([id, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy && parseFloat(p.faltante || 0) > 0);

        const opciones = [];
        if (activoA) opciones.push({ value: `mensualidad:${activoA[0]}`, label: `Mensualidad #${activoA[0].slice(-6)} — Debe $${activoA[1].faltante}` });
        if (activoP) opciones.push({ value: `paquete:${activoP[0]}`, label: `Paquete #${activoP[0].slice(-6)} — Debe $${activoP[1].faltante}` });

        if (opciones.length === 0) {
            alert('No se encontró ningún pago activo con saldo pendiente.');
            e.target.value = '';
            return;
        }

        if (selId) selId.innerHTML = opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        if (selId && opciones.length === 1) selId.value = opciones[0].value;
        if (pIdContainer) pIdContainer.classList.remove('hidden-view');
        return;
    }

    if (concepto === 'clases_extra') {
        const snap = await safeGet('pagos_tipo_a');
        if (!snap.exists()) {
            alert('No se encontró mensualidad activa.');
            e.target.value = '';
            return;
        }
        const pagos = snap.val();
        const pagoActivoEncontrado = Object.entries(pagos).find(([id, p]) =>
            p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy
        );
        if (!pagoActivoEncontrado) {
            alert('No se encontró mensualidad activa.');
            e.target.value = '';
            return;
        }
        const [id, p] = pagoActivoEncontrado;
        const faltante = parseFloat(p.faltante || 0);
        if (faltante <= 0) {
            if (selId) selId.innerHTML = `<option value="mensualidad:${id}" selected>ID: ${id.slice(-6)} (Pagado ✓)</option>`;
            if (pIdContainer) pIdContainer.classList.remove('hidden-view');
            if (extraContainer) extraContainer.classList.remove('hidden-view');
        } else {
            alert('Debe liquidar el faltante antes de añadir clases extra.');
            e.target.value = '';
        }
    }
});

document.getElementById('es-abono-b')?.addEventListener('change', (e) => {
    const isAbono = e.target.checked;
    const searchCont = document.getElementById('search-b-container');
    const faltanteInput = document.getElementById('faltante');

    if (isAbono) {
        if (searchCont) searchCont.classList.remove('hidden-view');
        if (faltanteInput) {
            faltanteInput.value = '0';
            faltanteInput.disabled = true;
        }
    } else {
        if (searchCont) searchCont.classList.add('hidden-view');
        if (faltanteInput) {
            faltanteInput.disabled = false;
            faltanteInput.value = '';
        }
    }
});

document.getElementById('search-id-b')?.addEventListener('input', async (e) => {
    const val = e.target.value;
    if (val.length === 5) {
        const snap = await safeGet('pagos_tipo_b');
        const select = document.getElementById('select-id-b');
        if (select) select.innerHTML = '<option value="">Selecciona el ID...</option>';

        if (snap.exists()) {
            const found = Object.entries(snap.val()).filter(([id, data]) =>
                id.includes(val) && parseFloat(data.faltante || 0) > 0
            );

            if (found.length > 0 && select) {
                select.classList.remove('hidden-view');
                found.forEach(([id, data]) => {
                    select.innerHTML += `<option value="${id}">${id} (Debe: $${data.faltante})</option>`;
                });
            } else {
                alert("No se encontró el folio o ya no tiene deuda.");
            }
        }
    }
});

// Búsqueda de alumnos (chips)
document.getElementById('pago-alumno-search')?.addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase();
    const container = document.getElementById('pago-alumno-suggestions');
    const hiddenInput = document.getElementById('pago-alumno-id');

    if (term.length < 2) {
        if (container) container.innerHTML = '';
        if (hiddenInput) hiddenInput.value = '';
        return;
    }

    const snap = await safeGet('alumnos');
    if (snap.exists() && container) {
        const alumnos = snap.val();
        const filtrados = Object.entries(alumnos).filter(([id, data]) =>
            `${data.nombre || ''} ${data.apellidos || ''}`.toLowerCase().includes(term)
        );

        container.innerHTML = filtrados.map(([id, data]) => `
            <button type="button"
                onclick="seleccionarAlumno('${id}', '${data.nombre || ''} ${data.apellidos || ''}')"
                class="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-colors">
                ${data.nombre || ''} ${data.apellidos || ''}
            </button>
        `).join('');
    }
});

window.seleccionarAlumno = (id, nombreCompleto) => {
    const searchInput = document.getElementById('pago-alumno-search');
    const hiddenInput = document.getElementById('pago-alumno-id');
    const container = document.getElementById('pago-alumno-suggestions');

    if (hiddenInput) hiddenInput.value = id;
    if (searchInput) searchInput.value = nombreCompleto;
    if (container) container.innerHTML = '';
    document.getElementById('concepto')?.dispatchEvent(new Event('change'));
};

// Registro de pago
document.getElementById('register-pago-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const c = document.getElementById('concepto')?.value;
    const monto = parseFloat(document.getElementById('monto')?.value || '0');
    const faltante = parseFloat(document.getElementById('faltante')?.value || '0');
    const medio = document.getElementById('medio-pago')?.value || '';
    const observaciones = document.getElementById('observaciones')?.value || '';

    let alu = null;
    if (c !== 'actividad_b') {
        alu = document.getElementById('pago-alumno-id')?.value;
        if (!alu) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            return alert('Selecciona un alumno antes de continuar.');
        }
    }

    try {
        const hoy = new Date();

        if (c === 'mensualidad') {
            // Validar que no tenga mensualidad activa
            const snapA = await safeGet('pagos_tipo_a');
            if (snapA.exists()) {
                const pagos = snapA.val();
                const tieneMensActiva = Object.values(pagos).some(p => p.alumnoId === alu && new Date(p.fechaVencimiento) > hoy);
                if (tieneMensActiva) {
                    return alert('Este alumno ya tiene una mensualidad activa.');
                }
            }

            const fv = new Date();
            fv.setDate(fv.getDate() + 30);
            const numClasesBase = parseInt(document.getElementById('plan-clases')?.value || '4');

            const pRef = await safePush('pagos_tipo_a', {
                alumnoId: alu,
                monto,
                faltante,
                concepto: c,
                fechaCreacion: new Date().toISOString(),
                fechaVencimiento: fv.toISOString(),
                clasesBase: numClasesBase,
                clasesExtra: 0,
                medioPago: medio,
                observaciones
            });

            for (let i = 0; i < numClasesBase; i++) {
                await safePush(`asistencias/${alu}`, {
                    pagoId: pRef.key,
                    tomada: false,
                    tipo: 'base',
                    origenPago: 'mensualidad'
                });
            }
        } else if (c === 'paquete_clases') {
            // Validar que no tenga paquete activo con clases pendientes
            const [snapA, snapP, snapAsist] = await Promise.all([
                safeGet('pagos_tipo_a'),
                safeGet('pagos_paquetes'),
                safeGet(`asistencias/${alu}`)
            ]);
            const asistAlu = snapAsist.exists() ? snapAsist.val() : {};

            if (snapP.exists()) {
                const pagosP = snapP.val();
                const tienePaqActivo = Object.entries(pagosP).some(([id, p]) => {
                    if (p.alumnoId !== alu || new Date(p.fechaVencimiento) <= hoy) return false;
                    const clases = Object.values(asistAlu).filter(a => a.pagoId === id);
                    return clases.some(a => !a.tomada);
                });
                if (tienePaqActivo) {
                    return alert('Este alumno ya tiene un paquete activo con clases pendientes.');
                }
            }

            if (snapA.exists()) {
                const pagosA = snapA.val();
                const tieneMensPendiente = Object.entries(pagosA).some(([id, p]) => {
                    if (p.alumnoId !== alu || new Date(p.fechaVencimiento) <= hoy) return false;
                    const clases = Object.values(asistAlu).filter(a => a.pagoId === id);
                    return clases.some(a => !a.tomada);
                });
                if (tieneMensPendiente) {
                    return alert('Este alumno tiene una mensualidad activa con clases pendientes. Debe agotarlas o esperar su vencimiento antes de comprar un paquete.');
                }
            }

            const fv = new Date();
            fv.setMonth(fv.getMonth() + 3);
            const numClases = parseInt(document.getElementById('plan-clases')?.value || '4');

            const pRef = await safePush('pagos_paquetes', {
                alumnoId: alu,
                monto,
                faltante,
                tipoPaquete: numClases,
                clasesBase: numClases,
                fechaCreacion: new Date().toISOString(),
                fechaVencimiento: fv.toISOString(),
                medioPago: medio,
                observaciones
            });

            for (let i = 0; i < numClases; i++) {
                await safePush(`asistencias/${alu}`, {
                    pagoId: pRef.key,
                    tomada: false,
                    tipo: 'base',
                    origenPago: 'paquete'
                });
            }
        } else if (c === 'clases_extra') {
            const raw = document.getElementById('pago-id-select')?.value;
            if (!raw) return alert('Selecciona un ID de mensualidad activa.');
            const pId = raw.includes(':') ? raw.split(':')[1] : raw;
            const num = parseInt(document.getElementById('num-clases-extra')?.value || '1');
            const pSnap = await safeGet(`pagos_tipo_a/${pId}`);

            if (pSnap.exists()) {
                const val = pSnap.val();
                await safeUpdate(`pagos_tipo_a/${pId}`, {
                    monto: (parseFloat(val.monto) || 0) + monto,
                    clasesExtra: (val.clasesExtra || 0) + num,
                    observaciones: (val.observaciones || '') + `\n[+${num} Clases Extra]`
                });
                for (let i = 0; i < num; i++) {
                    await safePush(`asistencias/${alu}`, { pagoId: pId, tomada: false, tipo: 'extra', origenPago: 'mensualidad' });
                }
            }
        } else if (c === 'pago_parcial') {
            const raw = document.getElementById('pago-id-select')?.value;
            if (!raw) return alert('No se pudo encontrar un ID de pago activo.');
            const [tipo, pId] = raw.includes(':') ? raw.split(':') : ['mensualidad', raw];
            const nodo = tipo === 'paquete' ? 'pagos_paquetes' : 'pagos_tipo_a';

            const pSnap = await safeGet(`${nodo}/${pId}`);

            if (pSnap.exists()) {
                const val = pSnap.val();
                const actualFaltante = parseFloat(val.faltante || 0);
                const nuevoFaltante = Math.max(0, actualFaltante - monto);
                await safeUpdate(`${nodo}/${pId}`, {
                    faltante: nuevoFaltante,
                    observaciones: (val.observaciones || '') + `\n[Abono: $${monto} - ${new Date().toLocaleDateString()}]`
                });
            }
        } else if (c === 'actividad_b') {
            const desc = 'Actividad Extra';
            const esAbono = document.getElementById('es-abono-b')?.checked;

            if (esAbono) {
                const idB = document.getElementById('select-id-b')?.value;
                if (!idB) return alert("Selecciona el folio de la actividad B");
                const bSnap = await safeGet(`pagos_tipo_b/${idB}`);
                if (bSnap.exists()) {
                    const val = bSnap.val();
                    const nuevoFaltante = Math.max(0, (val.faltante || 0) - monto);
                    await safeUpdate(`pagos_tipo_b/${idB}`, {
                        faltante: nuevoFaltante,
                        observaciones: (val.observaciones || '') + `\n[Abono: $${monto}]`
                    });
                }
            } else {
                await safePush('pagos_tipo_b', {
                    descripcion: desc, monto, faltante, medioPago: medio,
                    observaciones, fecha: new Date().toISOString()
                });
            }
        }

        alert("¡Operación Exitosa! ✓");
        resetPagoForm();
        window.app.changeView('dashboard-view');
        refreshData();

    } catch (error) {
        console.error("Error al procesar pago:", error);
        alert("Error al procesar el pago: " + (error.message || error));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
});

// Nuevo alumno
document.getElementById('is-adult')?.addEventListener('change', e => {
    document.getElementById('tutor-section')?.classList.toggle('hidden-view', e.target.checked);
});

document.getElementById('add-student-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    const nombre = document.getElementById('new-name')?.value || '';
    const apellidos = document.getElementById('new-lastname')?.value || '';
    const contacto = document.getElementById('new-contact')?.value || '';
    const esMayor = document.getElementById('is-adult')?.checked || false;

    const s = {
        nombre: nombre,
        apellidos: apellidos,
        contacto: contacto,
        esMayor: esMayor,
        clasesDisponibles: 0,
        tutor: {
            nombre: document.getElementById('tutor-name')?.value || '',
            telefono: document.getElementById('tutor-phone')?.value || ''
        },
        fechaRegistro: new Date().toISOString()
    };

    try {
        await safePush('alumnos', s);
        alert("¡Inscripción exitosa! ✓");
        window.app.hideModal('modal-alumno');
        document.getElementById('add-student-form')?.reset();
        refreshData();
    } catch (error) {
        console.error("Error al inscribir:", error);
        alert("Hubo un error al guardar al alumno.");
    }
});

// Inicialización
refreshData();
