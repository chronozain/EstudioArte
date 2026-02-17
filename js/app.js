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
    closeView: id => document.getElementById(id)?.classList.add('hidden-view'),
    changeView: (view) => {
        // views con sufijo -view
        ['dashboard-view', 'alumnos-view', 'pagos-view', 'ajustes-view', 'profile-view'].forEach(v => 
            document.getElementById(v)?.classList.add('hidden-view')
        );
        // aceptar tanto 'dashboard' como 'dashboard-view' por compatibilidad
        const target = document.getElementById(view) || document.getElementById(view + '-view') || document.getElementById(view.replace('-view',''));
        if (target) target.classList.remove('hidden-view');

        // actualizar nav visual
        document.querySelectorAll('.nav-btn').forEach(b => {
            const navKey = b.dataset.nav;
            const activeKey = (view.includes('-') ? view.split('-')[0] : view.replace('-view',''));
            b.classList.toggle('text-accent', navKey === activeKey);
            b.classList.toggle('text-gray-400', navKey !== activeKey);
        });
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
    errorDiv.classList.add('hidden');
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
    } catch (e) {
        errorDiv.textContent = 'Usuario o contraseña incorrectos';
        errorDiv.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
    window.app.changeView('login-view');
});

// Toggle Password Visibility
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
    populateAlumnoSuggestions();   // versión nueva (chips)
    populateAlumnoSelect();        // compatibilidad con versión antigua (select)
}

