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
  serverTimestamp,
  runTransaction,
  updateDoc,
  getDoc
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

/* ===== Firebase Config (SEU) ===== */
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const btnNotif = document.getElementById("btnNotif");
const btnLogin = document.getElementById("btnLogin");
const btnSair = document.getElementById("btnSair");

const statPioneiros = document.getElementById("statPioneiros");
const statTotal = document.getElementById("statTotal");
const statPendentes = document.getElementById("statPendentes");

const listaPendentes = document.getElementById("listaPendentes");
const listaAprovados = document.getElementById("listaAprovados");

const adminModal = document.getElementById("adminModal");
const adminFechar = document.getElementById("adminFechar");
const adminFoto = document.getElementById("adminFoto");
const adminNome = document.getElementById("adminNome");
const adminSelo = document.getElementById("adminSelo");
const adminNum = document.getElementById("adminNum");
const adminMsg = document.getElementById("adminMsg");
const adminMemorial = document.getElementById("adminMemorial");
const adminData = document.getElementById("adminData");
const adminMsgStatus = document.getElementById("adminMsgStatus");
const btnAprovar = document.getElementById("btnAprovar");
const btnRejeitar = document.getElementById("btnRejeitar");

const adminComprovanteBox = document.getElementById("adminComprovanteBox");
const adminAbrirComp = document.getElementById("adminAbrirComp");

let currentUser = null;
let notifEnabled = false;
let audioUnlocked = false;

let selectedDoc = null;

function setStatus(text, ok=false){
  adminMsgStatus.textContent = text;
  adminMsgStatus.className = "msg " + (ok ? "ok" : "err");
}

function softBeep(){
  if(!audioUnlocked) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 560;
    g.gain.value = 0.02;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
  }catch{}
}

function notify(title, body){
  if(!notifEnabled) return;
  if(Notification.permission !== "granted") return;
  new Notification(title, { body });
}

/* ===== auth ===== */
btnLogin.addEventListener("click", async ()=>{
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});

btnSair.addEventListener("click", async ()=>{
  await signOut(auth);
});

onAuthStateChanged(auth, (user)=>{
  currentUser = user;

  if(user && user.email === ADMIN_EMAIL){
    btnLogin.classList.add("hidden");
    btnSair.classList.remove("hidden");
    setStatus("Logado como admin ✅", true);
  }else if(user){
    setStatus("Você não é admin. Saia e entre com o email certo.", false);
  }else{
    btnLogin.classList.remove("hidden");
    btnSair.classList.add("hidden");
    setStatus("Faça login para usar o painel.", true);
  }
});

/* ===== notificações ===== */
btnNotif.addEventListener("click", async ()=>{
  // desbloqueia áudio
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    await ctx.close();
    audioUnlocked = true;
  }catch{}

  const perm = await Notification.requestPermission();
  notifEnabled = perm === "granted";
  btnNotif.textContent = notifEnabled ? "NOTIFICAÇÃO ATIVA" : "ATIVAR NOTIFICAÇÃO";
});

/* ===== meta contadores ===== */
const metaRef = doc(db, "meta/contadores");
onSnapshot(metaRef, (s)=>{
  const d = s.exists() ? s.data() : {};
  statPioneiros.textContent = Number(d.pioneirosAprovados || 0);
  statTotal.textContent = Number(d.aprovadosTotal || 0);
});

/* ===== listas ===== */
function fmtData(ts){
  try{
    const dt = ts?.toDate ? ts.toDate() : new Date();
    return dt.toLocaleString("pt-BR");
  }catch{
    return "";
  }
}

