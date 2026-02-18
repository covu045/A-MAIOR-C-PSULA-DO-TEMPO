import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getStorage,
  ref,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* CONFIG */
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
const TOTAL_PIONEIROS = 100;
const META_PATH = "meta/contadores";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnNotif = document.getElementById("btnNotif");

const statPioneiros = document.getElementById("statPioneiros");
const statPendentes = document.getElementById("statPendentes");

const listaPendentes = document.getElementById("listaPendentes");
const listaAprovados = document.getElementById("listaAprovados");

const audioEl = document.getElementById("notifyAudio");

let isAdmin = false;
let lastPendingCount = 0;

function fmtDate(ts){
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString("pt-BR") : "—";
}

btnNotif.addEventListener("click", async () => {
  try{
    if(!("Notification" in window)) return alert("Seu navegador não suporta notificação.");
    const p = await Notification.requestPermission();
    if(p === "granted") btnNotif.textContent = "NOTIFICAÇÃO ATIVA ✓";
    else alert("Notificação negada. O som ainda funciona.");
  }catch{
    alert("Não foi possível ativar notificação.");
  }
});

btnLogin.addEventListener("click", async () => {
  const prov = new GoogleAuthProvider();
  await signInWithPopup(auth, prov);
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;

  btnLogin.classList.toggle("hidden", isAdmin);
  btnLogout.classList.toggle("hidden", !isAdmin);

  if(!isAdmin){
    listaPendentes.innerHTML = `<div class="mutedSmall">Faça login com o Google do admin.</div>`;
    listaAprovados.innerHTML = "";
    return;
  }

  startListeners();
});

let started = false;
function startListeners(){
  if(started) return;
  started = true;

  const metaRef = doc(db, META_PATH);
  onSnapshot(metaRef, (s) => {
    const data = s.exists() ? s.data() : { pioneirosAprovados: 0 };
    statPioneiros.textContent = String(Number(data.pioneirosAprovados || 0));
  });

  // Pendentes: pendente + pendente_pagamento
  const pendQ = query(
    collection(db, "envios"),
    where("status", "in", ["pendente","pendente_pagamento"]),
    orderBy("createdAt", "desc"),
    limit(60)
  );

  onSnapshot(pendQ, (snap) => {
    const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    listaPendentes.innerHTML = "";
    statPendentes.textContent = String(docs.length);

    // som + notificação quando chega novo
    if(lastPendingCount && docs.length > lastPendingCount){
      try{
        audioEl.currentTime = 0;
        audioEl.play().catch(()=>{});
      }catch{}

      if("Notification" in window && Notification.permission === "granted"){
        new Notification("Novo envio pendente", { body: "Chegou um envio para aprovar." });
      }
    }
    lastPendingCount = docs.length;

    docs.forEach((d) => listaPendentes.appendChild(renderItem(d, true)));
  });

  // Aprovados recentes
  const apQ = query(
    collection(db, "envios"),
    where("status", "==", "aprovado"),
    orderBy("approvedAt", "desc"),
    limit(20)
  );

  onSnapshot(apQ, (snap) => {
    const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
    listaAprovados.innerHTML = "";
    docs.forEach((d) => listaAprovados.appendChild(renderItem(d, false)));
  });
}

function renderItem(d, isPending){
  const wrap = document.createElement("div");
  wrap.className = "adminItem";

  const msg = (d.mensagem || "").trim();
  const memorial = d.memorial === true;

  wrap.innerHTML = `
    <div class="adminItemTop">
      <div class="adminThumb"><img src="${d.fotoURL}" alt=""></div>
      <div class="adminInfo">
        <div class="adminName">${(d.nome || "—").toUpperCase()}</div>
        <div class="adminMeta">
          ${isPending ? `Status: <strong>${d.status}</strong>` : `Aprovado: <strong>${d.pioneiroNumero ? "PIONEIRO #" + d.pioneiroNumero : "MEMBRO"}</strong>`}
          <br/>Criado: ${fmtDate(d.createdAt)}
          ${d.approvedAt ? `<br/>Aprovado: ${fmtDate(d.approvedAt)}` : ``}
          ${memorial ? `<br/>🕯️ <strong>MEMORIAL</strong>` : ``}
        </div>
        ${msg ? `<div class="adminMsg">“${escapeHtml(msg)}”</div>` : ``}
      </div>
    </div>

    <div class="adminBtns">
      ${isPending ? `
        <button class="btnOk" data-act="aprovar">APROVAR</button>
        <button class="btnNo" data-act="rejeitar">REJEITAR</button>
      ` : ``}

      ${d.comprovantePath ? `<button class="btnLink" data-act="vercomp">VER COMPROVANTE</button>` : ``}
      <button class="btnLink" data-act="abrirfoto">ABRIR FOTO</button>
      <button class="btnLink" data-act="excluir">EXCLUIR</button>
    </div>
  `;

  wrap.querySelectorAll("button[data-act]").forEach((b) => {
    b.addEventListener("click", async () => {
      const act = b.dataset.act;
      if(act === "abrirfoto") window.open(d.fotoURL, "_blank", "noopener");
      if(act === "vercomp") await verComprovante(d);
      if(act === "aprovar") await aprovar(d);
      if(act === "rejeitar") await rejeitar(d);
      if(act === "excluir") await excluir(d);
    });
  });

  return wrap;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

async function verComprovante(d){
  try{
    const r = ref(storage, d.comprovantePath);
    const url = await getDownloadURL(r);
    window.open(url, "_blank", "noopener");
  }catch(e){
    console.error(e);
    alert("Não foi possível abrir o comprovante. Confirme se você está logado como admin.");
  }
}

async function aprovar(d){
  const ok = confirm("Aprovar este envio?");
  if(!ok) return;

  const metaRef = doc(db, META_PATH);
  const envioRef = doc(db, "envios", d.id);

  try{
    await runTransaction(db, async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const pioneirosAprovados = metaSnap.exists() ? Number(metaSnap.data().pioneirosAprovados || 0) : 0;

      let pioneiroNumero = null;

      if(pioneirosAprovados < TOTAL_PIONEIROS){
        pioneiroNumero = pioneirosAprovados + 1;
        tx.set(metaRef, { pioneirosAprovados: pioneiroNumero }, { merge: true });
      }

      tx.update(envioRef, {
        status: "aprovado",
        pioneiroNumero,
        approvedAt: serverTimestamp()
      });
    });

    alert("Aprovado ✅");
  }catch(e){
    console.error(e);
    alert("Erro ao aprovar.");
  }
}

async function rejeitar(d){
  const ok = confirm("Rejeitar este envio? (ele NÃO aparece no mural)");
  if(!ok) return;

  try{
    await updateDoc(doc(db, "envios", d.id), {
      status: "rejeitado",
      approvedAt: serverTimestamp()
    });
    alert("Rejeitado.");
  }catch(e){
    console.error(e);
    alert("Erro ao rejeitar.");
  }
}

async function excluir(d){
  const ok = confirm("Excluir este envio do banco? (não apaga a imagem do Storage)");
  if(!ok) return;

  try{
    await deleteDoc(doc(db, "envios", d.id));
    alert("Excluído.");
  }catch(e){
    console.error(e);
    alert("Erro ao excluir.");
  }
}
