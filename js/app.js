import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
    authDomain: "bd-personal-c3e4d.firebaseapp.com",
    databaseURL: "https://bd-personal-c3e4d-default-rtdb.firebaseio.com",
    projectId: "bd-personal-c3e4d",
    storageBucket: "bd-personal-c3e4d.firebasestorage.app",
    messagingSenderId: "739560517872",
    appId: "1:739560517872:web:8df36c57591b3220985235"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

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
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.querySelector('nav')?.classList.remove('hidden-view');
        window.app.changeView('dashboard-view');
        refreshData();
    } else {
        document.getElementById('login-view').classList.remove('hidden-view');
        document.querySelector('nav')?.classList.add('hidden-view');
    }
});

document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorDiv = document.getElementById('login-error');
    errorDiv.classList.add('hidden-view');
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
    } catch (e) {
        errorDiv.textContent = 'Usuario o contraseña incorrectos';
        errorDiv.classList.remove('hidden-view');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
    window.app.changeView('login-view');
});

// Toggle Password
document.getElementById('toggle-password')?.addEventListener('click', () => {
    const pass = document.getElementById('password');
    const icon = document.getElementById('toggle-password');
    if (!pass) return;
    pass.type = pass.type === 'password' ? 'text' : 'password';
    icon.textContent = pass.type === 'password' ? 'visibility' : 'visibility_off';
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

// 1. Alumnos activos (mensualidad)
async function loadActiveStudents() {
    const [aluSnap, pagosASnap, asistSnap] = await Promise.all([
        get(ref(db, 'alumnos')),
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'asistencias'))
    ]);

    const container = document.getElementById('active-students-list');
    container.innerHTML = '';
    if (!aluSnap.exists()) {
        alertasMensualidadCache = [];
        renderNotifDrawer();
        return;
    }

    const hoy = new Date();
    const pagosA = pagosASnap.val() || {};
    const asistencias = asistSnap.val() || {};
    const alertas = []; // Para notificaciones

    Object.entries(aluSnap.val()).forEach(([id, s]) => {
        // Regla 1: mensualidad activa se determina únicamente por fecha de vencimiento
        const pagoKey = Object.keys(pagosA).find(k => pagosA[k].alumnoId === id && new Date(pagosA[k].fechaVencimiento) > hoy);

        if (pagoKey) {
            const p = pagosA[pagoKey];
            const aluAsist = asistencias[id] ? Object.values(asistencias[id]).filter(a => a.pagoId === pagoKey) : [];
            const disponibles = aluAsist.filter(a => !a.tomada).length;
            const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

            // Calcular días restantes para notificaciones
            const dias = Math.ceil((new Date(p.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24));
            if (dias <= 5) alertas.push({ nombre: `${s.nombre} ${s.apellidos || ''}`, dias });

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer";
            card.onclick = () => openProfile(id);
            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
                    <div>
                        <p class="font-bold text-slate-800">${s.nombre} ${s.apellidos || ''}</p>
                        <div class="flex gap-3 text-[10px] uppercase font-bold tracking-tighter mt-1">
                            <span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">${disponibles} Clases Disp.</span>
                            <span class="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">Saldo: ${saldoTxt}</span>
                        </div>
                    </div>
                </div>
                <span class="material-symbols-outlined text-gray-300">chevron_right</span>
            `;
            container.appendChild(card);
        }
    });

    alertasMensualidadCache = alertas;
    renderNotifDrawer();
}

// 1B. Alumnos con paquete activo (Regla 3: por fecha Y clases pendientes)
async function loadActivePaquetes() {
    const container = document.getElementById('active-paquetes-list');
    if (!container) return; // vista aún no cargada en el DOM

    const [paqSnap, asistSnap, alumnosSnap] = await Promise.all([
        get(ref(db, 'pagos_paquetes')),
        get(ref(db, 'asistencias')),
        get(ref(db, 'alumnos'))
    ]);

    container.innerHTML = '';

    const paquetes = paqSnap.exists() ? paqSnap.val() : {};
    const asistencias = asistSnap.exists() ? asistSnap.val() : {};
    const alumnos = alumnosSnap.exists() ? alumnosSnap.val() : {};
    const hoy = new Date();
    const alertas = [];

    const activos = Object.entries(paquetes).filter(([id, p]) => {
        if (new Date(p.fechaVencimiento) <= hoy) return false;
        const clases = asistencias[p.alumnoId] ? Object.values(asistencias[p.alumnoId]).filter(a => a.pagoId === id) : [];
        return clases.some(a => !a.tomada);
    });

    if (activos.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">No hay paquetes activos actualmente.</p>';
    }

    activos.forEach(([id, p]) => {
        const s = alumnos[p.alumnoId];
        if (!s) return;

        const clases = asistencias[p.alumnoId] ? Object.values(asistencias[p.alumnoId]).filter(a => a.pagoId === id) : [];
        const disponibles = clases.filter(a => !a.tomada).length;
        const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

        const dias = Math.ceil((new Date(p.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24));
        if (dias <= 5) alertas.push({ nombre: `${s.nombre} ${s.apellidos || ''}`, dias });

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer";
        card.onclick = () => openProfile(p.alumnoId);
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="size-12 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
                <div>
                    <p class="font-bold text-slate-800">${s.nombre} ${s.apellidos || ''}</p>
                    <div class="flex gap-3 text-[10px] uppercase font-bold tracking-tighter mt-1">
                        <span class="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">${disponibles} Clases Disp.</span>
                        <span class="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">Saldo: ${saldoTxt}</span>
                    </div>
                </div>
            </div>
            <span class="material-symbols-outlined text-gray-300">chevron_right</span>
        `;
        container.appendChild(card);
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

// Cerrar drawer al hacer clic fuera
document.addEventListener('click', (e) => {
    const drawer = document.getElementById('notif-drawer');
    const btn = document.getElementById('notif-btn');
    if (drawer && btn && !drawer.contains(e.target) && !btn.contains(e.target)) {
        drawer.classList.add('hidden-view');
    }
});

// 2. Lista completa alumnos
function loadFullStudents(filter = '') {
    onValue(ref(db, 'alumnos'), snapshot => {
        const container = document.getElementById('full-students-list');
        container.innerHTML = '';
        if (!snapshot.exists()) return;

        Object.entries(snapshot.val()).forEach(([id, s]) => {
            if (`${s.nombre} ${s.apellidos || ''}`.toLowerCase().includes(filter.toLowerCase())) {
                const div = document.createElement('div');
                div.className = "bg-white p-4 rounded-2xl flex items-center justify-between border-b border-gray-50";
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
                        <div><p class="font-bold text-sm">${s.nombre} ${s.apellidos || ''}</p><p class="text-xs text-gray-400">${s.contacto || ''}</p></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.app.editAlumno('${id}')" class="text-primary material-symbols-outlined">edit_square</button>
                        <button onclick="window.app.openQuickProfile('${id}')" class="material-symbols-outlined text-gray-400">visibility</button>
                    </div>
                `;
                container.appendChild(div);
            }
        });
    });
}

document.getElementById('search-alumno')?.addEventListener('input', e => loadFullStudents(e.target.value));

// --- EDITAR ALUMNO ---
window.app.editAlumno = async (id) => {
    const snap = await get(ref(db, `alumnos/${id}`));
    const s = snap.val();
    if (!s) return alert('Alumno no encontrado');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-name').value = s.nombre || '';
    document.getElementById('edit-lastname').value = s.apellidos || '';
    document.getElementById('edit-contact').value = s.contacto || '';
    document.getElementById('edit-tutor-name').value = s.tutor?.nombre || '';
    document.getElementById('edit-tutor-phone').value = s.tutor?.telefono || '';
    document.getElementById('edit-avatar').textContent = `${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}`;
    window.app.showModal('modal-edit-alumno');
};

document.getElementById('edit-student-form').addEventListener('submit', async e => {
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
    await update(ref(db, `alumnos/${id}`), upd);
    alert("Cambios guardados");
    window.app.hideModal('modal-edit-alumno');
    refreshData();
});

// --- PERFIL ---
// Reescrito para ser autosuficiente: siempre resuelve internamente la mensualidad
// activa y el paquete activo del alumno (Reglas 1 y 3), y arma un historial combinado.
async function openProfile(aluId) {
    const [alumnoSnap, pagosASnap, pagosPSnap, asistSnap] = await Promise.all([
        get(ref(db, `alumnos/${aluId}`)),
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'pagos_paquetes')),
        get(ref(db, `asistencias/${aluId}`))
    ]);

    const s = alumnoSnap.val();
    if (!s) return alert('Alumno no encontrado');

    const pagosA = pagosASnap.exists() ? pagosASnap.val() : {};
    const pagosP = pagosPSnap.exists() ? pagosPSnap.val() : {};
    const todasAsistencias = asistSnap.exists() ? asistSnap.val() : {};
    const hoy = new Date();

    // Mensualidad activa (Regla 1: solo por fecha)
    const mensEntry = Object.entries(pagosA).find(([id, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy);
    const mKey = mensEntry ? mensEntry[0] : null;
    const mData = mensEntry ? mensEntry[1] : null;

    // Paquete activo (Regla 3: por fecha Y clases pendientes)
    const paqEntry = Object.entries(pagosP).find(([id, p]) => {
        if (p.alumnoId !== aluId || new Date(p.fechaVencimiento) <= hoy) return false;
        const clases = Object.values(todasAsistencias).filter(a => a.pagoId === id);
        return clases.some(a => !a.tomada);
    });
    const pkKey = paqEntry ? paqEntry[0] : null;
    const pkData = paqEntry ? paqEntry[1] : null;

    window.app.changeView('profile-view');
    const container = document.getElementById('profile-content');

    // Historial combinado (registros vencidos de ambos tipos)
    const historialA = Object.entries(pagosA)
        .filter(([k, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) < hoy && k !== mKey)
        .map(([k, p]) => ({ id: k, data: p, tipo: 'Mensualidad' }));
    const historialP = Object.entries(pagosP)
        .filter(([k, p]) => p.alumnoId === aluId && new Date(p.fechaVencimiento) < hoy && k !== pkKey)
        .map(([k, p]) => ({ id: k, data: p, tipo: 'Paquete' }));
    const historial = [...historialA, ...historialP]
        .sort((a, b) => new Date(b.data.fechaVencimiento) - new Date(a.data.fechaVencimiento));

    const renderBloquePlan = (key, data, tipoLabel) => {
        if (!key || !data) return '';
        const vencimiento = new Date(data.fechaVencimiento);
        const dias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
        const diasTxt = `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
        const badgeClass = dias <= 5 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600";

        const clasesPlan = Object.entries(todasAsistencias).filter(([aid, a]) => a.pagoId === key);
        const totalBase = data.clasesBase || 4;

        const filasClases = clasesPlan.map(([aid, a], i) => {
            // Regla 4: última clase base bloqueada si hay faltante
            const esUltimaBase = i === (totalBase - 1);
            const bloqueadaPorFaltante = esUltimaBase && data.faltante > 0;
            // Regla 5: clases no tomadas se cierran al vencer el plan
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
        <div class="bg-white rounded-3xl p-6 shadow-sm">
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-bold text-slate-800">${tipoLabel}</h3>
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${badgeClass}">${diasTxt}</span>
            </div>
            <p class="text-xs text-gray-500 mb-4">ID: #${key.slice(-6)} · Faltante: ${data.faltante > 0 ? `<span class="text-red-500 font-bold">$${data.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`}</p>
            <div class="space-y-4">${filasClases}</div>
        </div>`;
    };

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center">
            <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-4">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
            <h2 class="text-xl font-bold">${s.nombre} ${s.apellidos || ''}</h2>
            <p class="text-xs text-gray-500 mb-4">${(!mKey && !pkKey) ? 'Sin plan activo' : ''}</p>
            <div class="flex gap-4 w-full">
                <a href="tel:${s.contacto || '#'}" class="flex-1 py-3 bg-primary text-white rounded-xl text-center font-bold">Llamar</a>
                <button class="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Mensaje</button>
            </div>
        </div>

        ${renderBloquePlan(mKey, mData, 'Mensualidad Activa')}
        ${renderBloquePlan(pkKey, pkData, 'Paquete Activo')}

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Historial de Pagos</h3>
            ${historial.length === 0 ? '<p class="text-sm text-gray-500">No hay pagos anteriores registrados.</p>' : `
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="border-b border-gray-100">
                            <th class="text-left text-gray-400 font-bold pb-2 pr-3">ID</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-3">Tipo</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-3">Monto</th>
                            <th class="text-left text-gray-400 font-bold pb-2 pr-3">Clases tomadas</th>
                            <th class="text-left text-gray-400 font-bold pb-2">Venció</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        ${historial.map(h => {
                            const clasesTomadas = Object.values(todasAsistencias).filter(a => a.pagoId === h.id && a.tomada).length;
                            return `
                            <tr>
                                <td class="py-2 pr-3 font-mono text-gray-500">#${h.id.slice(-6)}</td>
                                <td class="py-2 pr-3">${h.tipo}</td>
                                <td class="py-2 pr-3 font-bold text-slate-700">$${h.data.monto}</td>
                                <td class="py-2 pr-3">
                                    <span class="bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">${clasesTomadas} clases</span>
                                </td>
                                <td class="py-2 text-gray-400">${new Date(h.data.fechaVencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    `;
}

window.app.openQuickProfile = async (id) => openProfile(id);

window.app.checkIn = async (aluId, aid) => {
    await update(ref(db, `asistencias/${aluId}/${aid}`), { tomada: true, fechaTomada: new Date().toISOString() });
    alert("Asistencia marcada");
    window.app.changeView('dashboard-view');
    refreshData();
};

// --- FINANZAS ---
function initFinanzasFilters() {
    const mesSel = document.getElementById('finanzas-mes');
    const anioSel = document.getElementById('finanzas-anio');
    if (!mesSel || !anioSel) return;

    // Evitar listeners duplicados si refreshData() se llama varias veces
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

    // Mostrar estado de carga
    document.getElementById('total-ingresos').textContent    = '...';
    document.getElementById('total-deuda').textContent       = '...';
    document.getElementById('res-mensualidades').textContent = '...';
    document.getElementById('res-clases-extra').textContent  = '...';
    document.getElementById('res-paquetes').textContent      = '...';
    document.getElementById('res-tipo-b').textContent        = '...';
    document.getElementById('lista-historial-finanzas').innerHTML =
        '<p class="text-sm text-gray-400 text-center py-4">Cargando...</p>';

    // ── Leer Firebase ──────────────────────────────────────────────
    const [pagosASnap, pagosPSnap, pagosBSnap, asistSnap, alumnosSnap] = await Promise.all([
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'pagos_paquetes')),
        get(ref(db, 'pagos_tipo_b')),
        get(ref(db, 'asistencias')),
        get(ref(db, 'alumnos'))
    ]);

    const pagosA    = pagosASnap.exists()   ? pagosASnap.val()   : {};
    const pagosP    = pagosPSnap.exists()   ? pagosPSnap.val()   : {};
    const pagosB    = pagosBSnap.exists()   ? pagosBSnap.val()   : {};
    const asistAll  = asistSnap.exists()    ? asistSnap.val()    : {};
    const alumnos   = alumnosSnap.exists()  ? alumnosSnap.val()  : {};

    // ── Helpers ────────────────────────────────────────────────────
    const esMismoMes = (fechaISO) => {
        if (!fechaISO) return false;
        const d = new Date(fechaISO);
        return d.getMonth() === mesNum && d.getFullYear() === anioNum;
    };

    const fmt = (n) => '$' + parseFloat(n || 0).toFixed(2);

    // ── Clasificar IDs tipo A (mensualidades) ───────────────────────
    // Regla: su fechaVencimiento cae en el mes consultado
    const idsA = Object.entries(pagosA)
        .filter(([, p]) => esMismoMes(p.fechaVencimiento))
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

    // ── Clasificar IDs tipo P (paquetes de clases) ──────────────────
    // Regla: su fechaVencimiento cae en el mes consultado (igual que mensualidad)
    const idsP = Object.entries(pagosP)
        .filter(([, p]) => esMismoMes(p.fechaVencimiento))
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

    // ── Clasificar IDs tipo B ──────────────────────────────────────
    // Regla: su último movimiento (abono) cae en el mes consultado.
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

    // ── Calcular totales ───────────────────────────────────────────
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

    // ── Actualizar tarjetas resumen ────────────────────────────────
    document.getElementById('total-ingresos').textContent     = fmt(totalIngresos);
    document.getElementById('total-deuda').textContent        = fmt(totalDeuda);
    document.getElementById('res-mensualidades').textContent  = fmt(totalMensualidades);
    document.getElementById('res-clases-extra').textContent   = fmt(totalClasesExtra);
    document.getElementById('res-paquetes').textContent       = fmt(totalPaquetes);
    document.getElementById('res-tipo-b').textContent         = fmt(totalTipoB);

    // ── Renderizar tabla ───────────────────────────────────────────
    const contenedor = document.getElementById('lista-historial-finanzas');

    if (todosIds.length === 0) {
        contenedor.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">No hay registros cerrados en este período.</p>';
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

    contenedor.innerHTML = filas;
}

// Abrir detalle de ID (mensualidad o paquete) desde finanzas (vista de solo lectura)
window.app.abrirDetalleFinanzas = async (pagoId, tipo = 'A') => {
    const nodo = tipo === 'P' ? 'pagos_paquetes' : 'pagos_tipo_a';

    const [pagosSnap, alumnosSnap, asistSnap] = await Promise.all([
        get(ref(db, nodo)),
        get(ref(db, 'alumnos')),
        get(ref(db, 'asistencias'))
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
};

// --- PAGOS ---
function resetPagoForm() {
    const form = document.getElementById('register-pago-form');
    if (form) form.reset();

    document.getElementById('pago-alumno-id').value = '';
    document.getElementById('pago-id-container')?.classList.add('hidden-view');
    document.getElementById('extra-classes-container')?.classList.add('hidden-view');
    document.getElementById('tipo-b-logic')?.classList.add('hidden-view');
    document.getElementById('seccion-alumno-pago')?.classList.remove('hidden-view');
    document.getElementById('faltante').disabled = false;
    document.getElementById('select-id-b').classList.add('hidden-view');
    document.getElementById('pago-alumno-suggestions').innerHTML = '';
    document.getElementById('plan-clases-container')?.classList.add('hidden-view');

    const selId = document.getElementById('pago-id-select');
    if (selId) selId.innerHTML = '<option value="">Seleccionar ID...</option>';
}

// Concepto: maneja mensualidad, paquete_clases, pago_parcial, clases_extra y actividad_b
document.getElementById('concepto').addEventListener('change', async (e) => {
    const concepto = e.target.value;
    const planContainer = document.getElementById('plan-clases-container');
    const aluId = document.getElementById('pago-alumno-id').value;
    const pIdContainer = document.getElementById('pago-id-container');
    const extraContainer = document.getElementById('extra-classes-container');
    const selId = document.getElementById('pago-id-select');
    const seccionAlumno = document.getElementById('seccion-alumno-pago');
    const tipoBLogic = document.getElementById('tipo-b-logic');

    pIdContainer.classList.add('hidden-view');
    extraContainer?.classList.add('hidden-view');
    tipoBLogic.classList.add('hidden-view');
    seccionAlumno.classList.remove('hidden-view');
    selId.innerHTML = '<option value="">Seleccionar ID...</option>';

    if (concepto === 'mensualidad' || concepto === 'paquete_clases') {
        planContainer.classList.remove('hidden-view');
    } else {
        planContainer.classList.add('hidden-view');
    }

    if (concepto === 'actividad_b') {
        seccionAlumno.classList.add('hidden-view');
        tipoBLogic.classList.remove('hidden-view');
        return;
    }

    if (!aluId) return;

    const hoy = new Date();

    // --- MENSUALIDAD (Regla 1: bloquea únicamente por fecha) ---
    if (concepto === 'mensualidad') {
        const snap = await get(ref(db, 'pagos_tipo_a'));
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

    // --- PAQUETE DE CLASES (Reglas 2 y 3) ---
    if (concepto === 'paquete_clases') {
        const [snapA, snapP, snapAsist] = await Promise.all([
            get(ref(db, 'pagos_tipo_a')),
            get(ref(db, 'pagos_paquetes')),
            get(ref(db, `asistencias/${aluId}`))
        ]);
        const pagosA = snapA.exists() ? snapA.val() : {};
        const pagosP = snapP.exists() ? snapP.val() : {};
        const asistAlu = snapAsist.exists() ? snapAsist.val() : {};

        // Regla 3: paquete activo (no vencido y con clases pendientes) bloquea otro paquete
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

        // Regla 2: mensualidad activa CON clases pendientes bloquea el paquete
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

    // --- PAGO PARCIAL (Regla 7: busca en ambos nodos) ---
    if (concepto === 'pago_parcial') {
        const [snapA, snapP] = await Promise.all([
            get(ref(db, 'pagos_tipo_a')),
            get(ref(db, 'pagos_paquetes'))
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

        selId.innerHTML = opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        if (opciones.length === 1) selId.value = opciones[0].value;
        pIdContainer.classList.remove('hidden-view');
        return;
    }

    // --- CLASES EXTRA (Regla 6: exclusivo de mensualidad, exige faltante = 0) ---
    if (concepto === 'clases_extra') {
        const snap = await get(ref(db, 'pagos_tipo_a'));
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
            selId.innerHTML = `<option value="mensualidad:${id}" selected>ID: ${id.slice(-6)} (Pagado ✓)</option>`;
            pIdContainer.classList.remove('hidden-view');
            extraContainer?.classList.remove('hidden-view');
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
        searchCont.classList.remove('hidden-view');
        faltanteInput.value = '0';
        faltanteInput.disabled = true;
    } else {
        searchCont.classList.add('hidden-view');
        faltanteInput.disabled = false;
        faltanteInput.value = '';
    }
});

document.getElementById('search-id-b')?.addEventListener('input', async (e) => {
    const val = e.target.value;
    if (val.length === 5) {
        const snap = await get(ref(db, 'pagos_tipo_b'));
        const select = document.getElementById('select-id-b');
        select.innerHTML = '<option value="">Selecciona el ID...</option>';

        if (snap.exists()) {
            const found = Object.entries(snap.val()).filter(([id, data]) =>
                id.includes(val) && parseFloat(data.faltante || 0) > 0
            );

            if (found.length > 0) {
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
        container.innerHTML = '';
        hiddenInput.value = '';
        return;
    }

    const snap = await get(ref(db, 'alumnos'));
    if (snap.exists()) {
        const alumnos = snap.val();
        const filtrados = Object.entries(alumnos).filter(([id, data]) =>
            `${data.nombre} ${data.apellidos || ''}`.toLowerCase().includes(term)
        );

        container.innerHTML = filtrados.map(([id, data]) => `
            <button type="button"
                onclick="seleccionarAlumno('${id}', '${data.nombre} ${data.apellidos || ''}')"
                class="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-colors">
                ${data.nombre} ${data.apellidos || ''}
            </button>
        `).join('');
    }
});

window.seleccionarAlumno = (id, nombreCompleto) => {
    document.getElementById('pago-alumno-id').value = id;
    document.getElementById('pago-alumno-search').value = nombreCompleto;
    document.getElementById('pago-alumno-suggestions').innerHTML = '';
    document.getElementById('concepto').dispatchEvent(new Event('change'));
};

// Registro de pago
document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const c = document.getElementById('concepto').value;
    const monto = parseFloat(document.getElementById('monto').value || '0');
    const faltante = parseFloat(document.getElementById('faltante').value || '0');
    const medio = document.getElementById('medio-pago')?.value || '';
    const observaciones = document.getElementById('observaciones')?.value || '';

    let alu = null;
    if (c !== 'actividad_b') {
        alu = document.getElementById('pago-alumno-id').value;
        if (!alu) return alert('Selecciona un alumno antes de continuar.');
    }

    try {
        if (c === 'mensualidad') {
            const fv = new Date();
            fv.setDate(fv.getDate() + 30);
            const numClasesBase = parseInt(document.getElementById('plan-clases')?.value || '4');

            const pRef = push(ref(db, 'pagos_tipo_a'));
            await set(pRef, {
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
                await push(ref(db, `asistencias/${alu}`), {
                    pagoId: pRef.key,
                    tomada: false,
                    tipo: 'base',
                    origenPago: 'mensualidad'
                });
            }
        } else if (c === 'paquete_clases') {
            const fv = new Date();
            fv.setMonth(fv.getMonth() + 3);
            const numClases = parseInt(document.getElementById('plan-clases')?.value || '4');

            const pRef = push(ref(db, 'pagos_paquetes'));
            await set(pRef, {
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
                await push(ref(db, `asistencias/${alu}`), {
                    pagoId: pRef.key,
                    tomada: false,
                    tipo: 'base',
                    origenPago: 'paquete'
                });
            }
        } else if (c === 'clases_extra') {
            const raw = document.getElementById('pago-id-select').value;
            if (!raw) return alert('Selecciona un ID de mensualidad activa.');
            const pId = raw.includes(':') ? raw.split(':')[1] : raw;
            const num = parseInt(document.getElementById('num-clases-extra').value || '1');
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pSnap = await get(pRef);

            if (pSnap.exists()) {
                await update(pRef, {
                    monto: (parseFloat(pSnap.val().monto) || 0) + monto,
                    clasesExtra: (pSnap.val().clasesExtra || 0) + num,
                    observaciones: (pSnap.val().observaciones || '') + `\n[+${num} Clases Extra]`
                });
                for (let i = 0; i < num; i++) {
                    await push(ref(db, `asistencias/${alu}`), { pagoId: pId, tomada: false, tipo: 'extra', origenPago: 'mensualidad' });
                }
            }
        } else if (c === 'pago_parcial') {
            const raw = document.getElementById('pago-id-select').value;
            if (!raw) return alert('No se pudo encontrar un ID de pago activo.');
            const [tipo, pId] = raw.includes(':') ? raw.split(':') : ['mensualidad', raw];
            const nodo = tipo === 'paquete' ? 'pagos_paquetes' : 'pagos_tipo_a';

            const pRef = ref(db, `${nodo}/${pId}`);
            const pSnap = await get(pRef);

            if (pSnap.exists()) {
                const actualFaltante = parseFloat(pSnap.val().faltante || 0);
                const nuevoFaltante = Math.max(0, actualFaltante - monto);
                await update(pRef, {
                    faltante: nuevoFaltante,
                    observaciones: (pSnap.val().observaciones || '') + `\n[Abono: $${monto} - ${new Date().toLocaleDateString()}]`
                });
            }
        } else if (c === 'actividad_b') {
            const desc = 'Actividad Extra'; // puedes agregar input si quieres
            const esAbono = document.getElementById('es-abono-b')?.checked;

            if (esAbono) {
                const idB = document.getElementById('select-id-b').value;
                if (!idB) return alert("Selecciona el folio de la actividad B");
                const bRef = ref(db, `pagos_tipo_b/${idB}`);
                const bSnap = await get(bRef);
                if (bSnap.exists()) {
                    const nuevoFaltante = Math.max(0, (bSnap.val().faltante || 0) - monto);
                    await update(bRef, {
                        faltante: nuevoFaltante,
                        observaciones: (bSnap.val().observaciones || '') + `\n[Abono: $${monto}]`
                    });
                }
            } else {
                const pBRef = push(ref(db, 'pagos_tipo_b'));
                await set(pBRef, {
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
        console.error(error);
        alert("Error al procesar el pago: " + error.message);
    }
});

// Nuevo alumno
document.getElementById('is-adult')?.addEventListener('change', e => {
    document.getElementById('tutor-section').classList.toggle('hidden-view', e.target.checked);
});

document.getElementById('add-student-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    const nombre = document.getElementById('new-name').value;
    const apellidos = document.getElementById('new-lastname').value;
    const contacto = document.getElementById('new-contact').value;
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
        const p = push(ref(db, 'alumnos'));
        await set(p, s);
        alert("¡Inscripción exitosa! ✓");
        window.app.hideModal('modal-alumno');
        document.getElementById('add-student-form').reset();
        refreshData();
    } catch (error) {
        console.error("Error al inscribir:", error);
        alert("Hubo un error al guardar al alumno.");
    }
});

// Inicialización
refreshData();
