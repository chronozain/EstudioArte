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
    }
};

// --- AUTH ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden-view');
        document.querySelector('nav').classList.remove('hidden-view');
        window.app.changeView('dashboard-view');
        refreshData();
        // TODO: Cargar nombre usuario en header desde DB si disponible
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

// --- DATA REFRESH y resto del código similar, con ajustes para nuevas vistas ---
function refreshData() {
    loadActiveStudents();
    loadFullStudents();
    populateAlumnoSuggestions();  // Nueva para search en pagos
}

// Actualiza loadActiveStudents para matching imagen: Añade clase/venc en cards
async function loadActiveStudents() {
    // ... (código original)
    // En el innerHTML de card, ajusta:
    card.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">${s.nombre[0]}</div>
            <div>
                <p class="font-bold text-slate-800">${s.nombre} ${s.apellidos}</p>
                <p class="text-xs text-gray-500">${/* Añade clase desde DB si disponible */ 'Clase Ejemplo'}</p>
                <p class="text-xs text-gray-500">Vence: ${new Date(p.fechaVencimiento).toLocaleDateString()}</p>
            </div>
        </div>
        <span class="${p.faltante > 0 ? 'text-red-500' : 'text-green-500 bg-green-100 px-2 py-1 rounded-full'} font-bold">$${p.faltante > 0 ? `-${p.faltante}` : 'Pagado'}</span>
    `;
    // ...
}

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

// Resto del código (edit, checkIn, register-pago) similar, pero actualiza selectores para nuevos IDs (e.g., observaciones, medio pago si usas).

// En register-pago-form submit, añade observaciones a pago data si necesitas.
