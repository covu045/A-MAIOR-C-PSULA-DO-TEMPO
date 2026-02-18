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
  getDoc,
  getDocs,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ====== Firebase Config (SEU) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyDxtp2inskZ8qrjGk6KcSZo7PkvkwVHTy4",
  authDomain: "a-maior-capsula-do-tempo.firebaseapp.com",
  projectId: "a-maior-capsula-do-tempo",
  storageBucket: "a-maior-capsula-do-tempo.firebasestorage.app",
  messagingSenderId: "1097704950592",
  appId: "1:1097704950592:web:28b8e856804333b43208a5",
  measurementId: "G-N1TJ67KLWM"
};

const PIX_KEY = "c616ef49-60b6-42eb-acc9-0ef28dc2de56";
const TOTAL_PIONEIROS = 100;
const META_REF = "meta/contadores";
const LS_MY_ID = "capsula_meu_envio_id_v2";

/* ⏳ DATA DE LANÇAMENTO (edite quando quiser) */
const LAUNCH_ISO = "2026-02-18T01:45:00-03:00";

/* ====== init ====== */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/* ====== elementos ====== */
const grid = document.getElementById("grid");
const vagasTexto = document.getElementById("vagasTexto");

const modalEnviar = document.getElementById("modalEnviar");
const btnQuero = document.getElementById("btnQuero");
const fecharEnviar = document.getElementById("fecharEnviar");

const btnVerMinha = document.getElementById("btnVerMinha");

const form = document.getElementById("form");
const nomeEl = document.getElementById("nome");
const msgEl = document.getElementById("msg");
const termosEl = document.getElementById("termos");
const fotoEl = document.getElementById("foto");
const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");
const enviarBtn = document.getElementById("enviar");
const mensagemEl = document.getElementById("mensagem");

const memorialEl = document.getElementById("memorial");
const memorialBox = document.getElementById("memorialBox");
const memorialParaEl = document.getElementById("memorialPara");

const pagamentoBox = document.getElementById("pagamentoBox");
const comprovanteEl = document.getElementById("comprovante");
const payCode = document.getElementById("payCode");
const btnCopyPix = document.getElementById("btnCopyPix");

const modalVer = document.getElementById("modalVer");
const fecharVer = document.getElementById("fecharVer");
const viewFoto = document.getElementById("viewFoto");
const viewNome = document.getElementById("viewNome");
const viewSelo = document.getElementById("viewSelo");
const viewNum = document.getElementById("viewNum");
const viewMsg = document.getElementById("viewMsg");
const viewMemorial = document.getElementById("viewMemorial");
const viewData = document.getElementById("viewData");
const viewCreatorExtras = document.getElementById("viewCreatorExtras");

const statTotalMural = document.getElementById("statTotalMural");
const statPioneirosMural = document.getElementById("statPioneirosMural");
const statMembrosMural = document.getElementById("statMembrosMural");
const uptimeValue = document.getElementById("uptimeValue");

const searchName = document.getElementById("searchName");
const btnFuture = document.getElementById("btnFuture");
const btnMore = document.getElementById("btnMore");

document.getElementById("ano").textContent = new Date().getFullYear();

/* ===== estado ===== */
let modoPago = false; // após 100 pioneiros
let activeFilter = "all";
let searchTerm = "";
let futureMode = false;

let liveUnsub = null;
let lastDoc = null;
let isLoadingMore = false;

/* cache docs */
const docsMap = new Map(); // id -> docData

/* ===== UI helpers ===== */
function setMsg(text, ok=false){
  msgEl.textContent = text;
  msgEl.className = "msg " + (ok ? "ok" : "err");
}

function openEnviar(){
  modalEnviar.classList.remove("hidden");
  setMsg("", true);

  if(modoPago){
    pagamentoBox.classList.remove("hidden");
    comprovanteEl.required = true;
  }else{
    pagamentoBox.classList.add("hidden");
    comprovanteEl.required = false;
  }
}
function closeEnviar(){ modalEnviar.classList.add("hidden"); }

btnQuero.addEventListener("click", openEnviar);
fecharEnviar.addEventListener("click", closeEnviar);
modalEnviar.addEventListener("click", (e)=>{ if(e.target === modalEnviar) closeEnviar(); });

