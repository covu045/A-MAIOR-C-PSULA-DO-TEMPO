import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  runTransaction,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxtp2inskZ8qrjGk6KcSZo7PkvkwVHTy4",
  authDomain: "a-maior-capsula-do-tempo.firebaseapp.com",
  projectId: "a-maior-capsula-do-tempo",
  storageBucket: "a-maior-capsula-do-tempo.firebasestorage.app",
  messagingSenderId: "1097704950592",
  appId: "1:1097704950592:web:28b8e856804333b43208a5",
  measurementId: "G-N1TJ67KLWM"
};

const ADMIN_EMAIL = "mateusgoncalvesayala@gmail.com";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.getElementById("ano").textContent = new Date().getFullYear();

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const adminStatus = document.getElementById("adminStatus");

const pendentesWrap = document.getElementById("pendentes");
const aprovadosWrap = document.getElementById("aprovados");

const META_REF = doc(db, "meta", "contadores");
const TOTAL_PIONEIROS = 100;

function isAdmin(user){
  return user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

btnLogin.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

function cardHtml(d){
  const msg = (d.mensagem || "").trim();
  const comp = (d.comprovanteURL || "").trim();
  const pioneiroNum = Number.isFinite(d.pioneiroNumero) ? d.pioneiroNumero : null;

  return `
    <div class="admin-card">
      <img src="${d.fotoURL}" alt="${d.nome}">
      <div class="admin-body">
        <p class="admin-title">${d.nome}</p>
        <p class="admin-meta">Status: <strong>${d.status}</strong> ${pioneiroNum ? `· PIONEIRO #${pioneiroNum}` : ""}</p>
        ${msg ? `<p class="admin-msg">“${msg}”</p>` : `<p class="admin-msg" style="opacity:.6;">(sem mensagem)</p>`}

        ${comp ? `<p class="admin-meta">Comprovante: <a href="${comp}" target="_blank" rel="noopener">abrir</a></p>` : ""}

        <div class="admin-buttons">
          <button class="aprovar" data-action="aprovar" data-id="${d.id}">APROVAR</button>
          <button class="remover" data-action="remover" data-id="${d.id}">REMOVER</button>
        </div>
      </div>
    </div>
  `;
}

function renderList(el, items){
  el.innerHTML = items.map(cardHtml).join("");
}

async function aprovarEnvio(id){
  // Aprovação com transação:
  // - Se pioneirosAprovados < 100 => define pioneiroNumero = +1 e incrementa meta
  // - Se já >=100 => aprova como MEMBRO (pioneiroNumero permanece null)
  const envioRef = doc(db, "envios", id);

  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(META_REF);
    const meta = metaSnap.exists() ? metaSnap.data() : { pioneirosAprovados: 0 };
    const usados = Number(meta.pioneirosAprovados || 0);

    let pioneiroNumero = null;
    let newMeta = usados;

    if(usados < TOTAL_PIONEIROS){
      pioneiroNumero = usados + 1;
      newMeta = pioneiroNumero;
      tx.set(META_REF, { pioneirosAprovados: newMeta }, { merge: true });
    }

    tx.update(envioRef, {
      status: "aprovado",
      pioneiroNumero: pioneiroNumero
    });
  });
}

async function removerEnvio(id){
  await deleteDoc(doc(db, "envios", id));
}

function attachActions(container){
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if(!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    btn.disabled = true;

    try{
      if(action === "aprovar") await aprovarEnvio(id);
      if(action === "remover") await removerEnvio(id);
    }catch(err){
      console.error(err);
      alert("Erro: " + (err?.message || "falha"));
    }finally{
      btn.disabled = false;
    }
  });
}

attachActions(pendentesWrap);
attachActions(aprovadosWrap);

onAuthStateChanged(auth, (user) => {
  if(!isAdmin(user)){
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    adminStatus.textContent = user ? "Você não é admin neste painel." : "Você precisa entrar com Google.";

    pendentesWrap.innerHTML = `<p class="line" style="opacity:.7;">Faça login com o e-mail admin.</p>`;
    aprovadosWrap.innerHTML = "";
    return;
  }

  btnLogin.classList.add("hidden");
  btnLogout.classList.remove("hidden");
  adminStatus.textContent = `Logado como admin: ${user.email}`;

  // Pendentes: pendente e pendente_pagamento
  const qPend = query(
    collection(db, "envios"),
    where("status", "in", ["pendente", "pendente_pagamento"]),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  onSnapshot(qPend, (snap) => {
    const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    renderList(pendentesWrap, docs);
  });

  // Aprovados
  const qAprov = query(
    collection(db, "envios"),
    where("status", "==", "aprovado"),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  onSnapshot(qAprov, (snap) => {
    const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    renderList(aprovadosWrap, docs);
  });
});
