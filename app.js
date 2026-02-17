import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxtp2inskZ8qrjGk6KcSZo7PkvkwVHTy4",
  authDomain: "a-maior-capsula-do-tempo.firebaseapp.com",
  projectId: "a-maior-capsula-do-tempo",
  storageBucket: "a-maior-capsula-do-tempo.firebasestorage.app",
  messagingSenderId: "1097704950592",
  appId: "1:1097704950592:web:28b8e856804333b43208a5",
  measurementId: "G-N1TJ67KLWM"
};


const btnCopyPix = document.getElementById("btnCopyPix");
const pixText = document.getElementById("pixText");

async function copiarPix(){
  const pix = (pixText?.textContent || "").trim();
  if(!pix) return;

  try{
    await navigator.clipboard.writeText(pix);
    setMsg("Chave Pix copiada ✅", true);
  }catch{
    // fallback (caso clipboard bloqueie)
    const ta = document.createElement("textarea");
    ta.value = pix;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setMsg("Chave Pix copiada ✅", true);
  }
}

if(btnCopyPix){
  btnCopyPix.addEventListener("click", copiarPix);
}


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const TOTAL_PIONEIROS = 100;
const META_REF = doc(db, "meta", "contadores");
const LS_MY_ID = "capsula_meu_envio_id_v1";

const grid = document.getElementById("grid");
const vagasTexto = document.getElementById("vagasTexto");

const modal = document.getElementById("modal");
const btnQuero = document.getElementById("btnQuero");
const fecharModal = document.getElementById("fecharModal");

const btnVerMinha = document.getElementById("btnVerMinha");

const form = document.getElementById("form");
const nomeEl = document.getElementById("nome");
const mensagemEl = document.getElementById("mensagem");
const fotoEl = document.getElementById("foto");
const termosEl = document.getElementById("termos");
const comprovanteEl = document.getElementById("comprovante");
const pagamentoBox = document.getElementById("pagamentoBox");

const msgEl = document.getElementById("msg");
const enviarBtn = document.getElementById("enviar");

const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");

const modalView = document.getElementById("modalView");
const fecharView = document.getElementById("fecharView");
const viewImg = document.getElementById("viewImg");
const viewNome = document.getElementById("viewNome");
const viewMsg = document.getElementById("viewMsg");
const viewData = document.getElementById("viewData");
const viewSelo = document.getElementById("viewSelo");
const viewNum = document.getElementById("viewNum");

document.getElementById("ano").textContent = new Date().getFullYear();

function setMsg(texto, ok=false){
  msgEl.textContent = texto;
  msgEl.className = "msg " + (ok ? "ok" : "err");
}

function openModal(){
  modal.classList.remove("hidden");
  setMsg("", true);

  // Mostra pagamento só quando pioneiros aprovados já bateram 100
  if (state.modoPago){
    pagamentoBox.classList.remove("hidden");
    comprovanteEl.required = true;
  } else {
    pagamentoBox.classList.add("hidden");
    comprovanteEl.required = false;
  }
}
function closeModal(){ modal.classList.add("hidden"); }

btnQuero.addEventListener("click", openModal);
fecharModal.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

fecharView.addEventListener("click", () => modalView.classList.add("hidden"));
modalView.addEventListener("click", (e) => { if(e.target === modalView) modalView.classList.add("hidden"); });

fotoEl.addEventListener("change", () => {
  const f = fotoEl.files?.[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
});

function updateMinhaFotoButton(){
  const id = localStorage.getItem(LS_MY_ID);
  if(id) btnVerMinha.classList.remove("hidden");
  else btnVerMinha.classList.add("hidden");
}

btnVerMinha.addEventListener("click", () => {
  const myId = localStorage.getItem(LS_MY_ID);
  if(!myId) return;

  const el = grid.querySelector(`.card[data-id="${myId}"]`);
  document.getElementById("mural").scrollIntoView({ behavior:"smooth" });

  if(!el) return;

  document.querySelectorAll(".card.highlight").forEach(c => c.classList.remove("highlight"));
  el.classList.add("highlight");
  el.scrollIntoView({ behavior:"smooth", block:"center" });
});

updateMinhaFotoButton();

/* =========================
   Estado do site (pioneiros)
========================= */
const state = {
  pioneirosAprovados: 0,
  modoPago: false
};

// Lê contadores (quantos pioneiros já foram aprovados)
onSnapshot(META_REF, (snap) => {
  const data = snap.exists() ? snap.data() : { pioneirosAprovados: 0 };
  const usados = Number(data.pioneirosAprovados || 0);
  const restam = Math.max(0, TOTAL_PIONEIROS - usados);

  state.pioneirosAprovados = usados;
  state.modoPago = usados >= TOTAL_PIONEIROS;

  vagasTexto.textContent = `Restam apenas ${restam} vagas de PIONEIRO`;
});

/* =========================
   Compressão automática
========================= */
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

  const toBlob = (q) => new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", q);
  });

  let blob = await toBlob(quality);
  for(let tries = 0; tries < 6 && blob && blob.size > maxBytes; tries++){
    quality = Math.max(0.5, quality - 0.08);
    blob = await toBlob(quality);
  }
  if(!blob) throw new Error("Falha ao comprimir imagem.");
  return blob;
}