fecharVer.addEventListener("click", ()=> modalVer.classList.add("hidden"));
modalVer.addEventListener("click", (e)=>{ if(e.target === modalVer) modalVer.classList.add("hidden"); });

fotoEl.addEventListener("change", ()=>{
  const f = fotoEl.files?.[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
});

memorialEl.addEventListener("change", ()=>{
  if(memorialEl.checked) memorialBox.classList.remove("hidden");
  else memorialBox.classList.add("hidden");
});

payCode.textContent = `PIX (chave): ${PIX_KEY}`;
btnCopyPix.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(PIX_KEY);
    btnCopyPix.textContent = "COPIADO ✓";
    setTimeout(()=> btnCopyPix.textContent = "COPIAR", 900);
  }catch{
    setMsg("Não consegui copiar automaticamente. Copie manualmente.", false);
  }
});

/* ===== modo economia automático ===== */
function enableEcoMode(){
  document.body.classList.add("eco");
}
function autoEco(){
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(prefersReduced) return enableEcoMode();

  // deviceMemory: 0.5/1/2/4/8...
  const mem = navigator.deviceMemory || 0;
  if(mem && mem <= 2) enableEcoMode();

  // FPS check rápido
  let frames = 0;
  let start = performance.now();
  function raf(t){
    frames++;
    if(t - start < 1200){
      requestAnimationFrame(raf);
    }else{
      const fps = frames / ((t - start) / 1000);
      if(fps < 45) enableEcoMode();
    }
  }
  requestAnimationFrame(raf);
}
autoEco();

/* ===== Observador do Futuro ===== */
btnFuture.addEventListener("click", ()=>{
  futureMode = !futureMode;
  document.body.classList.toggle("future", futureMode);
  btnFuture.textContent = futureMode ? "👁️ Observador ON" : "👁️ Observador";
});

/* ===== filtros ===== */
document.querySelectorAll(".fbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".fbtn").forEach(b=> b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderFromCache();
  });
});

searchName.addEventListener("input", ()=>{
  searchTerm = (searchName.value || "").trim().toLowerCase();
  renderFromCache();
});

/* ===== uptime ===== */
const launchDate = new Date(LAUNCH_ISO);
function pad2(n){ return String(n).padStart(2,"0"); }
function updateUptime(){
  const now = new Date();
  let diff = Math.max(0, now - launchDate);

  const sec = Math.floor(diff / 1000);
  const minutes = Math.floor(sec / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const years = Math.floor(days / 365);
  const remDays = days - years*365;

  const remHours = hours % 24;
  const remMin = minutes % 60;
  const remSec = sec % 60;

  uptimeValue.textContent =
    `${years}a • ${remDays}d • ${pad2(remHours)}:${pad2(remMin)}:${pad2(remSec)}`;
}
setInterval(updateUptime, 1000);
updateUptime();

/* ===== compressão ===== */
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

/* ===== contadores (meta) ===== */
async function loadMeta(){
  const metaDoc = await getDoc(doc(db, META_REF));
  const data = metaDoc.exists() ? metaDoc.data() : {};
  const pioneirosAprovados = Number(data.pioneirosAprovados || 0);
  const restam = Math.max(0, TOTAL_PIONEIROS - pioneirosAprovados);
  vagasTexto.textContent = `Restam apenas ${restam} vagas`;
  modoPago = pioneirosAprovados >= TOTAL_PIONEIROS;
}
onSnapshot(doc(db, META_REF), (s)=>{
  const data = s.exists() ? s.data() : {};
  const pioneirosAprovados = Number(data.pioneirosAprovados || 0);
  const restam = Math.max(0, TOTAL_PIONEIROS - pioneirosAprovados);
  vagasTexto.textContent = `Restam apenas ${restam} vagas`;
  modoPago = pioneirosAprovados >= TOTAL_PIONEIROS;
});
await loadMeta();

/* ===== “ver minha foto” ===== */
function updateMinhaBtn(){
  const id = localStorage.getItem(LS_MY_ID);
  if(id) btnVerMinha.classList.remove("hidden");
  else btnVerMinha.classList.add("hidden");
}
updateMinhaBtn();

btnVerMinha.addEventListener("click", ()=>{
  const myId = localStorage.getItem(LS_MY_ID);
  if(!myId) return;

  document.getElementById("mural").scrollIntoView({ behavior:"smooth" });

  const el = grid.querySelector(`.card[data-id="${myId}"]`);
  if(el){
    el.classList.add("highlight");
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    setTimeout(()=> el.classList.remove("highlight"), 1200);
  }
});

/* ===== Timeline reveal ===== */
function initReveal(){
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add("on");
      }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll(".reveal").forEach(el=> obs.observe(el));
}
initReveal();

