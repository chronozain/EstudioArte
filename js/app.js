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

// --- CONTROLADOR GLOBAL ---
window.app = {
    showModal: id => document.getElementById(id)?.classList.remove('hidden-view'),
    hideModal: id => document.getElementById(id)?.classList.add('hidden-view'),
    closeProfile: () => {
        document.getElementById('profile-view').classList.add('hidden-view');
        document.getElementById('dashboard-view').classList.remove('hidden-view');
    }
};

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, user => {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    if (user) {
        loginView.classList.add('hidden-view');
        dashboardView.classList.remove('hidden-view');
        loadActiveStudents();
        populateAlumnoSelect();
    } else {
        loginView.classList.remove('hidden-view');
        dashboardView.classList.add('hidden-view');
    }
});

document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorDiv.classList.add('hidden');
    } catch (err) {
        errorDiv.textContent = "Error: Acceso denegado.";
        errorDiv.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- DASHBOARD: ALUMNOS ACTIVOS ---
function loadActiveStudents() {
    onValue(ref(db, 'alumnos'), async (alumnosSnap) => {
        const studentsList = document.getElementById('students-list');
        studentsList.innerHTML = '';
        if (!alumnosSnap.exists()) return;

        const pagosSnap = await get(ref(db, 'pagos_tipo_a'));
        const pagos = pagosSnap.exists() ? pagosSnap.val() : {};
        const hoy = new Date();

        Object.entries(alumnosSnap.val()).forEach(([id, student]) => {
            const pagoActivoKey = Object.keys(pagos).find(key => {
                const p = pagos[key];
                return p.alumnoId === id && new Date(p.fechaVencimiento) > hoy;
            });

            if (pagoActivoKey) {
                const card = document.createElement('div');
                card.className = "bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between cursor-pointer hover:bg-green-50 transition";
                card.onclick = () => openStudentProfile(id, student, pagoActivoKey, pagos[pagoActivoKey]);
                card.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="size-12 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700">${student.nombre[0]}</div>
                        <div>
                            <p class="font-bold text-slate-800">${student.nombre} ${student.apellidos}</p>
                            <p class="text-xs text-gray-500">Vence: ${new Date(pagos[pagoActivoKey].fechaVencimiento).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-gray-300">arrow_forward_ios</span>
                `;
                studentsList.appendChild(card);
            }
        });
    });
}

// --- PERFIL Y ASISTENCIA ---
async function openStudentProfile(alumnoId, student, pagoId, pagoData) {
    window.app.showModal('profile-view');
    const content = document.getElementById('profile-content');
    content.innerHTML = `<p class="text-center py-20 text-gray-400">Cargando...</p>`;

    // Obtener asistencias del alumno
    const asistSnap = await get(ref(db, `asistencias/${alumnoId}`));
    const todasAsistencias = asistSnap.exists() ? Object.entries(asistSnap.val()) : [];
    
    // Filtrar por el pagoId actual
    const clasesActuales = todasAsistencias.filter(([aid, a]) => a.pagoId === pagoId);
    
    // Auto-cierre de clases si el pago venció
    const hoy = new Date();
    const vencido = new Date(pagoData.fechaVencimiento) < hoy;

    content.innerHTML = `
        <div class="bg-white rounded-3xl p-8 shadow-sm flex flex-col items-center">
            <div class="size-24 rounded-full bg-green-100 flex items-center justify-center text-4xl font-bold text-green-700 mb-4">${student.nombre[0]}</div>
            <h2 class="text-2xl font-bold text-slate-800">${student.nombre} ${student.apellidos}</h2>
            <p class="text-green-600 font-medium">Socio Activo • ID ${pagoId.slice(-5)}</p>
            <div class="grid grid-cols-2 gap-4 mt-6 w-full">
                <a href="tel:${student.contacto}" class="bg-green-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold"><span class="material-symbols-outlined">call</span> Llamar</a>
                <button class="bg-blue-500 text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold"><span class="material-symbols-outlined">mail</span> Mensaje</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Control de Asistencia</h3>
            <div class="space-y-4">
                ${clasesActuales.map(([aid, a], index) => {
                    const esTercera = index === 2;
                    const bloqueada = (esTercera && pagoData.faltante > 0);
                    const btnClass = a.tomada ? 'bg-green-500 text-white' : (bloqueada ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600');
                    const label = a.tomada ? 'Tomada' : (bloqueada ? 'Bloqueada ($)' : 'Marcar');
                    
                    return `
                    <div class="flex items-center justify-between p-3 border-b border-gray-50">
                        <div class="flex items-center gap-3">
                            <div class="text-center bg-gray-50 p-2 rounded-lg min-w-[50px]">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Clase</p>
                                <p class="text-lg font-bold">${index + 1}</p>
                            </div>
                            <div>
                                <p class="font-bold text-sm">${index < 3 ? 'Base' : 'Extra'}</p>
                                <p class="text-xs text-gray-500">${a.tomada ? new Date(a.fechaTomada).toLocaleDateString() : 'Pendiente'}</p>
                            </div>
                        </div>
                        <button 
                            ${(!a.tomada && !bloqueada && !vencido) ? `onclick="window.app.marcarAsistencia('${alumnoId}', '${aid}')"` : ''}
                            class="px-6 py-2 rounded-xl font-bold text-xs ${btnClass}">
                            ${label}
                        </button>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-sm">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Finanzas del Periodo</h3>
            <div class="flex justify-between items-center py-2">
                <span class="text-gray-600">Saldo Faltante:</span>
                <span class="font-bold ${pagoData.faltante > 0 ? 'text-red-500' : 'text-green-500'}">$${pagoData.faltante}</span>
            </div>
            <div class="flex justify-between items-center py-2">
                <span class="text-gray-600">Vencimiento:</span>
                <span class="font-medium">${new Date(pagoData.fechaVencimiento).toLocaleDateString()}</span>
            </div>
        </div>
    `;
}

window.app.marcarAsistencia = async (alumnoId, asistId) => {
    try {
        await update(ref(db, `asistencias/${alumnoId}/${asistId}`), {
            tomada: true,
            fechaTomada: new Date().toISOString()
        });
        alert("Asistencia registrada ✓");
        window.app.closeProfile();
    } catch (e) { alert("Error al registrar"); }
};

// --- LOGICA DE PAGOS ---
const conceptoSelect = document.getElementById('concepto');
conceptoSelect.addEventListener('change', async () => {
    const val = conceptoSelect.value;
    const aluId = document.getElementById('pago-alumno-select').value;
    
    document.getElementById('pago-id-container').classList.add('hidden');
    document.getElementById('extra-classes-container').classList.add('hidden');

    if ((val === 'pago_parcial' || val === 'clases_extra') && aluId) {
        const snap = await get(ref(db, 'pagos_tipo_a'));
        const selectId = document.getElementById('pago-id-select');
        selectId.innerHTML = '<option value="">Seleccione ID Base</option>';
        
        if (snap.exists()) {
            const hoy = new Date();
            Object.entries(snap.val()).forEach(([kid, p]) => {
                if (p.alumnoId === aluId && new Date(p.fechaVencimiento) > hoy) {
                    const opt = document.createElement('option');
                    opt.value = kid;
                    opt.textContent = `ID: ${kid.slice(-6)} (Faltante: $${p.faltante})`;
                    selectId.appendChild(opt);
                    document.getElementById('pago-id-container').classList.remove('hidden');
                }
            });
        }
        if (val === 'clases_extra') document.getElementById('extra-classes-container').classList.remove('hidden');
    }
});

document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const concepto = conceptoSelect.value;
    const alumnoId = document.getElementById('pago-alumno-select').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const faltante = parseFloat(document.getElementById('faltante').value || 0);
    const fechaC = new Date();
    const fechaV = new Date();
    fechaV.setDate(fechaC.getDate() + 30);

    try {
        if (concepto === 'mensualidad') {
            const nuevoPagoRef = push(ref(db, 'pagos_tipo_a'));
            await set(nuevoPagoRef, { 
                alumnoId, monto, faltante, concepto, clasesExtra: 0,
                fechaCreacion: fechaC.toISOString(), 
                fechaVencimiento: fechaV.toISOString() 
            });
            // 3 clases base
            for(let i=0; i<3; i++) {
                push(ref(db, `asistencias/${alumnoId}`), { pagoId: nuevoPagoRef.key, tomada: false, fechaFin: fechaV.toISOString() });
            }
        } 
        else if (concepto === 'clases_extra') {
            const pId = document.getElementById('pago-id-select').value;
            const numE = parseInt(document.getElementById('num-clases-extra').value);
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pData = (await get(pRef)).val();

            await update(pRef, {
                monto: pData.monto + monto,
                clasesExtra: (pData.clasesExtra || 0) + numE
            });
            // Añadir asistencias extra
            for(let i=0; i<numE; i++) {
                push(ref(db, `asistencias/${alumnoId}`), { pagoId: pId, tomada: false, fechaFin: pData.fechaVencimiento });
            }
        }
        else if (concepto === 'pago_parcial') {
            const pId = document.getElementById('pago-id-select').value;
            const pRef = ref(db, `pagos_tipo_a/${pId}`);
            const pData = (await get(pRef)).val();
            await update(pRef, {
                monto: pData.monto + monto,
                faltante: Math.max(0, pData.faltante - monto)
            });
        }
        else if (concepto === 'actividad_extra') {
            await set(push(ref(db, 'pagos_tipo_b')), { monto, faltante, fecha: fechaC.toISOString(), obs: document.getElementById('observaciones').value });
        }

        alert("Transacción Exitosa ✓");
        window.app.hideModal('modal-pago');
        document.getElementById('register-pago-form').reset();
    } catch (err) { alert("Error: " + err.message); }
});

// --- REGISTRO DE ALUMNOS ---
document.getElementById('is-adult').addEventListener('change', e => {
    document.getElementById('tutor-section').classList.toggle('hidden', e.target.checked);
});

document.getElementById('add-student-form').addEventListener('submit', async e => {
    e.preventDefault();
    const alu = {
        nombre: document.getElementById('new-name').value,
        apellidos: document.getElementById('new-lastname').value,
        contacto: document.getElementById('new-contact').value,
        esMayor: document.getElementById('is-adult').checked,
        fechaRegistro: new Date().toISOString()
    };
    if (!alu.esMayor) {
        alu.tutor = { nombre: document.getElementById('tutor-name').value, tel: document.getElementById('tutor-phone').value };
    }
    await set(push(ref(db, 'alumnos')), alu);
    alert("Alumno registrado ✓");
    window.app.hideModal('modal-alumno');
    document.getElementById('add-student-form').reset();
});

function populateAlumnoSelect() {
    onValue(ref(db, 'alumnos'), snap => {
        const sel = document.getElementById('pago-alumno-select');
        sel.innerHTML = '<option value="">Seleccione alumno</option>';
        if (snap.exists()) {
            Object.entries(snap.val()).forEach(([id, s]) => {
                sel.innerHTML += `<option value="${id}">${s.nombre} ${s.apellidos}</option>`;
            });
        }
    });
}
