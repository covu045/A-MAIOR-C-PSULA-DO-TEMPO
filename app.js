import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* =========================
   CONFIG (JÁ COM SEUS DADOS)
========================= */
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
const PIX_KEY = "c616ef49-60b6-42eb-acc9-0ef28dc2de56";

const TOTAL_PIONEIROS = 100;
const META_PATH = "meta/contadores";
const LS_MY_DOC = "capsula_meu_docid_v2";

/* ========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/* UI */
const grid = document.getElementById("grid");
const vagasTexto = document.getElementById("vagasTexto");
const modal = document.getElementById("modal");
const btnQuero = document.getElementById("btnQuero");
const fecharModal = document.getElementById("fecharModal");
const btnVerMinha = document.getElementById("btnVerMinha");

const form = document.getElementById("form");
const nomeEl = document.getElementById("nome");
const fotoEl = document.getElementById("foto");
const mensagemEl = document.getElementById("mensagem");
const memorialEl = document.getElementById("memorial");
const termosEl = document.getElementById("termos");
const msgEl = document.getElementById("msg");
const enviarBtn = document.getElementById("enviar");

const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");

const pagamentoBox = document.getElementById("pagamentoBox");
const comprovanteEl = document.getElementById("comprovante");
const pixKeyEl = document.getElementById("pixKey");
const btnCopyPix = document.getElementById("btnCopyPix");

const viewModal = document.getElementById("viewModal");
const fecharView = document.getElementById("fecharView");
const viewImg = document.getElementById("viewImg");
const viewBadges = document.getElementById("viewBadges");
const viewName = document.getElementById("viewName");
const viewMeta = document.getElementById("viewMeta");
const viewMsg = document.getElementById("viewMsg");

document.getElementById("ano").textContent = new Date().getFullYear();
pixKeyEl.textContent = PIX_KEY;

/* Estado */
let modoPago = false; // após 100 pioneiros aprovados
let lastDocIds = new Set(); // para animar novos cards

/* Helpers */
function setMsg(texto, ok=false){
  msgEl.textContent = texto;
  msgEl.className = "msg " + (ok ? "ok" : "err");
}
function openModal(){
  modal.classList.remove("hidden");
  setMsg("", true);

  if(modoPago){
    pagamentoBox.classList.remove("hidden");
    comprovanteEl.required = true;
  }else{
    pagamentoBox.classList.add("hidden");
    comprovanteEl.required = false;
  }
}
function closeModal(){ modal.classList.add("hidden"); }

btnQuero.addEventListener("click", openModal);
fecharModal.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

btnCopyPix.addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText(PIX_KEY);
    btnCopyPix.textContent = "COPIADO ✓";
    setTimeout(()=> btnCopyPix.textContent = "COPIAR", 1200);
  }catch{
    alert("Não consegui copiar automaticamente. Copie manualmente: " + PIX_KEY);
  }
});

fotoEl.addEventListener("change", () => {
  const f = fotoEl.files?.[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
});

/* Compressão automática */
async function compressImage(file, maxSize = 1200, startQuality = 0.82, maxBytes = 1.9 * 1024 * 1024) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  let { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = startQuality;

  async function toBlob(q){
    return await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", q);
    });
  }

  let blob = await toBlob(quality);

  for(let tries = 0; tries < 6 && blob && blob.size > maxBytes; tries++){
    quality = Math.max(0.5, quality - 0.08);
    blob = await toBlob(quality);
  }

  if(!blob) throw new Error("Falha ao comprimir imagem.");
  return blob;
}

/* Ver minha foto */
function updateMinhaFotoButton(){
  const myId = localStorage.getItem(LS_MY_DOC);
  if(myId) btnVerMinha.classList.remove("hidden");
  else btnVerMinha.classList.add("hidden");
}

