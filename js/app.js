// js/app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// ─── Configuración Firebase ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
  authDomain: "bd-personal-c3e4d.firebaseapp.com",
  databaseURL: "https://bd-personal-c3e4d-default-rtdb.firebaseio.com", // ← verifica que sea tu URL real
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
const addStudentForm  = document.getElementById('add-student-form');
const isAdultToggle   = document.getElementById('is-adult');
const tutorSection    = document.getElementById('tutor-section');

// ─── Helpers ───────────────────────────────────────────────────────
window.app = {
  showModal: id => document.getElementById(id)?.classList.remove('hidden-view'),
  hideModal: id => document.getElementById(id)?.classList.add('hidden-view')
};

// ─── Autenticación ─────────────────────────────────────────────────
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
    loginError.textContent = "Usuario o contraseña incorrectos.";
    loginError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// ─── Cargar lista de alumnos ───────────────────────────────────────
function loadStudents() {
  const alumnosRef = ref(db, 'alumnos');
  studentsList.innerHTML = '<p class="text-center text-gray-500">Cargando alumnos...</p>';

  onValue(alumnosRef, snapshot => {
    studentsList.innerHTML = '';
    if (!snapshot.exists()) {
      studentsList.innerHTML = '<p class="text-center text-gray-500 py-8">No hay alumnos registrados.</p>';
      return;
    }

    const alumnos = snapshot.val();
    Object.values(alumnos).forEach(student => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-center gap-3';
      card.innerHTML = `
        <div class="size-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl">
          ${student.nombre.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1">
          <h4 class="font-semibold">${student.nombre} ${student.apellidos || ''}</h4>
          <p class="text-sm text-gray-600">${student.contacto}</p>
          ${student.tutor ? `<p class="text-xs text-gray-500">Tutor: ${student.tutor.nombre}</p>` : ''}
        </div>
      `;
      studentsList.appendChild(card);
    });
  });
}

// ─── Registrar Alumno ──────────────────────────────────────────────
addStudentForm.addEventListener('submit', async e => {
  e.preventDefault();

  const nombre    = document.getElementById('new-name')?.value.trim();
  const apellidos = document.getElementById('new-lastname')?.value.trim();
  const contacto  = document.getElementById('new-contact')?.value.trim();
  const esMayor   = document.getElementById('is-adult')?.checked;

  if (!nombre || !apellidos || !contacto) {
    alert('Nombre, apellidos y contacto son obligatorios.');
    return;
  }

  let tutor = null;
  if (!esMayor) {
    const tutorNombre = document.getElementById('tutor-name')?.value.trim();
    const tutorTelefono = document.getElementById('tutor-phone')?.value.trim();
    if (!tutorNombre || !tutorTelefono) {
      alert('Para menores se requiere nombre y teléfono del tutor.');
      return;
    }
    tutor = { nombre: tutorNombre, telefono: tutorTelefono };
  }

  const alumno = {
    nombre,
    apellidos,
    contacto,
    esMayor,
    tutor,
    fechaRegistro: new Date().toISOString()
  };

  try {
    const nuevoRef = push(ref(db, 'alumnos'));
    await set(nuevoRef, alumno);
    alert('Alumno registrado correctamente ✓');
    app.hideModal('modal-alumno');
    addStudentForm.reset();
    isAdultToggle.checked = true;
    tutorSection.classList.add('hidden');
    loadStudents();
  } catch (error) {
    console.error('Error al guardar alumno:', error);
    alert('No se pudo registrar el alumno. Revisa la consola.');
  }
});

// ─── Toggle sección tutor ──────────────────────────────────────────
isAdultToggle?.addEventListener('change', () => {
  tutorSection.classList.toggle('hidden', isAdultToggle.checked);
  if (isAdultToggle.checked) {
    document.getElementById('tutor-name').value = '';
    document.getElementById('tutor-phone').value = '';
  }
});