/* ===== skeleton inicial ===== */
function showSkeleton(count=8){
  grid.innerHTML = "";
  for(let i=0;i<count;i++){
    const c = document.createElement("div");
    c.className = "card skeleton";
    c.innerHTML = `<div class="skel"></div>`;
    grid.appendChild(c);
  }
}
showSkeleton(8);

/* ===== lazy-load ===== */
let imgObserver = null;
function ensureImgObserver(){
  if(imgObserver) return imgObserver;
  imgObserver = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const img = e.target;
      const src = img.dataset.src;
      if(src){
        img.src = src;
        delete img.dataset.src;
      }
      imgObserver.unobserve(img);
    });
  }, { rootMargin: "300px" });
  return imgObserver;
}

/* ===== classificação (33/33/33 + #100) ===== */
function getTierClass(numero){
  if(numero >= 1 && numero <= 33) return "tier-gold";
  if(numero >= 34 && numero <= 66) return "tier-silver";
  if(numero >= 67 && numero <= 99) return "tier-bronze";
  return "";
}

/* ===== render card ===== */
function makeCard(d, idx){
  const numero = Number(d.numero || 0);
  const isPioneiro = numero >= 1 && numero <= 100;
  const isMembro = numero >= 101;
  const isCreator = numero === 1; // #1 é você
  const isMilestone100 = numero === 100;

  const tier = getTierClass(numero);

  const card = document.createElement("div");
  card.className =
    "card " +
    (isPioneiro ? "pioneiro" : "membro") + " " +
    (tier ? tier : "") + " " +
    (isMilestone100 ? "milestone-100" : "") + " " +
    (isCreator ? "creator-1" : "");

  card.dataset.id = d.id;

  // stagger (entrada em sequência)
  card.style.animationDelay = `${Math.min(idx * 0.03, 0.5)}s`;

  const leftLabel = isCreator
    ? "CRIADOR"
    : (isMilestone100 ? "MARCO #100" : (isPioneiro ? "PIONEIRO" : "MEMBRO"));

  const leftClass = isCreator ? "creator" : "";

  // imagem lazy
  const imgAlt = (d.nome || "Participante");
  const photoSrc = d.fotoURL;

  card.innerHTML = `
    <div class="shine"></div>

    <span class="badge-left ${leftClass}">${leftLabel}${isCreator ? " 👑" : ""}</span>
    <span class="badge-right">#${numero}</span>

    <div class="photoRing"></div>

    <img data-src="${photoSrc}" alt="${imgAlt}">
    <div class="info">
      <p class="name">${d.nome || "Sem nome"}</p>
    </div>
  `;

  ensureImgObserver().observe(card.querySelector("img"));

  // clique abre modal
  card.addEventListener("click", ()=> openViewModal(d));

  return card;
}

/* ===== modal ver ===== */
function fmtData(ts){
  try{
    const dt = ts?.toDate ? ts.toDate() : new Date();
    return dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
  }catch{
    return new Date().toLocaleDateString("pt-BR");
  }
}