btnVerMinha.addEventListener("click", () => {
  const myId = localStorage.getItem(LS_MY_DOC);
  if(!myId) return;

  const el = grid.querySelector(`.card[data-id="${myId}"]`);
  document.getElementById("mural").scrollIntoView({ behavior:"smooth" });

  if(!el) return;

  el.classList.add("newCard");
  setTimeout(()=> el.classList.remove("newCard"), 700);
  el.scrollIntoView({ behavior:"smooth", block:"center" });
});

/* MODAL SURPRESA (clicar na foto) */
function openView(d){
  viewModal.classList.remove("hidden");
  viewImg.src = d.fotoURL;
  viewName.textContent = d.nome || "Sem nome";

  const data = d.approvedAt?.toDate ? d.approvedAt.toDate() : (d.createdAt?.toDate ? d.createdAt.toDate() : null);
  const dataTxt = data ? data.toLocaleDateString("pt-BR") : "—";

  const tipo = d.pioneiroNumero ? `PIONEIRO #${d.pioneiroNumero}` : "MEMBRO";
  viewMeta.textContent = `Registrado em ${dataTxt}`;

  const msg = (d.mensagem || "").trim();
  viewMsg.textContent = msg.length ? msg : "…";

  viewBadges.innerHTML = "";
  const b1 = document.createElement("div");
  b1.className = "vbadge " + (d.pioneiroNumero ? "p" : "m");
  b1.textContent = d.pioneiroNumero ? `PIONEIRO #${d.pioneiroNumero}` : "MEMBRO";
  viewBadges.appendChild(b1);

  if(d.memorial === true){
    const b2 = document.createElement("div");
    b2.className = "vbadge memorial";
    b2.textContent = "🕯️ MEMORIAL";
    viewBadges.appendChild(b2);
  }

  if((d.nome || "").trim().toLowerCase() === "mateus ayala" || (d.nome || "").trim().toLowerCase() === "mateus gonçalves ayala"){
    const b3 = document.createElement("div");
    b3.className = "vbadge";
    b3.textContent = "CRIADOR";
    viewBadges.appendChild(b3);
  }
}

function closeView(){ viewModal.classList.add("hidden"); }
fecharView.addEventListener("click", closeView);
viewModal.addEventListener("click", (e)=>{ if(e.target === viewModal) closeView(); });

/* Contador pioneiros aprovados -> modo pago */
const metaRef = doc(db, META_PATH);
onSnapshot(metaRef, (s) => {
  const data = s.exists() ? s.data() : { pioneirosAprovados: 0 };
  const aprov = Number(data.pioneirosAprovados || 0);
  const restam = Math.max(0, TOTAL_PIONEIROS - aprov);

  vagasTexto.textContent = `Restam apenas ${restam} vagas`;

  modoPago = aprov >= TOTAL_PIONEIROS;
});