// 1. INICIO: ALUMNOS ACTIVOS (Con Info de Clases y Saldo)
// incorporamos pagos tipo A y B (tipo_b mostrados en perfil)
async function loadActiveStudents() {
    const [aluSnap, pagosASnap, pagosBSnap, asistSnap] = await Promise.all([
        get(ref(db, 'alumnos')),
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'pagos_tipo_b')),
        get(ref(db, 'asistencias'))
    ]);

    const container = document.getElementById('active-students-list');
    container.innerHTML = '';
    if (!aluSnap.exists()) return;

    const hoy = new Date();
    const pagosA = pagosASnap.val() || {};
    // pagosB no los contamos como mensualidades, solo los listamos en perfil
    const pagosB = pagosBSnap.val() || {};
    const asistencias = asistSnap.val() || {};

    Object.entries(aluSnap.val()).forEach(([id, s]) => {
        const pagoKey = Object.keys(pagosA).find(k => pagosA[k].alumnoId === id && new Date(pagosA[k].fechaVencimiento) > hoy);
        
        if (pagoKey) {
            const p = pagosA[pagoKey];
            const aluAsist = asistencias[id] ? Object.values(asistencias[id]).filter(a => a.pagoId === pagoKey) : [];
            const disponibles = aluAsist.filter(a => !a.tomada).length;
            // saldo y estilo combinado (restaurado desde base)
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

// 2. MODULO ALUMNOS: LISTA COMPLETA Y BUSCADOR
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
                        <button onclick="window.app.openQuickProfile && window.app.openQuickProfile('${id}')" class="material-symbols-outlined text-gray-400">visibility</button>
                    </div>
                `;
                container.appendChild(div);
            }
        });
    });
}

document.getElementById('search-alumno')?.addEventListener('input', e => loadFullStudents(e.target.value));

// --- FUNCIONES DE MODALES / EDICION ---
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

// --- PERFIL Y ASISTENCIA (Lógica de la 3ra Clase) ---
async function openProfile(aluId, s, pKey, pData) {
    // Si no llegan s/pKey/pData, los cargamos
    if (!s) {
        const snap = await get(ref(db, `alumnos/${aluId}`));
        s = snap.val();
    }
    if (!pKey || !pData) {
        // buscar pago activo tipo A
        const pagosSnap = await get(ref(db, 'pagos_tipo_a'));
        const pagos = pagosSnap.val() || {};
        const hoy = new Date();
        pKey = Object.keys(pagos).find(k => pagos[k].alumnoId === aluId && new Date(pagos[k].fechaVencimiento) > hoy);
        pData = pagos[pKey];
    }

    window.app.changeView('profile-view');
    const container = document.getElementById('profile-content');
    const asistSnap = await get(ref(db, `asistencias/${aluId}`));
    const asistencias = asistSnap.exists() ? Object.entries(asistSnap.val()).filter(([aid, a]) => a.pagoId === pKey) : [];
    // obtener pagos tipo B del alumno
    const pagosBSnap = await get(ref(db, 'pagos_tipo_b'));
    const pagosB = pagosBSnap.exists() ? Object.entries(pagosBSnap.val()).filter(([k, b]) => b.alumnoId === aluId) : [];

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center">
            <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-4">${s.nombre[0]}${s.apellidos ? s.apellidos[0] : ''}</div>
            <h2 class="text-xl font-bold">${s.nombre} ${s.apellidos || ''}</h2>
            <p class="text-xs text-gray-500 mb-4">ID Pago: ${pKey ? '#'+pKey.slice(-6) : '-'}</p>
            <div class="flex gap-4 w-full">
                <a href="tel:${s.contacto || '#'}" class="flex-1 py-3 bg-primary text-white rounded-xl text-center font-bold">Llamar</a>
                <button class="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Mensaje</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Control de Asistencia</h3>
            <div class="space-y-4">
                ${asistencias.map(([aid, a], i) => {
                    const esTercera = i === 2;
                    const bloqueada = esTercera && pData && pData.faltante > 0;
                    const statusClass = a.tomada ? 'bg-green-500 text-white' : (bloqueada ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600');
                    return `
                    <div class="flex items-center justify-between border-b border-gray-50 pb-3">
                        <div>
                            <p class="font-bold text-sm">Clase ${i+1} (${i < 3 ? 'Base' : 'Extra'})</p>
                            <p class="text-[10px] text-gray-400">${a.tomada ? 'Tomada el: '+new Date(a.fechaTomada).toLocaleDateString() : 'Pendiente'}</p>
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

// Exponer también una función rápida para abrir perfil desde lista completa
window.app.openQuickProfile = async (id) => openProfile(id);

// función para marcar asistencia
window.app.checkIn = async (aluId, aid) => {
    await update(ref(db, `asistencias/${aluId}/${aid}`), { tomada: true, fechaTomada: new Date().toISOString() });
    alert("Asistencia marcada");
    // volver a dashboard/profile (según UI)
    // cerramos la vista actual y refrescamos datos
    window.app.changeView('dashboard-view');
    refreshData();
};

// --- PAGOS LOGIC ---
document.getElementById('concepto').addEventListener('change', async (e) => {
    const c = e.target.value;
    const aluInput = document.getElementById('pago-alumno-id');
    const aluSelect = document.getElementById('pago-alumno-select');
    const alu = aluInput?.value || (aluSelect?.value || '');
    
    document.getElementById('pago-id-container').classList.add('hidden');
    document.getElementById('extra-classes-container').classList.add('hidden');

    if ((c === 'pago_parcial' || c === 'clases_extra') && alu) {
        const snap = await get(ref(db, 'pagos_tipo_a'));
        const selId = document.getElementById('pago-id-select');
        selId.innerHTML = '<option value="">Seleccionar ID Activo</option>';
        
        if (snap.exists()) {
            const hoy = new Date();
            Object.entries(snap.val()).forEach(([k, p]) => {
                const esActivo = new Date(p.fechaVencimiento) > hoy;
                const tieneDeuda = (p.faltante || 0) > 0;

                // REGLA 1: Pago Parcial -> Solo activos con deuda
                if (c === 'pago_parcial' && p.alumnoId === alu && esActivo && tieneDeuda) {
                    selId.innerHTML += `<option value="${k}">ID: ${k.slice(-6)} (Adeudo: $${p.faltante})</option>`;
                    document.getElementById('pago-id-container').classList.remove('hidden');
                }
                // REGLA 2: Clases Extra -> Solo activos sin deuda
                else if (c === 'clases_extra' && p.alumnoId === alu && esActivo && !tieneDeuda) {
                    selId.innerHTML += `<option value="${k}">ID: ${k.slice(-6)} (Pagado)</option>`;
                    document.getElementById('pago-id-container').classList.remove('hidden');
                }
            });
        }
        if (c === 'clases_extra') document.getElementById('extra-classes-container').classList.remove('hidden');
    }
});

// Al enviar el formulario de pago soportamos: mensualidad, clases_extra, pago_parcial, y actividad_b
document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const c = document.getElementById('concepto').value;
    const alu = document.getElementById('pago-alumno-id').value || document.getElementById('pago-alumno-select')?.value;
    if (!alu) return alert('Selecciona un alumno antes de continuar.');
    const monto = parseFloat(document.getElementById('monto').value || '0');
    const faltante = parseFloat(document.getElementById('faltante').value || '0');
    const medio = document.getElementById('medio-pago')?.value || '';
    const observaciones = document.getElementById('observaciones')?.value || '';
    const fv = new Date(); fv.setDate(fv.getDate() + 30);

    try {
        if (c === 'mensualidad') {
            const pRef = push(ref(db, 'pagos_tipo_a'));
            await set(pRef, { alumnoId: alu, monto, faltante, concepto: c,fechaCreacion: new Date().toISOString(), fechaVencimiento: fv.toISOString(), clasesExtra: 0, medioPago: medio, observaciones });
            for(let i=0; i<3; i++) push(ref(db, `asistencias/${alu}`), { pagoId: pRef.key, tomada: false });
        } else if (c === 'clases_extra') {
            const pId = document.getElementById('pago-id-select').value;
            if (!pId) {
                alert('Este alumno no tiene un ID de mensualidad activa y pagada para añadir clases extra.');
                return; // Detiene la ejecución
            }
            // Obtenemos el número de clases del input correcto (asegúrate que el ID sea num-clases-extra)
            const num = parseInt(document.getElementById('num-clases-extra').value || '1');
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            try {
                    const pSnap = await get(pRef);
                    if (!pSnap.exists()) throw new Error("El ID de pago no existe");
            
                    const pData = pSnap.val();
            
                    // 1. Actualizamos el ID de pago sumando el monto y las clases
                    await update(pRef, { 
                        monto: (parseFloat(pData.monto) || 0) + monto, 
                        clasesExtra: (pData.clasesExtra || 0) + num,
                        observaciones: (pData.observaciones || '') + `\n[+${num} Clases Extra]` 
                    });
                
                    // 2. Sumamos al contador del ALUMNO (para que se vea en el dashboard)
                    const aluRef = ref(db, `alumnos/${alu}`);
                    const aluSnap = await get(aluRef);
                    if (aluSnap.exists()) {
                        const disponibles = aluSnap.val().clasesDisponibles || 0;
                        await update(aluRef, { clasesDisponibles: disponibles + num });
                    }
                
                    // 3. Generamos las asistencias extras
                    for(let i=0; i<num; i++) {
                        await push(ref(db, `asistencias/${alu}`), { 
                            pagoId: pId, 
                            tomada: false, 
                            tipo: 'extra' 
                        });
                    }
                    
                    alert('Clases extra añadidas correctamente ✓');
                
                } catch (error) {
                    console.error("Error en clases extra:", error);
                    alert("Hubo un error al procesar las clases extra.");
                }
        } else if (c === 'pago_parcial') {
            const pId = document.getElementById('pago-id-select').value;
            if (!pId) return alert('Selecciona un ID de pago activo.');
            const pSnap = await get(ref(db, `pagos_tipo_a/${pId}`));
            if (pSnap.exists()) {
                const nuevoFaltante = Math.max(0, pSnap.val().faltante - monto);
                await update(ref(db, `pagos_tipo_a/${pId}`), {
                    faltante: nuevoFaltante
                });
            const abonoRef = push(ref(db, `historial_abonos/${pId}`));
            await set(abonoRef, { monto, fecha: new Date().toISOString(), medioPago: medio });
            }
        // Dentro de register-pago-form submit, localiza el bloque else if (c === 'actividad_b')
        } else if (c === 'actividad_b') {
            const pRef = push(ref(db, 'pagos_tipo_b'));
            const payload = {
                alumnoId: alu,
                monto: monto,
                faltante: faltante, // <-- Cambio: Ahora guarda el faltante
                concepto: 'actividad_b',
                fecha: new Date().toISOString(),
                medioPago: medio,
                observaciones: observaciones,
                descripcion: 'Actividad Extra Tipo B'
            };
            await set(pRef, payload);
        } else {
            return alert('Concepto no soportado.');
        }
        alert("Pago procesado ✓");
        window.app.changeView('dashboard-view');
        refreshData();
    } catch (err) {
        alert(err.message || err);
    }
});

// --- HELPER REGISTRO ALUMNO ---
document.getElementById('is-adult')?.addEventListener('change', e => document.getElementById('tutor-section').classList.toggle('hidden', e.target.checked));
document.getElementById('add-student-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const s = {
        nombre: document.getElementById('new-name').value,
        apellidos: document.getElementById('new-lastname').value,
        contacto: document.getElementById('new-contact').value,
        esMayor: document.getElementById('is-adult')?.checked || false,
        tutor: { nombre: document.getElementById('tutor-name')?.value || '', telefono: document.getElementById('tutor-phone')?.value || '' }
    };
    const p = push(ref(db, 'alumnos'));
    await set(p, s);
    alert("Inscripción exitosa");
    window.app.hideModal('modal-alumno');
    refreshData();
});

// Sugerencias para pago (nueva) y select clásico (compatibilidad)
function populateAlumnoSuggestions() {
    onValue(ref(db, 'alumnos'), snap => {
        const suggestions = document.getElementById('pago-alumno-suggestions');
        suggestions.innerHTML = '';
        if (snap.exists()) {
            Object.entries(snap.val()).forEach(([id, s]) => {
                const chip = document.createElement('button');
                chip.className = 'bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700';
                chip.textContent = `${s.nombre} ${s.apellidos || ''}`;
                chip.onclick = () => {
                    document.getElementById('pago-alumno-search').value = chip.textContent;
                    document.getElementById('pago-alumno-id').value = id;
                };
                suggestions.appendChild(chip);
            });
        }
    });
}

// Compatibilidad: llenar select 'pago-alumno-select' como en la versión base
function populateAlumnoSelect() {
    onValue(ref(db, 'alumnos'), snap => {
        const sel = document.getElementById('pago-alumno-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccione alumno</option>';
        if (snap.exists()) Object.entries(snap.val()).forEach(([id, s]) => sel.innerHTML += `<option value="${id}">${s.nombre} ${s.apellidos || ''}</option>`);
    });
}

// inicializar refresh al cargar el script por si ya hay sesión
refreshData();