function openViewModal(d){
  viewFoto.src = d.fotoURL;
  viewNome.textContent = d.nome || "Sem nome";

  const numero = Number(d.numero || 0);
  const isPioneiro = numero >= 1 && numero <= 100;
  const isCreator = numero === 1;
  const isMilestone100 = numero === 100;

  if(isCreator){
    viewSelo.textContent = "CRIADOR";
    viewCreatorExtras.classList.remove("hidden");
  }else{
    viewCreatorExtras.classList.add("hidden");
    viewSelo.textContent = isMilestone100 ? "MARCO #100" : (isPioneiro ? "PIONEIRO" : "MEMBRO");
  }

  viewNum.textContent = `#${numero}`;

  // memorial
  if(d.memorial && d.memorialPara){
    viewMemorial.textContent = `🕯️ Em memória de ${d.memorialPara}`;
    viewMemorial.classList.remove("hidden");
  }else{
    viewMemorial.classList.add("hidden");
  }

  // mensagem
  const m = (d.mensagem || "").trim();
  if(m){
    viewMsg.textContent = m;
    viewMsg.classList.remove("hidden");
  }else{
    viewMsg.classList.add("hidden");
  }

  viewData.textContent = `Registrado em ${fmtData(d.approvedAt || d.createdAt)}`;
  modalVer.classList.remove("hidden");

  // Evento único do #100 (mostra uma vez por aparelho)
  if(isMilestone100){
    const key = "capsula_event100_seen_v1";
    if(!localStorage.getItem(key)){
      localStorage.setItem(key, "1");
      setTimeout(()=>{
        alert("🔥 A cápsula foi selada.\n\nO #100 entrou para a história.");
      }, 300);
    }
  }
}

/* ===== stats do mural ===== */
function updateMuralStats(list){
  const total = list.length;
  const pioneiros = list.filter(x => Number(x.numero)>=1 && Number(x.numero)<=100).length;
  const membros = list.filter(x => Number(x.numero)>=101).length;

  statTotalMural.textContent = String(total);
  statPioneirosMural.textContent = `${pioneiros} / 100`;
  statMembrosMural.textContent = String(membros);
}

/* ===== aplicar filtro/busca e renderizar ===== */
function passesFilter(d){
  const n = Number(d.numero || 0);

  if(activeFilter === "pioneiros") return n >= 1 && n <= 100;
  if(activeFilter === "membros") return n >= 101;
  return true;
}
function passesSearch(d){
  if(!searchTerm) return true;
  const name = (d.nome || "").toLowerCase();
  return name.includes(searchTerm);
}

