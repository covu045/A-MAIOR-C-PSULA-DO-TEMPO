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

const ADMIN_EMAIL = "mateusgoncalvesayala@gmail.com";
const PIX_KEY = "c616ef49-60b6-42eb-acc9-0ef28dc2de56";

const TOTAL_PIONEIROS = 100;
const META_REF = "meta/contadores";
const LS_MY_ID = "capsula_meu_envio_id_v2";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

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

document.getElementById("ano").textContent = new Date().getFullYear();

let modoPago = false; // após 100 pioneiros

/* ===== UI helpers ===== */
function setMsg(text, ok=false){
  msgEl.textContent = text;
  msgEl.className = "msg " + (ok ? "ok" : "err");
}

function openEnviar(){
  modalEnviar.classList.remove("hidden");
  setMsg("", true);
  // estado pagamento
  if(modoPago){
    pagamentoBox.classList.remove("hidden");
    comprovanteEl.required = true;
  }else{
    pagamentoBox.classList.add("hidden");
    comprovanteEl.required = false;
  }
}
function closeEnviar(){
  modalEnviar.classList.add("hidden");
}

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

/* ===== contadores ===== */
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
  const el = grid.querySelector(`.card[data-id="${myId}"]`);
  document.getElementById("mural").scrollIntoView({ behavior:"smooth" });
  if(el){
    el.classList.add("highlight");
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    setTimeout(()=> el.classList.remove("highlight"), 1200);
  }
});

/* ===== render card premium ===== */
function makeCard(d){
  const numero = Number(d.numero || 0); // # sempre
  const isPioneiro = numero >= 1 && numero <= 100;

  const card = document.createElement("div");
  card.className = "card " + (isPioneiro ? "pioneiro" : "membro");
  card.dataset.id = d.id;

  const isCreator = (d.nome || "").trim().toLowerCase() === "mateus ayala";

  card.innerHTML = `
    <span class="badge-left ${isCreator ? "creator" : ""}">
      ${isCreator ? "CRIADOR" : (isPioneiro ? "PIONEIRO" : "MEMBRO")}
    </span>

    <span class="badge-right">#${numero}</span>

    <img src="${d.fotoURL}" alt="${(d.nome || "Participante")}">

    <div class="info">
      <p class="name">${d.nome || "Sem nome"}</p>
    </div>
  `;

  // clique abre modal surpresa
  card.addEventListener("click", ()=>{
    openViewModal(d);
  });

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
  const isCreator = (d.nome || "").trim().toLowerCase() === "mateus ayala";

  viewSelo.textContent = isCreator ? "CRIADOR" : (isPioneiro ? "PIONEIRO" : "MEMBRO");
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
}

/* ===== mural aprovado =====
   - lê somente aprovados
   - ordem por numero ASC (fica #1, #2, #3...)
   (vai pedir índice: status + numero)
*/
const q = query(
  collection(db, "envios"),
  where("status", "==", "aprovado"),
  orderBy("numero", "asc"),
  limit(200)
);

onSnapshot(q, (snap)=>{
  const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
  grid.innerHTML = "";
  docs.forEach(d => grid.appendChild(makeCard(d)));
});

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

  // modo pago exige comprovante
  let comprovanteFile = null;
  if(modoPago){
    comprovanteFile = comprovanteEl.files?.[0];
    if(!comprovanteFile) return setMsg("Após os 100 pioneiros, envie o comprovante do Pix.", false);
  }

  enviarBtn.disabled = true;
  enviarBtn.style.filter = "grayscale(1)";
  setMsg("Enviando... aguarde", true);

  try{
    // 1) foto (compress + upload)
    const blob = await compressImage(foto, 1400, 0.82);
    const safeName = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const fotoName = `${Date.now()}-${safeName}.jpg`;
    const fotoPath = `mural/${fotoName}`;
    const fotoRef = ref(storage, fotoPath);
    await uploadBytes(fotoRef, blob, { contentType: "image/jpeg" });
    const fotoURL = await getDownloadURL(fotoRef);

    // 2) comprovante (se modo pago) - privado
    let comprovantePath = undefined;
    if(modoPago){
      const compBlob = await compressImage(comprovanteFile, 1400, 0.85);
      const compName = `${Date.now()}-comp-${safeName}.jpg`;
      comprovantePath = `comprovantes/${compName}`;
      const compRef = ref(storage, comprovantePath);
      await uploadBytes(compRef, compBlob, { contentType: "image/jpeg" });
    }

    // 3) cria envio pendente / pendente_pagamento
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

/* ===== PWA opcional ===== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
