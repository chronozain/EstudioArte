// js/app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// ─── Configuración Firebase ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
  authDomain: "bd-personal-c3e4d.firebaseapp.com",
  databaseURL: "https://bd-personal-c3e4d-default-rtdb.firebaseio.com", // ← CAMBIA si es diferente
  projectId: "bd-personal-c3e4d",
  storageBucket: "bd-personal-c3e4d.firebasestorage.app",
  messagingSenderId: "739560517872",
  appId: "1:739560517872:web:8df36c57591b3220985235"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ─── Referencias DOM ───────────────────────────────────────────────
const loginView       = document.getElementById('login-view');
const dashboardView   = document.getElementById('dashboard-view');
const loginForm       = document.getElementById('login-form');
const loginError      = document.getElementById('login-error');
const logoutBtn       = document.getElementById('logout-btn');
const studentsList    = document.getElementById('students-list');

// Modal Alta Alumno (ya existente)
const addStudentForm  = document.getElementById('add-student-form');
const isAdultToggle   = document.getElementById('is-adult');
const tutorSection    = document.getElementById('tutor-section');

// Modal Registrar Pago (nuevo)
const modalPago       = document.getElementById('modal-pago');
const pagoForm        = document.getElementById('register-pago-form');
const conceptoSelect  = document.getElementById('concepto');
const alumnoContainer = document.getElementById('alumno-container');
const buscarAlumno    = document.getElementById('buscar-alumno');
const alumnosSugeridos= document.getElementById('alumnos-sugeridos');
const alumnoSeleccionado = document.getElementById('alumno-seleccionado');
const montoInput      = document.getElementById('monto');
const faltanteInput   = document.getElementById('faltante');
const faltanteContainer = document.getElementById('faltante-container');

// ─── Helpers ───────────────────────────────────────────────────────
window.app = {
  showModal: id => document.getElementById(id).classList.remove('hidden-view'),
  hideModal: id => document.getElementById(id).classList.add('hidden-view')
};