function makeItem(d, mode){
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <img src="${d.fotoURL}" alt="foto"/>
    <div class="meta">
      <div class="t">${d.nome}</div>
      <div class="s">${mode === "pendente" ? d.status : `#${d.numero} • aprovado`}</div>
    </div>
    <div class="act">
      <button class="btn-mini">VER</button>
    </div>
  `;
  el.querySelector("button").addEventListener("click", ()=> openModal(d));
  return el;
}

/* Pendentes */
let lastPendentesCount = 0;

const qPend = query(
  collection(db, "envios"),
  where("status", "in", ["pendente","pendente_pagamento"]),
  orderBy("createdAt", "desc"),
  limit(60)
);

onSnapshot(qPend, (snap)=>{
  const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));

  statPendentes.textContent = docs.length;

  // notificar quando aumentar (só se já carregou antes)
  if(lastPendentesCount !== 0 && docs.length > lastPendentesCount){
    softBeep();
    notify("Novo envio pendente", "Abra o painel para aprovar.");
  }
  lastPendentesCount = docs.length;

  listaPendentes.innerHTML = "";
  docs.forEach(d => listaPendentes.appendChild(makeItem(d, "pendente")));
});

/* Aprovados recentes */
const qAprov = query(
  collection(db, "envios"),
  where("status", "==", "aprovado"),
  orderBy("approvedAt", "desc"),
  limit(40)
);

onSnapshot(qAprov, (snap)=>{
  const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
  listaAprovados.innerHTML = "";
  docs.forEach(d => listaAprovados.appendChild(makeItem(d, "aprovado")));
});

/* ===== modal admin ver ===== */
adminFechar.addEventListener("click", ()=> adminModal.classList.add("hidden"));
adminModal.addEventListener("click", (e)=>{ if(e.target === adminModal) adminModal.classList.add("hidden"); });

function openModal(d){
  selectedDoc = d;
  setStatus("", true);

  adminFoto.src = d.fotoURL;
  adminNome.textContent = d.nome || "Sem nome";

  // selo e numero (se já aprovado)
  if(d.status === "aprovado"){
    adminNum.textContent = `#${d.numero}`;
    adminSelo.textContent = d.numero <= TOTAL_PIONEIROS ? "PIONEIRO" : "MEMBRO";
  }else{
    adminNum.textContent = "—";
    adminSelo.textContent = d.status === "pendente_pagamento" ? "PAGAMENTO" : "PENDENTE";
  }

  // memorial
  if(d.memorial && d.memorialPara){
    adminMemorial.textContent = `🕯️ Em memória de ${d.memorialPara}`;
    adminMemorial.classList.remove("hidden");
  }else{
    adminMemorial.classList.add("hidden");
  }

  // msg
  const m = (d.mensagem || "").trim();
  if(m){
    adminMsg.textContent = m;
    adminMsg.classList.remove("hidden");
  }else{
    adminMsg.classList.add("hidden");
  }

  adminData.textContent = `Criado em: ${fmtData(d.createdAt)}${d.approvedAt ? ` • Aprovado em: ${fmtData(d.approvedAt)}` : ""}`;

  // comprovante (privado)
  if(d.status === "pendente_pagamento" && d.comprovantePath){
    adminComprovanteBox.classList.remove("hidden");
    adminAbrirComp.onclick = async ()=>{
      try{
        if(!currentUser || currentUser.email !== ADMIN_EMAIL){
          return setStatus("Faça login como admin para abrir o comprovante.", false);
        }
        const url = await getDownloadURL(ref(storage, d.comprovantePath));
        window.open(url, "_blank", "noopener");
      }catch(err){
        console.error(err);
        setStatus("Não consegui abrir o comprovante. Verifique login/regras.", false);
      }
    };
  }else{
    adminComprovanteBox.classList.add("hidden");
  }

  // botões
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  btnAprovar.disabled = !isAdmin;
  btnRejeitar.disabled = !isAdmin;

  adminModal.classList.remove("hidden");
}

/* ===== Aprovação com transação
   - incrementa aprovadosTotal sempre
   - pioneirosAprovados só até 100
   - define numero = aprovadosTotal (vira #101+ depois)
*/
btnAprovar.addEventListener("click", async ()=>{
  if(!selectedDoc) return;
  if(!currentUser || currentUser.email !== ADMIN_EMAIL) return setStatus("Você não é admin.", false);

  setStatus("Aprovando...", true);

  try{
    const envioRef = doc(db, "envios", selectedDoc.id);

    const res = await runTransaction(db, async (tx)=>{
      const metaSnap = await tx.get(metaRef);
      const meta = metaSnap.exists() ? metaSnap.data() : {};
      const pioneiros = Number(meta.pioneirosAprovados || 0);
      const total = Number(meta.aprovadosTotal || 0);

      const nextTotal = total + 1;         // # sempre
      const nextPioneiros = pioneiros < TOTAL_PIONEIROS ? pioneiros + 1 : pioneiros;

      const isPioneiro = nextTotal <= TOTAL_PIONEIROS; // porque #1..#100
      // obs: a lógica principal é numero=nextTotal
      // pioneirosAprovados controla “restam vagas”

      tx.update(envioRef, {
        status: "aprovado",
        numero: nextTotal,
        approvedAt: serverTimestamp()
      });

      tx.set(metaRef, {
        aprovadosTotal: nextTotal,
        pioneirosAprovados: nextPioneiros
      }, { merge: true });

      return { nextTotal, nextPioneiros, isPioneiro };
    });

    setStatus(`Aprovado! Virou #${res.nextTotal} ✅`, true);
    adminModal.classList.add("hidden");

  }catch(err){
    console.error(err);
    setStatus("Erro ao aprovar. Veja o console.", false);
  }
});

btnRejeitar.addEventListener("click", async ()=>{
  if(!selectedDoc) return;
  if(!currentUser || currentUser.email !== ADMIN_EMAIL) return setStatus("Você não é admin.", false);

  setStatus("Rejeitando...", true);

  try{
    await updateDoc(doc(db, "envios", selectedDoc.id), {
      status: "rejeitado",
      rejectedAt: serverTimestamp()
    });
    setStatus("Rejeitado ✅", true);
    adminModal.classList.add("hidden");
  }catch(err){
    console.error(err);
    setStatus("Erro ao rejeitar.", false);
  }
});
