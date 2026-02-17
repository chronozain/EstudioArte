// js/app.js
import { db, auth, collection, addDoc, getDocs, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "./firebase-config.js";

// Referencias DOM
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const studentsList = document.getElementById('students-list');
const addStudentForm = document.getElementById('add-student-form');

// 1. AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario logueado
        loginView.classList.add('hidden-view');
        dashboardView.classList.remove('hidden-view');
        loadStudents(); // Cargar datos
    } else {
        // Usuario no logueado
        loginView.classList.remove('hidden-view');
        dashboardView.classList.add('hidden-view');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        document.getElementById('login-error').innerText = "Error: Usuario o contraseña incorrectos.";
        document.getElementById('login-error').classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 2. LÓGICA DE NEGOCIO Y DATOS
// Función para calcular estado del alumno basado en reglas [cite: 126, 127]
function calculateStatus(paymentDate) {
    if (!paymentDate) return { active: false, msg: "Sin pago", classesLeft: 0 };

    const start = new Date(paymentDate);
    const now = new Date();
    // Regla: 30 días de vigencia
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
        return { active: false, msg: "Vencido", classesLeft: 0, isExpired: true };
    }
    
    // Regla: 3 clases base por pago 
    // Nota: En una versión completa, restaríamos las clases ya tomadas desde la BD
    return { active: true, msg: `${30 - diffDays} días restantes`, classesLeft: 3 }; 
}

// Cargar Alumnos
async function loadStudents() {
    studentsList.innerHTML = '<p class="text-center text-gray-400">Actualizando lista...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        studentsList.innerHTML = ""; // Limpiar

        if (querySnapshot.empty) {
            studentsList.innerHTML = '<p class="text-center p-4">No hay alumnos registrados.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const student = doc.data();
            // Simulación de último pago (esto vendría de la colección 'pagos' en la versión completa)
            const status = calculateStatus(student.lastPaymentDate); 
            
            // Renderizar Tarjeta de Alumno [cite: 37]
            const cardHTML = `
                <div class="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div class="flex items-center gap-3">
                        <div class="size-11 rounded-lg bg-indigo-100 flex items-center justify-center text-primary font-bold">
                            ${student.name.charAt(0)}
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
                </div>
            `;
            studentsList.innerHTML += cardHTML;
        });
    } catch (error) {
        console.error("Error cargando alumnos:", error);
        studentsList.innerHTML = '<p class="text-red-500 text-center">Error al cargar datos.</p>';
    }
}

// 3. REGISTRAR NUEVO ALUMNO
addStudentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const email = document.getElementById('new-email').value;

    try {
        // Regla: Unicidad (idealmente validar antes, aquí guardamos directo para MVP) [cite: 137]
        await addDoc(collection(db, "students"), {
            name: name,
            email: email,
            createdAt: new Date().toISOString(),
            lastPaymentDate: new Date().toISOString() // Asignamos pago hoy para prueba
        });
        
        window.app.hideModal('modal-alumno');
        addStudentForm.reset();
        loadStudents(); // Recargar lista
        alert("Alumno registrado correctamente");
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Error al guardar");
    }
});