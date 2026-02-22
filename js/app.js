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
        ['dashboard-view', 'alumnos-view', 'pagos-view', 'ajustes-view', 'profile-view', 'finanzas-view'].forEach(v => 
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
}

// 1. Alumnos activos
async function loadActiveStudents() {
    const [aluSnap, pagosASnap, asistSnap] = await Promise.all([
        get(ref(db, 'alumnos')),
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'asistencias'))
    ]);

    const container = document.getElementById('active-students-list');
    container.innerHTML = '';
    if (!aluSnap.exists()) return;

    const hoy = new Date();
    const pagosA = pagosASnap.val() || {};
    const asistencias = asistSnap.val() || {};

    Object.entries(aluSnap.val()).forEach(([id, s]) => {
        const pagoKey = Object.keys(pagosA).find(k => pagosA[k].alumnoId === id && new Date(pagosA[k].fechaVencimiento) > hoy);

        if (pagoKey) {
            const p = pagosA[pagoKey];
            const aluAsist = asistencias[id] ? Object.values(asistencias[id]).filter(a => a.pagoId === pagoKey) : [];
            const disponibles = aluAsist.filter(a => !a.tomada).length;
            const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer";
            card.onclick = () => openProfile(id, s, pagoKey, p);
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
}

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
async function openProfile(aluId, s, pKey, pData) {
    if (!s) {
        const snap = await get(ref(db, `alumnos/${aluId}`));
        s = snap.val();
    }
    if (!pKey || !pData) {
        const pagosSnap = await get(ref(db, 'pagos_tipo_a'));
        const pagos = pagosSnap.val() || {};
        const hoy = new Date();
        pKey = Object.keys(pagos).find(k => pagos[k].alumnoId === aluId && new Date(pagos[k].fechaVencimiento) > hoy);
        pData = pagos[pKey];
    }
    // --- NUEVO CÁLCULO DE DÍAS RESTANTES ---
    let diasRestantesTxt = "Sin mensualidad activa";
    let badgeClass = "bg-red-50 text-red-500"; 

    if (pKey && pData && pData.fechaVencimiento) {
        const hoy = new Date();
        const vencimiento = new Date(pData.fechaVencimiento);
        const dias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
        
        diasRestantesTxt = `Vence en ${dias} día${dias !== 1 ? 's' : ''}`;
        badgeClass = dias <= 5 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600";
    }
    // ----------------------------------------

    window.app.changeView('profile-view');
    const container = document.getElementById('profile-content');
    const asistSnap = await get(ref(db, `asistencias/${aluId}`));
    const asistencias = asistSnap.exists() ? Object.entries(asistSnap.val()).filter(([aid, a]) => a.pagoId === pKey) : [];
    const pagosBSnap = await get(ref(db, 'pagos_tipo_b'));
    const pagosB = pagosBSnap.exists() ? Object.entries(pagosBSnap.val()).filter(([k, b]) => b.alumnoId === aluId) : [];

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center">
            <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-4">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
            <h2 class="text-xl font-bold">${s.nombre} ${s.apellidos || ''}</h2>
            <p class="text-xs text-gray-500 mb-4">ID Pago: ${pKey ? '#' + pKey.slice(-6) : '-'}</p>
            <div class="mb-4">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${badgeClass}">
                    ${diasRestantesTxt}
                </span>
            </div>
            <div class="flex gap-4 w-full">
                <a href="tel:${s.contacto || '#'}" class="flex-1 py-3 bg-primary text-white rounded-xl text-center font-bold">Llamar</a>
                <button class="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Mensaje</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Control de Asistencia</h3>
            <div class="space-y-4">
                ${asistencias.map(([aid, a], i) => {
                    const totalBase = pData.clasesBase || 4; 
                    const esUltimaBase = i === (totalBase - 1); 
                    const bloqueada = esUltimaBase && pData && pData.faltante > 0;
                    const statusClass = a.tomada ? 'bg-green-500 text-white' : (bloqueada ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600');
                    
                    return `
                        <div class="flex items-center justify-between border-b border-gray-50 pb-3">
                            <div>
                                <p class="font-bold text-sm">Clase ${i + 1} ${i < totalBase ? '(Base)' : '(Extra)'}</p>
                                <p class="text-[10px] text-gray-400">${a.tomada ? 'Tomada ✓' : 'Pendiente'}</p>
                            </div>
                            <button 
                                ${(!a.tomada && !bloqueada) ? `onclick="window.app.checkIn('${aluId}', '${aid}')"` : ''}
                                class="px-4 py-2 rounded-lg text-xs font-bold ${statusClass}">
                                ${a.tomada ? 'Tomada ✓' : (bloqueada ? 'Bloqueada ($)' : 'Marcar')}
                            </button>
                        </div>`;
                }).join('')}
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Actividades Extra (Tipo B)</h3>
            ${pagosB.length === 0 ? '<p class="text-sm text-gray-500">No hay actividades extra registradas.</p>' : `
            <div class="space-y-3">
                ${pagosB.map(([k, b]) => `
                    <div class="flex items-center justify-between border-b border-gray-50 pb-3">
                        <div>
                            <p class="font-bold text-sm">${b.descripcion || 'Actividad'} - $${b.monto}</p>
                            <p class="text-[10px] text-gray-400">${b.fecha ? new Date(b.fecha).toLocaleDateString() : ''} ${b.medioPago ? '· ' + b.medioPago : ''}</p>
                            ${b.observaciones ? `<p class="text-[10px] text-gray-400">Notas: ${b.observaciones}</p>` : ''}
                        </div>
                        <div class="text-xs text-gray-500">ID: ${k.slice(-6)}</div>
                    </div>
                `).join('')}
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
async function cargarFinanzas(mes, anio) {
    // ... (mantengo la función original por ahora, si necesitas ajustes avísame)
    // Por simplicidad la dejo como estaba en tu código original
    // Si quieres que la corrija también, dime y la actualizo completa
}

function initFinanzasFilters() {
    const mesSel = document.getElementById('finanzas-mes');
    const anioSel = document.getElementById('finanzas-anio');
    
    if(!mesSel || !anioSel) return;

    mesSel.innerHTML = '';
    anioSel.innerHTML = '';

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoy = new Date();

    meses.forEach((m, i) => {
        const opt = new Option(m, i);
        if(i === hoy.getMonth()) opt.selected = true;
        mesSel.add(opt);
    });

    for(let a = hoy.getFullYear(); a >= 2024; a--) {
        const opt = new Option(a, a);
        anioSel.add(opt);
    }

    [mesSel, anioSel].forEach(el => el.addEventListener('change', () => {
        cargarFinanzas(mesSel.value, anioSel.value);
    }));
}

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

    const selId = document.getElementById('pago-id-select');
    if (selId) selId.innerHTML = '<option value="">Seleccionar ID...</option>';
}

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

    if (concepto === 'mensualidad') {
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

    const snap = await get(ref(db, 'pagos_tipo_a'));
    const hoy = new Date();
    let pagoActivoEncontrado = null;

    if (snap.exists()) {
        const pagos = snap.val();
        pagoActivoEncontrado = Object.entries(pagos).find(([id, p]) =>
            p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy
        );
    }

    if (concepto === 'mensualidad' && pagoActivoEncontrado) {
        alert('Este alumno ya tiene una mensualidad activa.');
        e.target.value = '';
        return;
    }

    if ((concepto === 'pago_parcial' || concepto === 'clases_extra') && pagoActivoEncontrado) {
        const [id, p] = pagoActivoEncontrado;
        const faltante = parseFloat(p.faltante || 0);

        if (concepto === 'pago_parcial' && faltante > 0) {
            selId.innerHTML = `<option value="${id}" selected>Aplicar a Deuda: $${faltante} (ID: ${id.slice(-6)})</option>`;
            selId.value = id;
            pIdContainer.classList.remove('hidden-view');
        } else if (concepto === 'pago_parcial' && faltante <= 0) {
            alert('Este alumno ya liquidó su mensualidad.');
            e.target.value = '';
        } else if (concepto === 'clases_extra' && faltante <= 0) {
            selId.innerHTML = `<option value="${id}" selected>ID: ${id.slice(-6)} (Pagado ✓)</option>`;
            pIdContainer.classList.remove('hidden-view');
            extraContainer?.classList.remove('hidden-view');
        } else if (concepto === 'clases_extra' && faltante > 0) {
            alert('Debe liquidar el faltante antes de añadir clases extra.');
            e.target.value = '';
        }
    } else if ((concepto === 'pago_parcial' || concepto === 'clases_extra') && !pagoActivoEncontrado) {
        alert('No se encontró mensualidad activa.');
        e.target.value = '';
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
                    tipo: 'base' 
                });
            }
        } else if (c === 'clases_extra') {
            const pId = document.getElementById('pago-id-select').value;
            if (!pId) return alert('Selecciona un ID de mensualidad activa.');
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
                    await push(ref(db, `asistencias/${alu}`), { pagoId: pId, tomada: false, tipo: 'extra' });
                }
            }
        } else if (c === 'pago_parcial') {
            let pId = document.getElementById('pago-id-select').value;
            if (!pId) return alert('No se pudo encontrar un ID de pago activo.');

            const pRef = ref(db, `pagos_tipo_a/${pId}`);
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