function renderFromCache(){
  const list = Array.from(docsMap.values());

  // ordem: últimos aprovados primeiro (desc)
  // se faltar approvedAt em algum doc velho, ele vai “cair” pro final
  list.sort((a,b)=>{
    const ta = a.approvedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const tb = b.approvedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  const filtered = list.filter(d => passesFilter(d) && passesSearch(d));

  grid.innerHTML = "";
  updateMuralStats(list); // stats sempre do total carregado (não do filtro)

  filtered.forEach((d, idx)=>{
    grid.appendChild(makeCard(d, idx));
  });

  // se está filtrando e não tem nada
  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.style.width = "min(980px, 100%)";
    empty.style.textAlign = "center";
    empty.style.color = "rgba(255,255,255,.6)";
    empty.style.padding = "18px 0";
    empty.textContent = "Nada encontrado com esse filtro/busca.";
    grid.appendChild(empty);
  }
}

/* ===== Firestore: página ao vivo + carregar mais =====
   - página 1: onSnapshot (live)
   - load more: getDocs (sem live)
*/
const PAGE = 60;

function startLiveFirstPage(){
  if(liveUnsub) liveUnsub();

  const q1 = query(
    collection(db, "envios"),
    where("status", "==", "aprovado"),
    orderBy("approvedAt", "desc"),
    limit(PAGE)
  );

  liveUnsub = onSnapshot(q1, (snap)=>{
    // atualiza cache
    snap.docs.forEach(docu=>{
      const d = { id: docu.id, ...docu.data() };
      docsMap.set(d.id, d);
    });

    // guarda último doc da página
    lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;

    // render
    renderFromCache();
  });
}

async function loadMore(){
  if(isLoadingMore) return;
  if(!lastDoc) return;

  isLoadingMore = true;
  btnMore.textContent = "CARREGANDO...";
  btnMore.disabled = true;

  try{
    const qMore = query(
      collection(db, "envios"),
      where("status", "==", "aprovado"),
      orderBy("approvedAt", "desc"),
      startAfter(lastDoc),
      limit(PAGE)
    );

    const snap = await getDocs(qMore);
    snap.docs.forEach(docu=>{
      const d = { id: docu.id, ...docu.data() };
      docsMap.set(d.id, d);
    });

    lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;

    // se não veio nada, some botão
    if(snap.empty || snap.docs.length === 0){
      btnMore.textContent = "FIM";
      btnMore.disabled = true;
      btnMore.style.opacity = "0.6";
    }else{
      btnMore.textContent = "CARREGAR MAIS";
      btnMore.disabled = false;
    }

    renderFromCache();
  }catch(err){
    console.error(err);
    btnMore.textContent = "TENTAR DE NOVO";
    btnMore.disabled = false;

    // Se der erro de índice, o console mostra o link. Crie o índice e tente de novo.
  }finally{
    isLoadingMore = false;
  }
}

btnMore.addEventListener("click", loadMore);

startLiveFirstPage();

/* ===== envio ===== */
form.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const nome = (nomeEl.value || "").trim();
  const mensagem = (mensagemEl.value || "").trim();
  const foto = fotoEl.files?.[0];

  const memorial = !!memorialEl.checked;
  const memorialPara = (memorialParaEl.value || "").trim();

  if(nome.length < 2) return setMsg("Digite um nome válido.");
  if(nome.length > 40) return setMsg("Nome muito grande (máx 40).");
  if(!foto) return setMsg("Selecione uma foto.");
  if(!termosEl.checked) return setMsg("Você precisa aceitar os termos.");

  if(mensagem.length > 240) return setMsg("Mensagem muito grande (máx 240).");
  if(/https?:\/\//i.test(mensagem)) return setMsg("Sem links na mensagem.");

  if(memorial && memorialPara.length < 2) return setMsg("No modo memorial, preencha o nome (em memória de...).");

  let comprovanteFile = null;
  if(modoPago){
    comprovanteFile = comprovanteEl.files?.[0];
    if(!comprovanteFile) return setMsg("Após os 100 pioneiros, envie o comprovante do Pix.", false);
  }

  enviarBtn.disabled = true;
  enviarBtn.style.filter = "grayscale(1)";
  setMsg("Enviando... aguarde", true);

  try{
    // 1) foto
    const blob = await compressImage(foto, 1400, 0.82);
    const safeName = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const fotoName = `${Date.now()}-${safeName}.jpg`;
    const fotoPath = `mural/${fotoName}`;
    const fotoRef = ref(storage, fotoPath);
    await uploadBytes(fotoRef, blob, { contentType: "image/jpeg" });
    const fotoURL = await getDownloadURL(fotoRef);

    // 2) comprovante (privado)
    let comprovantePath = undefined;
    if(modoPago){
      const compBlob = await compressImage(comprovanteFile, 1400, 0.85);
      const compName = `${Date.now()}-comp-${safeName}.jpg`;
      comprovantePath = `comprovantes/${compName}`;
      const compRef = ref(storage, comprovantePath);
      await uploadBytes(compRef, compBlob, { contentType: "image/jpeg" });
    }

    const status = modoPago ? "pendente_pagamento" : "pendente";

    const docRef = await addDoc(collection(db, "envios"), {
      nome,
      mensagem,
      memorial,
      memorialPara,
      status,
      createdAt: serverTimestamp(),
      fotoURL,
      fotoPath,
      ...(comprovantePath ? { comprovantePath } : {})
    });

    localStorage.setItem(LS_MY_ID, docRef.id);
    updateMinhaBtn();

    setMsg(modoPago
      ? "Recebido! Agora aguarde a aprovação do admin ✅"
      : "Recebido! Aguarde aprovação para aparecer no mural ✅"
    , true);

    form.reset();
    previewWrap.classList.add("hidden");
    memorialBox.classList.add("hidden");
    pagamentoBox.classList.add("hidden");

    setTimeout(()=>{
      closeEnviar();
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

/* ===== Tilt no PC (bem discreto) ===== */
function initTilt(){
  if(!window.matchMedia?.("(hover:hover)")?.matches) return;
  grid.addEventListener("mousemove", (e)=>{
    const card = e.target.closest?.(".card");
    if(!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const tiltX = (-y * 6).toFixed(2);
    const tiltY = (x * 6).toFixed(2);
    card.style.transform = `perspective(700px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
  });
  grid.addEventListener("mouseleave", ()=>{
    grid.querySelectorAll(".card").forEach(c=>{
      c.style.transform = "";
    });
  });
}
initTilt();

/* ===== PWA ===== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
