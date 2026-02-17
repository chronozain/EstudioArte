// js/app.js

// ────────────────────────────────────────────────
// 1. Configuración e inicialización de Firebase
// ────────────────────────────────────────────────
// (Opción recomendada: crea un archivo firebase-config.js separado)
// Pero para simplicidad en GitHub Pages, la ponemos aquí:

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
  authDomain: "bd-personal-c3e4d.firebaseapp.com",
  projectId: "bd-personal-c3e4d",
  storageBucket: "bd-personal-c3e4d.firebasestorage.app",
  messagingSenderId: "739560517872",
  appId: "1:739560517872:web:8df36c57591b3220985235"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ────────────────────────────────────────────────
// 2. Referencias al DOM
// ────────────────────────────────────────────────
const loginView       = document.getElementById('login-view');
const dashboardView   = document.getElementById('dashboard-view');
const loginForm       = document.getElementById('login-form');
const loginError      = document.getElementById('login-error');
const logoutBtn       = document.getElementById('logout-btn');
const studentsList    = document.getElementById('students-list');
const addStudentForm  = document.getElementById('add-student-form');

// ────────────────────────────────────────────────
// 3. Autenticación y cambio de vistas
// ────────────────────────────────────────────────
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

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
  }
});

// ────────────────────────────────────────────────
// 4. Lógica de estado del alumno (tu función, conservada)
// ────────────────────────────────────────────────
function calculateStatus(paymentDate) {
  if (!paymentDate) {
    return { active: false, msg: "Sin pago", classesLeft: 0 };
  }

  const start = new Date(paymentDate);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return { active: false, msg: "Vencido", classesLeft: 0, isExpired: true };
  }

  // 3 clases base (en futuro: restar clases consumidas)
  return {
    active: true,
    msg: `${30 - diffDays} días restantes`,
    classesLeft: 3,
    isExpired: false
  };
}

// ────────────────────────────────────────────────
// 5. Cargar lista de alumnos
// ────────────────────────────────────────────────
async function loadStudents() {
  studentsList.innerHTML = '<p class="text-center text-gray-500">Cargando alumnos...</p>';

  try {
    const querySnapshot = await getDocs(collection(db, "alumnos"));
    studentsList.innerHTML = "";

    if (querySnapshot.empty) {
      studentsList.innerHTML = '<p class="text-center text-gray-500">No hay alumnos registrados aún.</p>';
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const student = docSnap.data();
      const status = calculateStatus(student.lastPaymentDate);

      const card = document.createElement('div');
      card.className = "flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100";

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="size-11 rounded-lg bg-indigo-100 flex items-center justify-center text-primary font-bold">
            ${student.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 class="font-semibold text-slate-900 text-sm">${student.name}</h4>
            <p class="text-[11px] text-slate-500">${student.email || 'Sin contacto'}</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[13px] font-bold text-slate-900">${status.classesLeft} Clases</div>
          <div class="text-[10px] ${status.isExpired ? 'text-red-500 font-bold' : 'text-slate-400'}">
            ${status.msg}
          </div>
        </div>
      `;

      studentsList.appendChild(card);
    });
  } catch (error) {
    console.error("Error al cargar alumnos:", error);
    studentsList.innerHTML = '<p class="text-center text-red-500">Error al cargar los datos.</p>';
  }
}

// ────────────────────────────────────────────────
// 6. Registrar nuevo alumno
// ────────────────────────────────────────────────
addStudentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('new-name').value.trim();
  const email = document.getElementById('new-email').value.trim();

  if (!name) {
    alert("El nombre es obligatorio");
    return;
  }

  try {
    await addDoc(collection(db, "alumnos"), {
      name,
      email: email || null,
      createdAt: Timestamp.now(),
      lastPaymentDate: Timestamp.now().toDate().toISOString()  // para pruebas
    });

    window.app.hideModal('modal-alumno');
    addStudentForm.reset();
    loadStudents();
    alert("Alumno registrado correctamente ✓");
  } catch (error) {
    console.error("Error al guardar alumno:", error);
    alert("No se pudo guardar el alumno. Intenta de nuevo.");
  }
});

// Opcional: exponer funciones para onclick del HTML si es necesario
window.app = window.app || {};
window.app.loadStudents = loadStudents;  // por si quieres refrescar manualmente
