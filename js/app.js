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

// Global App Control
window.app = {
    showModal: id => document.getElementById(id).classList.remove('hidden-view'),
    hideModal: id => document.getElementById(id).classList.add('hidden-view'),
    closeProfile: () => {
        document.getElementById('profile-view').classList.add('hidden-view');
        document.getElementById('dashboard-view').classList.remove('hidden-view');
    }
};

// --- AUTH & LOAD ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.getElementById('dashboard-view').classList.remove('hidden-view');
        loadActiveStudents();
        populateAlumnoSelect();
    } else {
        document.getElementById('login-view').classList.remove('hidden-view');
        document.getElementById('dashboard-view').classList.add('hidden-view');
    }
});

async function loadActiveStudents() {
    const [alumnosSnap, pagosSnap] = await Promise.all([
        get(ref(db, 'alumnos')),
        get(ref(db, 'pagos_tipo_a'))
    ]);

    const container = document.getElementById('students-list');
    container.innerHTML = '';

    if (alumnosSnap.exists() && pagosSnap.exists()) {
        const pagos = pagosSnap.val();
        const hoy = new Date();
        
        Object.entries(alumnosSnap.val()).forEach(([id, student]) => {
            const pagoActivo = Object.values(pagos).find(p => 
                p.alumnoId === id && new Date(p.fechaVencimiento) > hoy
            );

            if (pagoActivo) {
                const div = document.createElement('div');
                div.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-green-50";
                div.onclick = () => openStudentProfile(id, student, pagoActivo);
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700">${student.nombre[0]}</div>
                        <div>
                            <p class="font-bold">${student.nombre} ${student.apellidos}</p>
                            <p class="text-xs text-gray-500">ID Pago: ${pagoActivo.concepto.toUpperCase()}</p>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-gray-400">chevron_right</span>
                `;
                container.appendChild(div);
            }
        });
    }
}

// --- PROFILE & ATTENDANCE ---
async function openStudentProfile(alumnoId, student, pagoActivo) {
    window.app.showModal('profile-view');
    const content = document.getElementById('profile-content');
    content.innerHTML = `<p class="text-center py-10">Cargando perfil...</p>`;

    const asistenciaSnap = await get(ref(db, `asistencias/${alumnoId}`));
    const asistencias = asistenciaSnap.exists() ? Object.entries(asistenciaSnap.val()) : [];
    
    // Filtrar asistencias ligadas al ID de pago actual
    const misClases = asistencias.filter(([aid, a]) => a.pagoId === Object.keys(await get(ref(db, 'pagos_tipo_a'))).find(key => JSON.stringify(await get(ref(db, `pagos_tipo_a/${key}`))) === JSON.stringify(pagoActivo)));

    content.innerHTML = `
        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center">
            <div class="size-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-4xl font-bold mb-4">${student.nombre[0]}</div>
            <h2 class="text-2xl font-bold">${student.nombre} ${student.apellidos}</h2>
            <p class="text-primary font-medium">Activo hasta: ${new Date(pagoActivo.fechaVencimiento).toLocaleDateString()}</p>
            <div class="flex gap-4 mt-4 w-full">
                <a href="tel:${student.contacto}" class="flex-1 bg-primary/10 text-primary p-3 rounded-xl flex items-center justify-center gap-2 font-bold"><span class="material-symbols-outlined">call</span> Llamar</a>
                <button class="flex-1 bg-accent/10 text-accent p-3 rounded-xl flex items-center justify-center gap-2 font-bold"><span class="material-symbols-outlined">message</span> Mensaje</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="font-bold text-gray-400 text-xs uppercase mb-4 tracking-widest">Control de Asistencia</h3>
            <div class="space-y-3">
                ${renderAttendance(alumnoId, pagoActivo, asistencias)}
            </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h3 class="font-bold text-gray-400 text-xs uppercase mb-4 tracking-widest">Estado de Cuenta</h3>
            <div class="flex justify-between items-center">
                <span>Pendiente por pagar:</span>
                <span class="font-bold ${pagoActivo.faltante > 0 ? 'text-red-500' : 'text-green-500'}">$${pagoActivo.faltante}</span>
            </div>
        </div>
    `;
}

function renderAttendance(alumnoId, pagoActivo, asistencias) {
    // Filtrar solo las clases que pertenecen a la mensualidad actual
    // (En un sistema real, usaríamos el KEY del pago, aquí simplificamos buscando el ID)
    let html = '';
    const hoy = new Date();
    const vencido = new Date(pagoActivo.fechaVencimiento) < hoy;

    asistencias.forEach(([id, a], index) => {
        // Regla 1: Bloquear 3ra clase si hay faltante
        const esTerceraBase = index === 2;
        const bloqueadaPorFaltante = esTerceraBase && pagoActivo.faltante > 0;
        
        const statusClass = a.tomada ? 'bg-green-500 text-white' : (bloqueadaPorFaltante ? 'bg-gray-100 text-gray-400' : 'bg-white border-2 border-gray-100');
        const btnText = a.tomada ? 'Tomada ✓' : (bloqueadaPorFaltante ? 'Bloqueada ($)' : 'Marcar Asist.');
        const btnAction = (!a.tomada && !bloqueadaPorFaltante && !vencido) ? `onclick="window.app.takeClass('${alumnoId}', '${id}')"` : '';

        html += `
            <div class="flex items-center justify-between p-3 rounded-xl border border-gray-50">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg flex flex-col items-center justify-center font-bold text-[10px] bg-gray-50">
                        <span>CLASE</span>
                        <span class="text-lg -mt-1">${index + 1}</span>
                    </div>
                    <div>
                        <p class="font-bold text-sm">${index < 3 ? 'Mensualidad' : 'Clase Extra'}</p>
                        <p class="text-xs text-gray-500">${a.tomada ? 'Tomada el: ' + new Date(a.fechaTomada).toLocaleDateString() : 'Pendiente'}</p>
                    </div>
                </div>
                <button ${btnAction} class="px-4 py-2 rounded-lg text-xs font-bold transition ${statusClass}">
                    ${btnText}
                </button>
            </div>
        `;
    });
    return html;
}

window.app.takeClass = async (alumnoId, asistenciaId) => {
    await update(ref(db, `asistencias/${alumnoId}/${asistenciaId}`), {
        tomada: true,
        fechaTomada: new Date().toISOString()
    });
    alert("Asistencia registrada");
    window.app.closeProfile(); // Recargar
};

// --- PAYMENTS LOGIC ---
document.getElementById('register-pago-form').addEventListener('submit', async e => {
    e.preventDefault();
    const concepto = document.getElementById('concepto').value;
    const alumnoId = document.getElementById('pago-alumno-select').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const faltante = parseFloat(document.getElementById('faltante').value || 0);

    const fechaC = new Date();
    const fechaV = new Date();
    fechaV.setDate(fechaC.getDate() + 30);

    try {
        if (concepto === 'mensualidad') {
            const pagoRef = push(ref(db, 'pagos_tipo_a'));
            await set(pagoRef, { alumnoId, monto, faltante, concepto, fechaCreacion: fechaC.toISOString(), fechaVencimiento: fechaV.toISOString(), clasesExtra: 0 });
            
            // Generar 3 clases base
            for(let i=0; i<3; i++) {
                push(ref(db, `asistencias/${alumnoId}`), { pagoId: pagoRef.key, tomada: false, fechaFin: fechaV.toISOString() });
            }
        } 
        else if (concepto === 'clases_extra') {
            const numExtras = parseInt(document.getElementById('num-clases-extra').value);
            // Lógica para buscar el ID de pago Tipo A activo y sumarle asistencias
            // (Para brevedad, asumimos que seleccionó el ID en el dropdown)
            const pagoId = document.getElementById('pago-id-select').value;
            for(let i=0; i<numExtras; i++) {
                push(ref(db, `asistencias/${alumnoId}`), { pagoId: pagoId, tomada: false, fechaFin: fechaV.toISOString() });
            }
        }
        
        alert("Pago y clases procesadas");
        window.location.reload();
    } catch (err) { alert(err.message); }
});

// Helpers para Selects
function populateAlumnoSelect() {
    onValue(ref(db, 'alumnos'), snap => {
        const select = document.getElementById('pago-alumno-select');
        select.innerHTML = '<option>Seleccionar Alumno</option>';
        if (snap.exists()) {
            Object.entries(snap.val()).forEach(([id, s]) => {
                select.innerHTML += `<option value="${id}">${s.nombre} ${s.apellidos}</option>`;
            });
        }
    });
}
