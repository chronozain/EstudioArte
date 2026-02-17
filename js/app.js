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
        ['dashboard-view', 'alumnos-view', 'pagos-view', 'ajustes-view', 'profile-view'].forEach(v => 
            document.getElementById(v)?.classList.add('hidden-view')
        );
        document.getElementById(view)?.classList.remove('hidden-view');
        
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('text-accent', b.dataset.nav === view.split('-')[0]);
            b.classList.toggle('text-gray-400', b.dataset.nav !== view.split('-')[0]);
        });
    },
    closeView: id => document.getElementById(id)?.classList.add('hidden-view'),
    editAlumno: async (id) => {
        const snap = await get(ref(db, `alumnos/${id}`));
        const s = snap.val();
        document.getElementById('edit-id').value = id;
        document.getElementById('edit-name').value = s.nombre;
        document.getElementById('edit-lastname').value = s.apellidos;
        document.getElementById('edit-contact').value = s.contacto;
        document.getElementById('edit-tutor-name').value = s.tutor?.nombre || '';
        document.getElementById('edit-tutor-phone').value = s.tutor?.telefono || '';
        document.getElementById('edit-avatar').textContent = s.nombre[0];
        window.app.showModal('modal-edit-alumno');
    },
    checkIn: async (aluId, aid) => {
        await update(ref(db, `asistencias/${aluId}/${aid}`), { tomada: true, fechaTomada: new Date().toISOString() });
        alert("Asistencia marcada");
        window.app.closeView('profile-view');
        refreshData();
    }
};