/* =========================
   Mural público (somente aprovados)
   - não mostra “ver mensagem”
   - só selo PIONEIRO/MEMBRO
   - clique abre modal surpresa
========================= */
function formatDate(ts){
  try{
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
  }catch{
    return "";
  }
}

function cardLabel(d){
  const isPioneiro = Number.isFinite(d.pioneiroNumero) && d.pioneiroNumero >= 1 && d.pioneiroNumero <= 100;
  return {
    selo: isPioneiro ? "PIONEIRO" : "MEMBRO",
    num: isPioneiro ? `#${d.pioneiroNumero}` : "∞"
  };
}

function openViewModal(d){
  const { selo, num } = cardLabel(d);

  viewImg.src = d.fotoURL;
  viewNome.textContent = d.nome || "";
  viewSelo.textContent = selo;
  viewNum.textContent = num;

  const msg = (d.mensagem || "").trim();
  viewMsg.textContent = msg ? `“${msg}”` : "“...”";
  viewData.textContent = d.createdAt ? `Registrado em ${formatDate(d.createdAt)}` : "";

  modalView.classList.remove("hidden");
}

function makeCard(d){
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = d.id;

  const { selo, num } = cardLabel(d);

  card.innerHTML = `
    <span class="badge-left">${selo}</span>
    <span class="badge-right">${num}</span>
    <img src="${d.fotoURL}" alt="${d.nome}">
    <p class="name">${d.nome}</p>
  `;

  card.addEventListener("click", () => openViewModal(d));
  return card;
}

const muralQ = query(
  collection(db, "envios"),
  where("status", "==", "aprovado"),
  orderBy("createdAt", "desc"),
  limit(200)
);

onSnapshot(muralQ, (snap) => {
  const docs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
  grid.innerHTML = "";
  docs.forEach(d => grid.appendChild(makeCard(d)));
});

/* =========================
   Envio público
   - grátis até 100 pioneiros aprovados: status "pendente"
   - depois: exige comprovante e status "pendente_pagamento"
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = (nomeEl.value || "").trim();
  const mensagem = (mensagemEl.value || "").trim();
  const foto = fotoEl.files?.[0];

  if(nome.length < 2) return setMsg("Digite um nome válido.");
  if(nome.length > 40) return setMsg("Nome muito grande (máx 40).");
  if(mensagem.length > 240) return setMsg("Mensagem muito grande (máx 240).");
  if(!foto) return setMsg("Selecione uma foto.");
  if(!termosEl.checked) return setMsg("Você precisa aceitar os termos.");
  if(!foto.type.startsWith("image/")) return setMsg("Arquivo inválido. Envie uma imagem.");

  // Se modo pago: comprovante obrigatório
  let comprovante = null;
  if(state.modoPago){
    comprovante = comprovanteEl.files?.[0];
    if(!comprovante) return setMsg("Após os 100 pioneiros, envie o comprovante do Pix.", false);
    if(!comprovante.type.startsWith("image/")) return setMsg("Comprovante inválido. Envie uma imagem.", false);
  }

  enviarBtn.disabled = true;
  enviarBtn.style.filter = "grayscale(1)";
  setMsg("Enviando... aguarde", true);

  try{
    // 1) comprime foto
    const fotoBlob = await compressImage(foto);

    // 2) sobe foto pro Storage
    const safeName = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const fotoName = `${Date.now()}-${safeName}.jpg`;
    const fotoRef = ref(storage, `mural/${fotoName}`);
    await uploadBytes(fotoRef, fotoBlob, { contentType: "image/jpeg" });
    const fotoURL = await getDownloadURL(fotoRef);

    // 3) se pago, sobe comprovante
    let comprovanteURL = "";
    if(state.modoPago){
      const compBlob = await compressImage(comprovante, 1400, 0.85, 1.9 * 1024 * 1024);
      const compName = `${Date.now()}-comprovante.jpg`;
      const compRef = ref(storage, `comprovantes/${compName}`);
      await uploadBytes(compRef, compBlob, { contentType: "image/jpeg" });
      comprovanteURL = await getDownloadURL(compRef);
    }

    // 4) cria envio no Firestore
    const status = state.modoPago ? "pendente_pagamento" : "pendente";

    const docRef = await addDoc(collection(db, "envios"), {
      nome,
      mensagem,
      fotoURL,
      comprovanteURL: comprovanteURL || "",
      status,
      createdAt: serverTimestamp(),
      pioneiroNumero: null
    });

    localStorage.setItem(LS_MY_ID, docRef.id);
    updateMinhaFotoButton();

    if(state.modoPago){
      setMsg("Recebido ✅ Seu envio está pendente de confirmação do pagamento.", true);
    }else{
      setMsg("Recebido ✅ Seu envio está pendente de aprovação.", true);
    }

    form.reset();
    previewWrap.classList.add("hidden");

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
