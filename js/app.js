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
        ['dashboard-view', 'alumnos-view', 'pagos-view', 'ajustes-view', 'profile-view', 'finanzas-view'].forEach(v => 
            document.getElementById(v)?.classList.add('hidden-view')
        );
        // aceptar tanto 'dashboard' como 'dashboard-view' por compatibilidad
        const target = document.getElementById(view) || document.getElementById(view + '-view') || document.getElementById(view.replace('-view', ''));
        if (target) target.classList.remove('hidden-view');

        // actualizar nav visual
        document.querySelectorAll('.nav-btn').forEach(b => {
            const navKey = b.dataset.nav;
            const activeKey = (view.includes('-') ? view.split('-')[0] : view.replace('-view', ''));
            b.classList.toggle('text-accent', navKey === activeKey);
            b.classList.toggle('text-gray-400', navKey !== activeKey);
        });
        if(view === 'finanzas-view') {
            const mesSel = document.getElementById('finanzas-mes');
            const anioSel = document.getElementById('finanzas-anio');
            
            // Solo cargamos si los selectores ya tienen valores
            if(mesSel && anioSel && mesSel.value !== "") {
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
    initFinanzasFilters();
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
// Función para cerrar IDs vencidos
async function procesarCierresAutomaticos() {
    const pagosSnap = await get(ref(db, 'pagos_tipo_a'));
    if (!pagosSnap.exists()) return;

    const hoy = new Date();
    const pagos = pagosSnap.val();
    const actualizaciones = {};

    for (const [id, p] of Object.entries(pagos)) {
        const fechaVence = new Date(p.fechaVencimiento);
        // Si ya venció y NO está marcado como cerrado
        if (fechaVence < hoy && !p.cerrado) {
            actualizaciones[`pagos_tipo_a/${id}/cerrado`] = true;
            actualizaciones[`pagos_tipo_a/${id}/fechaCierre`] = p.fechaVencimiento;

            // Marcar todas sus asistencias pendientes como "tomadas" por cierre
            const asistSnap = await get(ref(db, `asistencias/${p.alumnoId}`));
            if (asistSnap.exists()) {
                Object.entries(asistSnap.val()).forEach(([aid, a]) => {
                    if (a.pagoId === id && !a.tomada) {
                        actualizaciones[`asistencias/${p.alumnoId}/${aid}/tomada`] = true;
                        actualizaciones[`asistencias/${p.alumnoId}/${aid}/fechaTomada`] = p.fechaVencimiento;
                        actualizaciones[`asistencias/${p.alumnoId}/${aid}/nota`] = "Cierre automático por vencimiento";
                    }
                });
            }
        }
    }
    if (Object.keys(actualizaciones).length > 0) {
        await update(ref(db), actualizaciones);
        console.log("Cierres procesados");
    }
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

function resetPagoForm() {
    const form = document.getElementById('register-pago-form');
    if (form) form.reset();

    // Limpieza manual de estados
    document.getElementById('pago-alumno-id').value = '';
    document.getElementById('pago-id-container')?.classList.add('hidden');
    document.getElementById('extra-classes-container')?.classList.add('hidden');
    document.getElementById('tipo-b-logic')?.classList.add('hidden');
    document.getElementById('seccion-alumno-pago')?.classList.remove('hidden');
    document.getElementById('faltante').disabled = false;
    document.getElementById('select-id-b').classList.add('hidden');

    const selId = document.getElementById('pago-id-select');
    if (selId) selId.innerHTML = '<option value="">Seleccionar ID...</option>';
}

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
            <p class="text-xs text-gray-500 mb-4">ID Pago: ${pKey ? '#' + pKey.slice(-6) : '-'}</p>
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
async function cargarFinanzas(mes, anio) {
    await procesarCierresAutomaticos(); // Asegurar datos actualizados

    const [pagosASnap, pagosBSnap] = await Promise.all([
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'pagos_tipo_b'))
    ]);

    let ingresosReales = 0;
    let deudaTotal = 0;
    let sumMensualidades = 0;
    let sumClasesExtra = 0;
    let sumTipoB = 0;

    const container = document.getElementById('lista-historial-finanzas');
    container.innerHTML = '';

    // Procesar Pagos Tipo A (Mensualidades y Clases Extra)
// ... dentro de cargarFinanzas ...
    if (pagosASnap.exists()) {
        Object.entries(pagosASnap.val()).forEach(([id, p]) => {
            const fCierre = p.fechaCierre ? new Date(p.fechaCierre) : null;
            const fCreacion = new Date(p.fechaCreacion);

            // 1. Mensualidades CERRADAS
            if (p.cerrado && fCierre && fCierre.getMonth() == mes && fCierre.getFullYear() == anio) {
                ingresosReales += p.monto;
                deudaTotal += (p.faltante || 0);
                sumMensualidades += p.monto;
                renderFinanzaItem(container, `ID: ${id.slice(-6)}`, p.monto, p.faltante, 'Mensualidad', 'event_available');
            }

            // 2. Clases Extra (se cuentan por fecha de creación del pago, o podrías usar la fecha del abono)
            if (p.clasesExtra > 0 && fCreacion.getMonth() == mes && fCreacion.getFullYear() == anio) {
                sumClasesExtra += (p.clasesExtra * 100); // Ejemplo: $100 por clase
            }
        });
    }
    // ... actualizar el resto de los elementos de la UI ...
    document.getElementById('res-clases-extra').textContent = `$${sumClasesExtra.toFixed(2)}`;

    // Procesar Pagos Tipo B (Actividades Extra)
    if (pagosBSnap.exists()) {
        Object.entries(pagosBSnap.val()).forEach(([id, b]) => {
            const fCreacion = new Date(b.fechaCreacion || b.fecha);
            if (fCreacion.getMonth() == mes && fCreacion.getFullYear() == anio) {
                ingresosReales += b.monto;
                deudaTotal += (b.faltante || 0);
                sumTipoB += b.monto;

                renderFinanzaItem(container, id, b.monto, b.faltante, 'Actividad B', 'Palette');
            }
        });
    }

    // Actualizar UI del Dashboard de Finanzas
    document.getElementById('total-ingresos').textContent = `$${ingresosReales.toFixed(2)}`;
    document.getElementById('total-deuda').textContent = `$${deudaTotal.toFixed(2)}`;
    document.getElementById('res-mensualidades').textContent = `$${sumMensualidades.toFixed(2)}`;
    document.getElementById('res-tipo-b').textContent = `$${sumTipoB.toFixed(2)}`;
}

function renderFinanzaItem(container, titulo, monto, deuda, sub, icono) {
    const div = document.createElement('div');
    div.className = "bg-white p-3 rounded-xl flex items-center justify-between border-b";
    div.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-gray-400">${icono}</span>
            <div>
                <p class="font-bold text-sm">${titulo}</p>
                <p class="text-[10px] text-gray-500">${sub}</p>
            </div>
        </div>
        <div class="text-right">
            <p class="text-sm font-bold text-green-600">+$${monto}</p>
            ${deuda > 0 ? `<p class="text-[10px] text-red-500">Debe: $${deuda}</p>` : ''}
        </div>
    `;
    container.appendChild(div);
}
// --- INICIALIZADOR DE FILTROS DE FINANZAS ---
function initFinanzasFilters() {
    const mesSel = document.getElementById('finanzas-mes');
    const anioSel = document.getElementById('finanzas-anio');
    
    // Si los elementos no existen en el HTML aún, salimos para evitar error
    if(!mesSel || !anioSel) return;

    // Limpiamos por si acaso
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

    // Escuchar cambios para actualizar la vista automáticamente
    [mesSel, anioSel].forEach(el => el.addEventListener('change', () => {
        cargarFinanzas(mesSel.value, anioSel.value);
    }));
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
// --- NUEVA LÓGICA DE CONCEPTOS Y TIPO B ---
document.getElementById('concepto').addEventListener('change', async (e) => {
    const concepto = e.target.value;
    const aluId = document.getElementById('pago-alumno-id').value;
    const pIdContainer = document.getElementById('pago-id-container');
    const extraContainer = document.getElementById('extra-classes-container');
    const selId = document.getElementById('pago-id-select');

    // Elementos nuevos para Actividad B
    const seccionAlumno = document.getElementById('seccion-alumno-pago');
    const tipoBLogic = document.getElementById('tipo-b-logic');

    // Reset general de vistas
    pIdContainer.classList.add('hidden');
    if (extraContainer) extraContainer.classList.add('hidden');
    tipoBLogic.classList.add('hidden');
    seccionAlumno.classList.remove('hidden');
    selId.innerHTML = '<option value="">Seleccionar ID...</option>';

    // REGLA: Si es Actividad B, ocultamos la sección del alumno
    if (concepto === 'actividad_b') {
        seccionAlumno.classList.add('hidden');
        tipoBLogic.classList.remove('hidden');
        return; // Salimos porque no requiere validación de alumno
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
            selId.innerHTML = `<option value="${id}" selected>ID: ${id.slice(-6)} (Debe: $${faltante})</option>`;
            selId.value = id;
            pIdContainer.classList.remove('hidden');
        } else if (concepto === 'pago_parcial' && faltante <= 0) {
            alert('Este alumno ya liquidó su mensualidad.');
            e.target.value = '';
        } else if (concepto === 'clases_extra' && faltante <= 0) {
            selId.innerHTML = `<option value="${id}" selected>ID: ${id.slice(-6)} (Pagado ✓)</option>`;
            pIdContainer.classList.remove('hidden');
            if (extraContainer) extraContainer.classList.remove('hidden');
        } else if (concepto === 'clases_extra' && faltante > 0) {
            alert('Debe liquidar el faltante antes de añadir clases extra.');
            e.target.value = '';
        }
    } else if ((concepto === 'pago_parcial' || concepto === 'clases_extra') && !pagoActivoEncontrado) {
        alert('No se encontró mensualidad activa.');
        e.target.value = '';
    }
});

// Lógica para el checkbox de Abono Tipo B
document.getElementById('es-abono-b')?.addEventListener('change', (e) => {
    const isAbono = e.target.checked;
    const searchCont = document.getElementById('search-b-container');
    const faltanteInput = document.getElementById('faltante');

    if (isAbono) {
        searchCont.classList.remove('hidden');
        faltanteInput.value = '0';
        faltanteInput.disabled = true; // Bloqueado por regla 3
    } else {
        searchCont.classList.add('hidden');
        faltanteInput.disabled = false;
        faltanteInput.value = '';
    }
});

// Buscador de Folios ACT-EXT
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
                select.classList.remove('hidden');
                found.forEach(([id, data]) => {
                    select.innerHTML += `<option value="${id}">${id} (Debe: $${data.faltante})</option>`;
                });
            } else {
                alert("No se encontró el folio o ya no tiene deuda.");
            }
        }
    }
});
document.getElementById('register-pago-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const target = e.target;
        if (target.tagName === 'INPUT') {
            e.preventDefault(); // Solo evita que el formulario se envíe solo
            // Si terminaste de escribir el nombre, salta al monto
            if(target.id === 'pago-alumno-search') {
                document.getElementById('monto').focus();
            }
        }
    }
});
// Al enviar el formulario de pago soportamos: mensualidad, clases_extra, pago_parcial, y actividad_b
// --- ACTUALIZACIÓN FINAL DEL GUARDADO (SUBMIT) ---
document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const c = document.getElementById('concepto').value;
    const monto = parseFloat(document.getElementById('monto').value || '0');
    const faltante = parseFloat(document.getElementById('faltante').value || '0');
    const medio = document.getElementById('medio-pago')?.value || '';
    const observaciones = document.getElementById('observaciones')?.value || '';

    // REGLA: Si no es Actividad B, validamos que exista un Alumno seleccionado
    let alu = null;
    if (c !== 'actividad_b') {
        alu = document.getElementById('pago-alumno-id').value || document.getElementById('pago-alumno-select')?.value;
        if (!alu) return alert('Selecciona un alumno antes de continuar.');
    }

    try {
        if (c === 'mensualidad') {
            const fv = new Date(); fv.setDate(fv.getDate() + 30);
            const pRef = push(ref(db, 'pagos_tipo_a'));
            await set(pRef, { alumnoId: alu, monto, faltante, concepto: c, fechaCreacion: new Date().toISOString(), fechaVencimiento: fv.toISOString(), clasesExtra: 0, medioPago: medio, observaciones });
            for (let i = 0; i < numClasesBase; i++) {
                await push(ref(db, `asistencias/${alu}`), { 
                    pagoId: pRef.key, 
                    tomada: false,
                    tipo: 'base' 
                });
            }
            alert(`Mensualidad de ${numClasesBase} clases registrada.`);

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
                for (let i = 0; i < num; i++) push(ref(db, `asistencias/${alu}`), { pagoId: pId, tomada: false, tipo: 'extra' });
            }

            } else if (c === 'pago_parcial') {
            // 1. Intentamos obtener el ID del select
            let pId = document.getElementById('pago-id-select').value;

            // 2. RED DE SEGURIDAD: Si por alguna razón el select está vacío, lo buscamos manualmente
            if (!pId) {
                const aluId = document.getElementById('pago-alumno-id').value || document.getElementById('pago-alumno-select')?.value;
                const snap = await get(ref(db, 'pagos_tipo_a'));
                const hoy = new Date();
                const encontrado = Object.entries(snap.val() || {}).find(([id, p]) => 
                    p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy
                );
                if (encontrado) {
                    pId = encontrado[0];
                }
            }

            // 3. Si después de la red de seguridad sigue vacío, avisamos
            if (!pId) return alert('No se pudo encontrar un ID de pago activo para este alumno.');

            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pSnap = await get(pRef);

            if (pSnap.exists()) {
                const actualFaltante = parseFloat(pSnap.val().faltante || 0);
                const abono = parseFloat(monto);
                const nuevoFaltante = Math.max(0, actualFaltante - abono);

                // Actualizamos el faltante en el registro principal del pago
                await update(pRef, { 
                    faltante: nuevoFaltante,
                    // Agregamos una nota en observaciones para saber que hubo abonos
                    observaciones: (pSnap.val().observaciones || '') + `\n[Abono: $${abono} - ${new Date().toLocaleDateString()}]`
                });

                // Guardamos el registro del abono en el historial
                await set(push(ref(db, `historial_abonos/${pId}`)), { 
                    monto: abono, 
                    fecha: new Date().toISOString(), 
                    medioPago: medio,
                    alumnoId: pSnap.val().alumnoId // Añadimos el ID del alumno para reportes futuros
                });

                alert("Abono registrado con éxito");
            }

            } else if (c === 'actividad_b') {
            const isAbono = document.getElementById('es-abono-b').checked;

            if (isAbono) {
                // Lógica de Abono a cuenta existente
                const pId = document.getElementById('select-id-b').value;
                if (!pId) return alert('Selecciona un Folio de Actividad B.');
                
                const pRef = ref(db, `pagos_tipo_b/${pId}`);
                const pSnap = await get(pRef);
                if (pSnap.exists()) {
                    const nuevoFaltante = Math.max(0, parseFloat(pSnap.val().faltante || 0) - monto);
                    await update(pRef, { 
                        faltante: nuevoFaltante,
                        observaciones: (pSnap.val().observaciones || '') + `\n[Abono: $${monto} - ${new Date().toLocaleDateString()}]`
                    });
                    alert("Abono a Actividad B registrado.");
                }
            } else {
                // Lógica de Nueva Actividad B
                const desc = document.getElementById('observaciones').value;
                if (!desc) return alert('Por favor describe la actividad en Observaciones.');
                
                await push(ref(db, 'pagos_tipo_b'), {
                    monto,
                    faltante,
                    descripcion: desc,
                    fecha: new Date().toISOString(),
                    fechaCreacion: new Date().toISOString(),
                    medioPago: medio,
                    alumnoId: document.getElementById('pago-alumno-id').value || "VENTA_GENERAL"
                });
                alert("Nueva Actividad B registrada.");
            }
        }

        // LIMPIEZA FINAL
        alert("¡Operación Exitosa!");
        resetPagoForm();
        window.app.changeView('dashboard-view');
        refreshData();

    } catch (error) {
        console.error(error);
        alert("Error al procesar el pago: " + error.message);
    }
});

        alert("¡Procesado con éxito! ✓");
        resetPagoForm(); // Esta función ya la actualizamos en el paso anterior
        window.app.changeView('dashboard-view');
        refreshData();
    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
});

// --- HELPER REGISTRO ALUMNO ---
document.getElementById('is-adult')?.addEventListener('change', e => document.getElementById('tutor-section').classList.toggle('hidden', e.target.checked));
document.getElementById('add-student-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    // Obtenemos los valores de los campos
    const nombre = document.getElementById('new-name').value;
    const apellidos = document.getElementById('new-lastname').value;
    const contacto = document.getElementById('new-contact').value;
    const esMayor = document.getElementById('is-adult')?.checked || false;

    // Creamos el objeto del alumno con el contador en 0
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

        // Limpiamos y cerramos
        window.app.hideModal('modal-alumno');
        document.getElementById('add-student-form').reset();
        refreshData();
    } catch (error) {
        console.error("Error al inscribir:", error);
        alert("Hubo un error al guardar al alumno.");
    }
});

// Sugerencias para pago (nueva) y select clásico (compatibilidad)
// Localiza esta parte en tu código:
function populateAlumnoSuggestions() {
    const searchInput = document.getElementById('pago-alumno-search');
    const suggestionsContainer = document.getElementById('alumno-suggestions');
    if (!searchInput || !suggestionsContainer) return;

    searchInput.addEventListener('input', async (e) => {
        const term = e.target.value.toLowerCase();
        if (term.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }

        const snap = await get(ref(db, 'alumnos'));
        const alumnos = snap.val() || {};
        
        const filtrados = Object.entries(alumnos).filter(([id, s]) => 
            `${s.nombre} ${s.apellidos || ''}`.toLowerCase().includes(term)
        );

        suggestionsContainer.innerHTML = filtrados.map(([id, s]) => `
            <div class="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b" 
                 onclick="window.app.selectAlumnoPago('${id}', '${s.nombre} ${s.apellidos || ''}')">
                ${s.nombre} ${s.apellidos || ''}
            </div>
        `).join('');
    });
}

// Función para seleccionar al alumno de la lista
window.app.selectAlumnoPago = (id, nombreCompleto) => {
    document.getElementById('pago-alumno-id').value = id;
    document.getElementById('pago-alumno-search').value = nombreCompleto;
    document.getElementById('alumno-suggestions').innerHTML = '';
    // Disparamos el cambio de concepto para que busque mensualidades pendientes de este alumno
    document.getElementById('concepto').dispatchEvent(new Event('change'));
};

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