/* Render mural (somente aprovados) */
function makeCard(d, isNew=false){
  const card = document.createElement("div");
  const isP = typeof d.pioneiroNumero === "number" && d.pioneiroNumero >= 1 && d.pioneiroNumero <= TOTAL_PIONEIROS;
  card.className = "card " + (isP ? "pioneer" : "member") + (isNew ? " newCard" : "");
  card.dataset.id = d.id;

  card.innerHTML = `
    <span class="badge-left">${isP ? "PIONEIRO" : "MEMBRO"}</span>
    <span class="badge-right">${isP ? `#${d.pioneiroNumero}` : "∞"}</span>
    <img src="${d.fotoURL}" alt="${(d.nome||"").replace(/"/g,"")}">
    <p class="name">${d.nome || "—"}</p>
    ${( (d.nome||"").trim().toLowerCase() === "mateus ayala" || (d.nome||"").trim().toLowerCase() === "mateus gonçalves ayala")
      ? `<span class="badge-creator">CRIADOR</span>` : ``}
  `;

  card.addEventListener("click", () => openView(d));
  return card;
}

const muralQ = query(
  collection(db, "envios"),
  where("status", "==", "aprovado"),
  orderBy("approvedAt", "desc"),
  limit(200)
);

onSnapshot(muralQ, (snap) => {
  const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
  grid.innerHTML = "";

  // detectar novos para animar glow curto
  const newIds = new Set(docs.map(d=>d.id));
  docs.forEach((d) => {
    const isNew = lastDocIds.size && !lastDocIds.has(d.id);
    grid.appendChild(makeCard(d, isNew));
  });
  lastDocIds = newIds;
});

/* Envio */
updateMinhaFotoButton();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = (nomeEl.value || "").trim();
  const foto = fotoEl.files?.[0];
  const mensagem = (mensagemEl.value || "").trim();
  const memorial = !!memorialEl.checked;

  if(nome.length < 2) return setMsg("Digite um nome válido.");
  if(nome.length > 40) return setMsg("Nome muito grande (máx 40).");
  if(!foto) return setMsg("Selecione uma foto.");
  if(!termosEl.checked) return setMsg("Você precisa aceitar os termos.");
  if(mensagem.length > 240) return setMsg("Mensagem muito grande (máx 240).");
  if(!foto.type.startsWith("image/")) return setMsg("Arquivo inválido. Envie uma imagem.");

  // se modo pago: exige comprovante
  let comprovantePath = "";
  if(modoPago){
    const comp = comprovanteEl.files?.[0];
    if(!comp) return setMsg("Após os 100 pioneiros, envie o comprovante do Pix.", false);
    if(!comp.type.startsWith("image/")) return setMsg("Comprovante inválido. Envie uma imagem.", false);
  }

  enviarBtn.disabled = true;
  enviarBtn.style.filter = "grayscale(1)";
  setMsg("Enviando... aguarde", true);

  try{
    // 1) Foto principal (compress)
    const fotoBlob = await compressImage(foto);
    const safeName = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const fotoName = `${Date.now()}-${safeName}.jpg`;
    const fotoRef = ref(storage, `mural/${fotoName}`);
    await uploadBytes(fotoRef, fotoBlob, { contentType: "image/jpeg" });
    const fotoURL = await getDownloadURL(fotoRef);

    // 2) Se modo pago: upload comprovante (salva PATH, não URL)
    if(modoPago){
      const comp = comprovanteEl.files[0];
      const compBlob = await compressImage(comp, 1400, 0.85, 1.9 * 1024 * 1024);
      const compName = `${Date.now()}-comprovante.jpg`;
      comprovantePath = `comprovantes/${compName}`;
      const compRef = ref(storage, comprovantePath);
      await uploadBytes(compRef, compBlob, { contentType: "image/jpeg" });
    }

    // 3) Cria envio (sempre pendente / pendente_pagamento)
    const status = modoPago ? "pendente_pagamento" : "pendente";

    const docRef = await addDoc(collection(db, "envios"), {
      nome,
      fotoURL,
      mensagem: mensagem || "",
      memorial,
      status,
      comprovantePath: modoPago ? comprovantePath : "",
      pioneiroNumero: null,
      createdAt: serverTimestamp(),
      approvedAt: null
    });

    localStorage.setItem(LS_MY_DOC, docRef.id);
    updateMinhaFotoButton();

    setMsg(modoPago
      ? "Recebido! Seu envio está pendente de confirmação do Pix ✅"
      : "Recebido! Seu envio está pendente de aprovação ✅", true
    );

    form.reset();
    previewWrap.classList.add("hidden");
    comprovanteEl.value = "";

    setTimeout(() => {
      closeModal();
      document.getElementById("mural").scrollIntoView({ behavior:"smooth" });
    }, 700);

  }catch(err){
    console.error(err);
    setMsg("Deu erro ao enviar. Tente novamente.", false);
  }finally{
    enviarBtn.disabled = false;
    enviarBtn.style.filter = "";
  }
});

/* PWA opcional */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