// --- AUTH ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.querySelector('nav').classList.remove('hidden-view');
        window.app.changeView('dashboard-view');
        refreshData();
    } else {
        document.getElementById('login-view').classList.remove('hidden-view');
        document.querySelector('nav').classList.add('hidden-view');
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
document.getElementById('toggle-password').addEventListener('click', () => {
    const pass = document.getElementById('password');
    const icon = document.getElementById('toggle-password');
    pass.type = pass.type === 'password' ? 'text' : 'password';
    icon.textContent = pass.type === 'password' ? 'visibility' : 'visibility_off';
});

// --- DATA REFRESH ---
function refreshData() {
    loadActiveStudents();
    loadFullStudents('');
    populateAlumnoSuggestions();
}

// 1. INICIO: ALUMNOS ACTIVOS (Con Info de Clases y Saldo)
async function loadActiveStudents() {
    const [aluSnap, pagosSnap, asistSnap] = await Promise.all([
        get(ref(db, 'alumnos')),
        get(ref(db, 'pagos_tipo_a')),
        get(ref(db, 'asistencias'))
    ]);

    const container = document.getElementById('active-students-list');
    container.innerHTML = '';
    if (!aluSnap.exists()) return;

    const hoy = new Date();
    const pagos = pagosSnap.val() || {};
    const asistencias = asistSnap.val() || {};

    Object.entries(aluSnap.val()).forEach(([id, s]) => {
        const pagoKey = Object.keys(pagos).find(k => pagos[k].alumnoId === id && new Date(pagos[k].fechaVencimiento) > hoy);
        
        if (pagoKey) {
            const p = pagos[pagoKey];
            const aluAsist = asistencias[id] ? Object.values(asistencias[id]).filter(a => a.pagoId === pagoKey) : [];
            const disponibles = aluAsist.filter(a => !a.tomada).length;
            const saldoTxt = p.faltante > 0 ? `<span class="text-red-500 font-bold">$${p.faltante}</span>` : `<span class="text-green-600 font-bold">Pagado ✓</span>`;

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer";
            card.onclick = () => openProfile(id, s, pagoKey, p);
            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">${s.nombre[0]}</div>
                    <div>
                        <p class="font-bold text-slate-800">${s.nombre} ${s.apellidos}</p>
                        <p class="text-xs text-gray-500">Clase Ejemplo</p>
                        <p class="text-xs text-gray-500">Vence: ${new Date(p.fechaVencimiento).toLocaleDateString()}</p>
                    </div>
                </div>
                <span class="${p.faltante > 0 ? 'text-red-500' : 'text-green-500 bg-green-100 px-2 py-1 rounded-full'} font-bold">$${p.faltante > 0 ? `-${p.faltante}` : 'Pagado'}</span>
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
            if (`${s.nombre} ${s.apellidos}`.toLowerCase().includes(filter.toLowerCase())) {
                const div = document.createElement('div');
                div.className = "bg-white p-4 rounded-2xl flex items-center justify-between border-b border-gray-50";
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">${s.nombre[0]}</div>
                        <div><p class="font-bold text-sm">${s.nombre} ${s.apellidos}</p><p class="text-xs text-gray-400">${s.contacto}</p></div>
                    </div>
                    <button onclick="window.app.editAlumno('${id}')" class="text-primary material-symbols-outlined">edit_square</button>
                `;
                container.appendChild(div);
            }
        });
    });
}

document.getElementById('search-alumno').addEventListener('input', e => loadFullStudents(e.target.value));

// --- FUNCIONES DE MODALES ---
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
    window.app.showModal('profile-view');
    const container = document.getElementById('profile-content');
    const asistSnap = await get(ref(db, `asistencias/${aluId}`));
    const asistencias = asistSnap.exists() ? Object.entries(asistSnap.val()).filter(a => a[1].pagoId === pKey) : [];

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center">
            <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-4">${s.nombre[0]}</div>
            <h2 class="text-xl font-bold">${s.nombre} ${s.apellidos}</h2>
            <p class="text-xs text-gray-500 mb-4">ID: #${pKey.slice(-6)}</p>
            <div class="flex gap-4 w-full">
                <a href="tel:${s.contacto}" class="flex-1 py-3 bg-primary text-white rounded-xl text-center font-bold">Llamar</a>
                <button class="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Mensaje</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Control de Asistencia</h3>
            <div class="space-y-4">
                ${asistencias.map(([aid, a], i) => {
                    const esTercera = i === 2;
                    const bloqueada = esTercera && pData.faltante > 0;
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
    `;
}

// --- PAGOS LOGIC ---
document.getElementById('concepto').addEventListener('change', async (e) => {
    const c = e.target.value;
    const alu = document.getElementById('pago-alumno-id').value;
    document.getElementById('pago-id-container').classList.add('hidden');
    document.getElementById('extra-classes-container').classList.add('hidden');

    if ((c === 'pago_parcial' || c === 'clases_extra') && alu) {
        const snap = await get(ref(db, 'pagos_tipo_a'));
        const selId = document.getElementById('pago-id-select');
        selId.innerHTML = '<option>Seleccionar ID Activo</option>';
        if (snap.exists()) {
            const hoy = new Date();
            Object.entries(snap.val()).forEach(([k, p]) => {
                if (p.alumnoId === alu && new Date(p.fechaVencimiento) > hoy) {
                    selId.innerHTML += `<option value="${k}">ID: ${k.slice(-6)} (Adeudo: $${p.faltante})</option>`;
                    document.getElementById('pago-id-container').classList.remove('hidden');
                }
            });
        }
        if (c === 'clases_extra') document.getElementById('extra-classes-container').classList.remove('hidden');
    }
});

document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const c = document.getElementById('concepto').value;
    const alu = document.getElementById('pago-alumno-id').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const faltante = parseFloat(document.getElementById('faltante').value || 0);
    const observaciones = document.getElementById('observaciones').value;
    const fv = new Date(); fv.setDate(fv.getDate() + 30);

    try {
        if (c === 'mensualidad') {
            const pRef = push(ref(db, 'pagos_tipo_a'));
            await set(pRef, { alumnoId: alu, monto, faltante, concepto: c, fechaVencimiento: fv.toISOString(), clasesExtra: 0, observaciones });
            for(let i=0; i<3; i++) push(ref(db, `asistencias/${alu}`), { pagoId: pRef.key, tomada: false });
        } else if (c === 'clases_extra') {
            const pId = document.getElementById('pago-id-select').value;
            const num = parseInt(document.getElementById('num-clases-extra').value);
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pData = (await get(pRef)).val();
            await update(pRef, { monto: pData.monto + monto, clasesExtra: (pData.clasesExtra || 0) + num, observaciones: (pData.observaciones || '') + '\n' + observaciones });
            for(let i=0; i<num; i++) push(ref(db, `asistencias/${alu}`), { pagoId: pId, tomada: false });
        } else if (c === 'pago_parcial') {
            const pId = document.getElementById('pago-id-select').value;
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pData = (await get(pRef)).val();
            await update(pRef, { monto: pData.monto + monto, faltante: Math.max(0, pData.faltante - monto), observaciones: (pData.observaciones || '') + '\n' + observaciones });
        }
        alert("Pago procesado ✓");
        window.app.changeView('dashboard-view');
        refreshData();
    } catch (e) { alert(e.message); }
});

// --- HELPER REGISTRO ALUMNO ---
document.getElementById('is-adult').addEventListener('change', e => document.getElementById('tutor-section').classList.toggle('hidden', e.target.checked));
document.getElementById('add-student-form').addEventListener('submit', async e => {
    e.preventDefault();
    const s = {
        nombre: document.getElementById('new-name').value,
        apellidos: document.getElementById('new-lastname').value,
        contacto: document.getElementById('new-contact').value,
        esMayor: document.getElementById('is-adult').checked,
        tutor: { nombre: document.getElementById('tutor-name').value, telefono: document.getElementById('tutor-phone').value }
    };
    await set(push(ref(db, 'alumnos')), s);
    alert("Inscripción exitosa");
    window.app.hideModal('modal-alumno');
    refreshData();
});

// Nueva función para sugerencias en pago
function populateAlumnoSuggestions() {
    onValue(ref(db, 'alumnos'), snap => {
        const suggestions = document.getElementById('pago-alumno-suggestions');
        suggestions.innerHTML = '';
        if (snap.exists()) {
            Object.entries(snap.val()).forEach(([id, s]) => {
                const chip = document.createElement('button');
                chip.className = 'bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700';
                chip.textContent = `${s.nombre} ${s.apellidos}`;
                chip.onclick = () => {
                    document.getElementById('pago-alumno-search').value = chip.textContent;
                    document.getElementById('pago-alumno-id').value = id;
                };
                suggestions.appendChild(chip);
            });
        }
    });
}