// ─── Auth ──────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    loginView.classList.add('hidden-view');
    dashboardView.classList.remove('hidden-view');
    loadStudents();
  } else {
    loginView.classList.remove('hidden-view');
    dashboardView.classList.add('hidden-view');
  }
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginError.classList.add('hidden');
  } catch (err) {
    loginError.textContent = "Credenciales inválidas.";
    loginError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// ─── Cargar Alumnos (para mostrar en dashboard) ────────────────────
function loadStudents() {
  const alumnosRef = ref(db, 'alumnos');
  studentsList.innerHTML = '<p class="text-center text-gray-500">Cargando...</p>';

  onValue(alumnosRef, snap => {
    studentsList.innerHTML = '';
    if (!snap.exists()) {
      studentsList.innerHTML = '<p class="text-center text-gray-500 py-8">No hay alumnos registrados.</p>';
      return;
    }
    const data = snap.val();
    Object.values(data).forEach(al => {
      const div = document.createElement('div');
      div.className = 'bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-center gap-3';
      div.innerHTML = `
        <div class="size-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
          ${al.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h4 class="font-semibold">${al.name} ${al.lastname || ''}</h4>
          <p class="text-sm text-gray-600">${al.contact}</p>
        </div>
      `;
      studentsList.appendChild(div);
    });
  });
}

// ─── Alta de Alumno (ya existente, solo recordatorio) ──────────────
if (addStudentForm) {
  addStudentForm.addEventListener('submit', async e => {
    e.preventDefault();
    // ... tu lógica actual de guardar alumno ...
    app.hideModal('modal-alumno');
    loadStudents();
  });
}

// ─── Toggle tutor en alta alumno ───────────────────────────────────
if (isAdultToggle) {
  isAdultToggle.addEventListener('change', () => {
    tutorSection.classList.toggle('hidden', isAdultToggle.checked);
  });
}

// ─── Lógica Modal Registrar Pago ───────────────────────────────────
let pagosActivosTipoA = []; // cache local para pagos tipo A activos
let alumnoSeleccionadoData = null;

// Cargar pagos tipo A activos al abrir modal
function cargarPagosActivos() {
  const pagosRef = ref(db, 'pagos_tipoA');
  onValue(pagosRef, snap => {
    pagosActivosTipoA = [];
    if (snap.exists()) {
      const now = Date.now();
      Object.entries(snap.val()).forEach(([id, p]) => {
        const creation = new Date(p.creationDate).getTime();
        const due = new Date(p.dueDate).getTime();
        if (now <= due && p.estatus === 'activa') {
          pagosActivosTipoA.push({ id, ...p });
        }
      });
    }
  });
}

// Abrir modal pago (puedes llamarlo desde botón en dashboard)
function abrirModalPago() {
  app.showModal('modal-pago');
  cargarPagosActivos();
  resetPagoForm();
}

// Reset form
function resetPagoForm() {
  conceptoSelect.value = '';
  montoInput.value = '0.00';
  faltanteInput.value = '0.00';
  faltanteContainer.classList.add('hidden');
  alumnoContainer.classList.add('hidden');
  alumnoSeleccionado.innerHTML = '';
  alumnoSeleccionado.classList.add('hidden');
  alumnoSeleccionadoData = null;
  buscarAlumno.value = '';
  alumnosSugeridos.innerHTML = '';
}

// Cambiar según concepto
conceptoSelect.addEventListener('change', () => {
  const val = conceptoSelect.value;
  resetPagoForm(); // limpia selecciones previas

  if (val === 'mensualidad') {
    alumnoContainer.classList.remove('hidden');
    faltanteContainer.classList.remove('hidden');
    faltanteInput.value = '0.00'; // por defecto
  } 
  else if (val === 'pago_parcial') {
    alumnoContainer.classList.remove('hidden');
    faltanteContainer.classList.remove('hidden');
    // solo mostrar alumnos con faltante > 0
  } 
  else if (val === 'clases_extra') {
    alumnoContainer.classList.remove('hidden');
    faltanteContainer.classList.add('hidden');
    // solo alumnos sin faltante
  } 
  else if (val === 'actividad_extra') {
    alumnoContainer.classList.add('hidden');
    faltanteContainer.classList.remove('hidden');
    faltanteInput.value = '0.00';
  }
});

// Buscar alumno (simulado con alumnos existentes)
buscarAlumno.addEventListener('input', async e => {
  const term = e.target.value.toLowerCase().trim();
  alumnosSugeridos.innerHTML = '';

  if (term.length < 2) return;

  const alumnosRef = ref(db, 'alumnos');
  const snap = await get(alumnosRef);
  if (!snap.exists()) return;

  const alumnos = snap.val();
  const matches = Object.values(alumnos).filter(a =>
    `${a.name} ${a.lastname || ''}`.toLowerCase().includes(term) ||
    a.contact.toLowerCase().includes(term)
  );

  matches.forEach(a => {
    const div = document.createElement('div');
    div.className = 'p-3 hover:bg-gray-100 cursor-pointer border-b last:border-none';
    div.innerHTML = `${a.name} ${a.lastname || ''} - ${a.contact}`;
    div.onclick = () => seleccionarAlumno(a);
    alumnosSugeridos.appendChild(div);
  });
});

function seleccionarAlumno(alumno) {
  alumnoSeleccionadoData = alumno;
  alumnoSeleccionado.innerHTML = `
    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
      ${alumno.name} ${alumno.lastname || ''} (${alumno.contact})
    </span>
  `;
  alumnoSeleccionado.classList.remove('hidden');
  buscarAlumno.value = '';
  alumnosSugeridos.innerHTML = '';

  // Si es pago parcial o clases extra → buscar pagos activos de este alumno
  const concepto = conceptoSelect.value;
  if (concepto === 'pago_parcial' || concepto === 'clases_extra') {
    const pagosAlumno = pagosActivosTipoA.filter(p => p.alumnoId === alumno.id); // asumimos que guardas alumnoId
    if (pagosAlumno.length > 0) {
      const ultimo = pagosAlumno[pagosAlumno.length - 1]; // el más reciente
      if (concepto === 'pago_parcial') {
        faltanteInput.value = ultimo.faltante || '0.00';
      } else {
        faltanteInput.value = '0.00';
      }
    }
  }
}

// Confirmar pago
pagoForm.addEventListener('submit', async e => {
  e.preventDefault();

  const concepto = conceptoSelect.value;
  const medio = document.getElementById('medio_pago').value;
  const monto = parseFloat(montoInput.value) || 0;
  const faltante = parseFloat(faltanteInput.value) || 0;
  const obs = document.getElementById('observaciones').value.trim();

  if (monto <= 0) {
    alert("El monto debe ser mayor a 0.");
    return;
  }

  let path = '';
  let data = {
    concepto,
    medio,
    monto,
    fecha: new Date().toISOString(),
    observaciones: obs,
    registradoPor: auth.currentUser?.uid || 'unknown'
  };

  if (concepto === 'mensualidad') {
    if (!alumnoSeleccionadoData) return alert("Selecciona un alumno.");
    path = 'pagos_tipoA';
    data = {
      ...data,
      alumnoId: alumnoSeleccionadoData.id, // o el identificador que uses
      alumnoNombre: `${alumnoSeleccionadoData.name} ${alumnoSeleccionadoData.lastname || ''}`,
      creationDate: data.fecha,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      montoTotal: monto,
      faltante: faltante,
      estatus: faltante > 0 ? 'activa' : 'pagada'
    };
  } 
  else if (concepto === 'pago_parcial' || concepto === 'clases_extra') {
    if (!alumnoSeleccionadoData) return alert("Selecciona un alumno.");
    // Aquí deberías seleccionar un pago específico (por simplicidad usamos el último activo)
    const pagosAlumno = pagosActivosTipoA.filter(p => p.alumnoId === alumnoSeleccionadoData.id);
    if (pagosAlumno.length === 0) return alert("No hay pagos activos para este alumno.");
    
    const pago = pagosAlumno[pagosAlumno.length - 1];
    path = `pagos_tipoA/${pago.id}`;
    
    const nuevoFaltante = concepto === 'pago_parcial' 
      ? Math.max(0, pago.faltante - monto)
      : 0;

    await update(ref(db, path), {
      faltante: nuevoFaltante,
      estatus: nuevoFaltante > 0 ? 'activa' : 'pagada',
      ultimoPago: { monto, fecha: data.fecha, medio }
    });

    alert("Pago registrado y actualizado correctamente.");
    app.hideModal('modal-pago');
    pagoForm.reset();
    return;
  } 
  else if (concepto === 'actividad_extra') {
    path = 'pagos_tipoB';
    data.faltante = faltante;
  }

  try {
    const newRef = push(ref(db, path));
    await set(newRef, data);
    alert("Pago registrado correctamente.");
    app.hideModal('modal-pago');
    pagoForm.reset();
  } catch (err) {
    console.error(err);
    alert("Error al registrar pago.");
  }
});
