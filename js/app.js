// js/app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// Configuración Firebase (agrega databaseURL)
const firebaseConfig = {
  apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
  authDomain: "bd-personal-c3e4d.firebaseapp.com",
  databaseURL: "https://bd-personal-c3e4d-default-rtdb.firebaseio.com/",  // ← CAMBIA ESTO por tu URL real de RTDB
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
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const studentsList = document.getElementById('students-list');
const addStudentForm = document.getElementById('add-student-form');
const isAdultToggle = document.getElementById('is-adult');
const tutorSection = document.getElementById('tutor-section');

// Toggle tutor section
isAdultToggle.addEventListener('change', () => {
  tutorSection.classList.toggle('hidden', isAdultToggle.checked);
  if (isAdultToggle.checked) {
    document.getElementById('tutor-name').value = '';
    document.getElementById('tutor-phone').value = '';
  }
});

// Auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.classList.add('hidden-view');
    dashboardView.classList.remove('hidden-view');
    loadStudents();
  } else {
    loginView.classList.remove('hidden-view');
    dashboardView.classList.add('hidden-view');
  }
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginError.classList.add('hidden');
  } catch (error) {
    loginError.textContent = "Usuario o contraseña incorrectos.";
    loginError.classList.remove('hidden');
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// Cargar alumnos (Realtime listener)
function loadStudents() {
  const alumnosRef = ref(db, 'alumnos');
  studentsList.innerHTML = '<p class="text-center text-gray-500">Cargando alumnos...</p>';

  onValue(alumnosRef, (snapshot) => {
    studentsList.innerHTML = '';
    if (!snapshot.exists()) {
      studentsList.innerHTML = '<p class="text-center text-gray-500 py-8">No hay alumnos registrados.</p>';
      return;
    }

    const alumnos = snapshot.val();
    Object.entries(alumnos).forEach(([key, student]) => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-start gap-4';
      card.innerHTML = `
        <div class="size-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl">
          ${student.name.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1">
          <h4 class="font-semibold">${student.name} ${student.lastname || ''}</h4>
          <p class="text-sm text-gray-600">${student.contact}</p>
          ${student.tutor ? `<p class="text-xs text-gray-500">Tutor: ${student.tutor.name} (${student.tutor.phone})</p>` : ''}
          <p class="text-xs text-gray-400 mt-1">Registrado: ${new Date(student.createdAt).toLocaleDateString('es-MX')}</p>
        </div>
      `;
      studentsList.appendChild(card);
    });
  }, { onlyOnce: false });  // escucha en tiempo real
}

// Guardar alumno
addStudentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('new-name').value.trim();
  const lastname = document.getElementById('new-lastname').value.trim();
  const contact = document.getElementById('new-contact').value.trim();
  const isAdult = isAdultToggle.checked;

  if (!name || !lastname || !contact) {
    alert('Nombre, apellidos y contacto son obligatorios.');
    return;
  }

  let tutor = null;
  if (!isAdult) {
    const tutorName = document.getElementById('tutor-name').value.trim();
    const tutorPhone = document.getElementById('tutor-phone').value.trim();
    if (!tutorName || !tutorPhone) {
      alert('Para menores se requiere nombre y teléfono del tutor.');
      return;
    }
    tutor = { name: tutorName, phone: tutorPhone };
  }

  const alumno = {
    name,
    lastname,
    contact,
    isAdult,
    tutor,
    createdAt: new Date().toISOString()
  };

  try {
    const newRef = push(ref(db, 'alumnos'));
    await set(newRef, alumno);
    app.hideModal('modal-alumno');
    addStudentForm.reset();
    isAdultToggle.checked = true;
    tutorSection.classList.add('hidden');
    alert('Alumno registrado correctamente ✓');
  } catch (error) {
    console.error('Error al guardar:', error);
    alert('Error al registrar alumno.');
  }
});
