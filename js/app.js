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

// Referencias DOM
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const studentsList = document.getElementById('students-list');
const addStudentForm = document.getElementById('add-student-form');
const isAdultToggle = document.getElementById('is-adult');
const tutorSection = document.getElementById('tutor-section');
const registerPagoForm = document.getElementById('register-pago-form');
const conceptoSelect = document.getElementById('concepto');
const pagoAlumnoSelect = document.getElementById('pago-alumno-select');
const pagoIdContainer = document.getElementById('pago-id-container');
const pagoIdSelect = document.getElementById('pago-id-select');
const extraClassesContainer = document.getElementById('extra-classes-container');
const numClasesExtraInput = document.getElementById('num-clases-extra');

// Helpers Globales
window.app = {
  showModal: id => document.getElementById(id)?.classList.remove('hidden-view'),
  hideModal: id => document.getElementById(id)?.classList.add('hidden-view')
};

// Autenticación
onAuthStateChanged(auth, user => {
  if (user) {
    loginView.classList.add('hidden-view');
    dashboardView.classList.remove('hidden-view');
    loadStudents();
    populateAlumnoSelect();
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
  } catch (err) {
    alert("Usuario o contraseña incorrectos.");
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

function loadStudents() {
  onValue(ref(db, 'alumnos'), snapshot => {
    studentsList.innerHTML = '';
    if (!snapshot.exists()) return;
    Object.entries(snapshot.val()).forEach(([id, s]) => {
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3';
      card.innerHTML = `<div class="size-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">${s.nombre[0]}</div>
                        <div><h4 class="font-bold">${s.nombre} ${s.apellidos}</h4><p class="text-xs text-gray-500">${s.contacto}</p></div>`;
      studentsList.appendChild(card);
    });
  });
}

function populateAlumnoSelect() {
  onValue(ref(db, 'alumnos'), snapshot => {
    pagoAlumnoSelect.innerHTML = '<option value="">Seleccione alumno</option>';
    if (snapshot.exists()) {
      Object.entries(snapshot.val()).forEach(([id, s]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${s.nombre} ${s.apellidos}`;
        pagoAlumnoSelect.appendChild(opt);
      });
    }
  });
}

// Lógica de visibilidad y filtros de Pagos
conceptoSelect.addEventListener('change', () => {
  const concepto = conceptoSelect.value;
  const alumnoId = pagoAlumnoSelect.value;
  
  pagoIdContainer.classList.add('hidden');
  extraClassesContainer.classList.add('hidden');
  document.getElementById('alumno-pay-container').classList.toggle('hidden', concepto === 'actividad_extra');

  if (concepto === 'clases_extra') extraClassesContainer.classList.remove('hidden');

  if ((concepto === 'pago_parcial' || concepto === 'clases_extra') && alumnoId) {
    loadActivePayments(alumnoId, concepto);
  }
});

pagoAlumnoSelect.addEventListener('change', () => {
    if (conceptoSelect.value === 'pago_parcial' || conceptoSelect.value === 'clases_extra') {
        loadActivePayments(pagoAlumnoSelect.value, conceptoSelect.value);
    }
});

async function loadActivePayments(alumnoId, concepto) {
  const snapshot = await get(ref(db, 'pagos_tipo_a'));
  pagoIdSelect.innerHTML = '<option value="">Seleccione ID de Pago</option>';
  
  if (snapshot.exists()) {
    const ahora = new Date();
    Object.entries(snapshot.val()).forEach(([id, p]) => {
      const vencimiento = new Date(p.fechaVencimiento);
      if (p.alumnoId === alumnoId && vencimiento > ahora) {
        if (concepto === 'pago_parcial' && p.faltante > 0) {
            addOption(id, p);
        } else if (concepto === 'clases_extra' && p.faltante <= 0) {
            addOption(id, p);
        }
      }
    });
  }
}

function addOption(id, p) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `ID: ${id.slice(-6)} | Faltante: $${p.faltante} | Extra: ${p.clasesExtra || 0}`;
    pagoIdSelect.appendChild(opt);
    pagoIdContainer.classList.remove('hidden');
}

// Registro de Pagos
registerPagoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const concepto = conceptoSelect.value;
  const monto = parseFloat(document.getElementById('monto').value);
  const faltante = parseFloat(document.getElementById('faltante').value || 0);
  const alumnoId = pagoAlumnoSelect.value;

  try {
    const fechaCreacion = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaCreacion.getDate() + 30);

    if (concepto === 'mensualidad') {
      await set(push(ref(db, 'pagos_tipo_a')), { 
        alumnoId, monto, faltante, concepto, clasesExtra: 0,
        fechaCreacion: fechaCreacion.toISOString(), 
        fechaVencimiento: fechaVencimiento.toISOString() 
      });
    } 
    else if (concepto === 'actividad_extra') {
      await set(push(ref(db, 'pagos_tipo_b')), { 
          monto, faltante, 
          observaciones: document.getElementById('observaciones').value, 
          fecha: fechaCreacion.toISOString() 
      });
    }
    else {
      const pagoId = pagoIdSelect.value;
      if (!pagoId) return alert("Seleccione un ID de pago activo");
      
      const pagoRef = ref(db, `pagos_tipo_a/${pagoId}`);
      const snap = await get(pagoRef);
      const data = snap.val();
      
      const nuevasClases = concepto === 'clases_extra' ? parseInt(numClasesExtraInput.value || 0) : 0;
      
      await update(pagoRef, {
        monto: data.monto + monto,
        faltante: Math.max(0, data.faltante - (concepto === 'pago_parcial' ? monto : 0)),
        clasesExtra: (data.clasesExtra || 0) + nuevasClases,
        ultimaModificacion: fechaCreacion.toISOString()
      });
    }

    alert('Pago registrado y procesado correctamente ✓');
    window.app.hideModal('modal-pago');
    registerPagoForm.reset();
  } catch (error) {
    alert("Error: " + error.message);
  }
});

// Registro Alumnos
isAdultToggle.addEventListener('change', () => {
    tutorSection.classList.toggle('hidden', isAdultToggle.checked);
});

addStudentForm.addEventListener('submit', async e => {
  e.preventDefault();
  const alumno = {
    nombre: document.getElementById('new-name').value.trim(),
    apellidos: document.getElementById('new-lastname').value.trim(),
    contacto: document.getElementById('new-contact').value.trim(),
    esMayor: isAdultToggle.checked,
    fechaRegistro: new Date().toISOString()
  };
  
  try {
    await set(push(ref(db, 'alumnos')), alumno);
    alert('Alumno registrado ✓');
    window.app.hideModal('modal-alumno');
    addStudentForm.reset();
  } catch (e) { alert("Error al guardar"); }
});
