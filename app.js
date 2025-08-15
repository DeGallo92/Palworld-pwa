
const SKILLS = ["Legend","DG","V","DB","EF","SV","HIK","EE","KW","RC","Lucky"];
const storeKey = "palworld-tracker-v1";
const paldexKey = "palworld-paldex-v1"; // { [name]: "10" | "10B" ... }
let store = loadStore();
let paldexMap = {};

function loadStore(){
  const raw = localStorage.getItem(storeKey);
  if(!raw) return { pals:{}, allCombos:[] };
  try{
    const obj = JSON.parse(raw);
    if(!obj.pals) obj.pals = {};
    if(!obj.allCombos) obj.allCombos = [];
    return obj;
  }catch(e){ return { pals:{}, allCombos:[] }; }
}
function saveStore(s){ localStorage.setItem(storeKey, JSON.stringify(s)); }
function savePaldex(p){ localStorage.setItem(paldexKey, JSON.stringify(p)); }

async function ensurePaldex(){
  let raw = localStorage.getItem(paldexKey);
  if(raw){ 
    try{ paldexMap = JSON.parse(raw) || {}; }catch{ paldexMap = {}; }
  } else {
    try{
      const resp = await fetch('paldex.json');
      if(resp.ok){
        paldexMap = await resp.json();
        savePaldex(paldexMap);
      }
    }catch(e){ paldexMap = {}; }
  }
  refreshNameList();
}

// UI refs
const paldexInput = document.getElementById("paldex");
const palnameInput = document.getElementById("palname");
const skillsSelect = document.getElementById("skills");
const hasM = document.getElementById("hasM");
const hasF = document.getElementById("hasF");
const addBtn = document.getElementById("addBtn");
const msg = document.getElementById("msg");
const search = document.getElementById("search");
const showMissingM = document.getElementById("showMissingM");
const showMissingF = document.getElementById("showMissingF");
const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const resetBtn = document.getElementById("resetBtn");
const installBtn = document.getElementById("installBtn");
const palnameDatalist = document.getElementById("palnames");
const settingsDlg = document.getElementById("settingsDlg");
const openSettingsBtn = document.getElementById("openSettings");
const closeSettingsBtn = document.getElementById("closeSettings");
const importPaldexInput = document.getElementById("importPaldex");
const downloadPaldexBtn = document.getElementById("downloadPaldex");
const palDexManual = document.getElementById("palDexManual");
const palNameManual = document.getElementById("palNameManual");
const addPaldexBtn = document.getElementById("addPaldexBtn");
const pasteEl = document.getElementById("pastePaldex");
const parseBtn = document.getElementById("parsePaldexBtn");

function normalizeCombo(skills){
  const arr = Array.from(new Set(skills)).filter(Boolean);
  arr.sort();
  return arr.join(" + ");
}
function toast(t){ msg.textContent=t; setTimeout(()=> msg.textContent="",1500); }

function refreshNameList(){
  if(!palnameDatalist) return;
  palnameDatalist.innerHTML = "";
  Object.keys(paldexMap).sort().forEach(name=>{
    const opt = document.createElement("option");
    opt.value = name;
    palnameDatalist.appendChild(opt);
  });
}

function filteredPalNames(){
  const q = (search.value||"").toLowerCase();
  return Object.keys(store.pals).filter(n=> n.toLowerCase().includes(q)).sort();
}
function buildColumns(){
  const cols = ["Paldex #","Pal"];
  store.allCombos.forEach(c=> cols.push(c));
  return cols;
}
function cellFor(val){
  const div = document.createElement("div");
  div.className = "cell";
  if(!val) return div;
  if(val.M && val.F) div.classList.add("mf");
  else if(val.M) div.classList.add("m");
  else if(val.F) div.classList.add("f");
  return div;
}

function renderTable(){
  // header
  thead.innerHTML = "";
  const trh = document.createElement("tr");
  buildColumns().forEach(c=>{
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  // body
  tbody.innerHTML = "";
  filteredPalNames().forEach(name=>{
    const tr = document.createElement("tr");
    const pal = store.pals[name];
    const tdDex = document.createElement("td");
    tdDex.textContent = pal.paldex ?? "";
    tr.appendChild(tdDex);
    const tdName = document.createElement("td");
    tdName.textContent = name;
    tdName.style.textAlign = "left";
    tr.appendChild(tdName);
    store.allCombos.forEach(combo=>{
      const td = document.createElement("td");
      const val = pal.combos[combo] || null;
      td.appendChild(cellFor(val));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}


function addOrUpdate(){
  const paldex = paldexInput.value ? String(paldexInput.value).trim() : null;
  let palname = (palnameInput.value||"").trim();
  const selected = Array.from(skillsSelect.selectedOptions).map(o=>o.value);
  const comboKey = normalizeCombo(selected);
  const m = !!hasM.checked;
  const f = !!hasF.checked;

  if(!palname){ toast("Geef een Pal naam op."); return; }
  if(selected.length===0){ toast("Kies minstens 1 skill."); return; }
  if(selected.length>4){ toast("Max 4 skills per combo."); return; }
  if(!m && !f){ toast("Vink M en/of F aan."); return; }

  // Canonicalize name via palpedia
  const lower = palname.toLowerCase();
  const canon = Object.keys(paldexMap).find(k=> k.toLowerCase()===lower);
  if(canon){
    palname = canon;
    palnameInput.value = canon;
    paldexInput.value = paldexMap[canon];
  }

  if(!store.pals[palname]) store.pals[palname] = { paldex: paldex, combos: {} };
  if(paldex!==null) store.pals[palname].paldex = paldex;

  const prev = store.pals[palname].combos[comboKey] || { M:false, F:false };
  const updated = { M: prev.M || m, F: prev.F || f };

  // Messaging logic
  let message = "";
  if(prev.M && prev.F && !m && !f){
    message = "Deze Pal + combo was al compleet (M+F).";
  } else if(prev.M === updated.M && prev.F === updated.F){
    message = "Geen wijziging: je had dit al.";
  } else if((prev.M && !prev.F && f) || (prev.F && !prev.M && m)){
    message = "Nice! Deze combo is nu compleet (M+F).";
  } else if(!prev.M && !prev.F && (m || f)){
    message = "Toegevoegd.";
  } else {
    message = "Bijgewerkt.";
  }

  store.pals[palname].combos[comboKey] = updated;

  // Auto-add unseen combination as a new column (already supported)
  if(!store.allCombos.includes(comboKey)){
    store.allCombos.push(comboKey);
    store.allCombos.sort((a,b)=> a.localeCompare(b));
    // Let the user know a new column was created
    message += ` Nieuwe skillcombinatie gedetecteerd: "${comboKey}" — kolom toegevoegd.`;
  }

  saveStore(store);
  renderTable();
  toast(message);
  hasM.checked = false; hasF.checked = false;
}

  if(selected.length===0){ toast("Kies minstens 1 skill."); return; }
  if(selected.length>4){ toast("Max 4 skills per combo."); return; }
  if(!m && !f){ toast("Vink M en/of F aan."); return; }

  // Canonicalize name via palpedia
  const lower = palname.toLowerCase();
  const canon = Object.keys(paldexMap).find(k=> k.toLowerCase()===lower);
  if(canon){
    palname = canon;
    palnameInput.value = canon;
    paldexInput.value = paldexMap[canon];
  }

  if(!store.pals[palname]) store.pals[palname] = { paldex: paldex, combos: {} };
  if(paldex!==null) store.pals[palname].paldex = paldex;

  const prev = store.pals[palname].combos[comboKey] || { M:false, F:false };
  const updated = { M: prev.M || m, F: prev.F || f };
  store.pals[palname].combos[comboKey] = updated;

  if(!store.allCombos.includes(comboKey)){
    store.allCombos.push(comboKey);
    store.allCombos.sort((a,b)=> a.localeCompare(b));
  }

  saveStore(store);
  renderTable();
  toast(prev.M || prev.F ? "Bijgewerkt" : "Toegevoegd");
  hasM.checked = false; hasF.checked = false;
}

document.getElementById("palname").addEventListener("change", ()=>{
  const name = (palnameInput.value||"").trim();
  const id = paldexMap[name];
  if(id!=null) paldexInput.value = id;
});

addBtn.addEventListener("click", addOrUpdate);
search.addEventListener("input", renderTable);
showMissingM.addEventListener("change", renderTable);
showMissingF.addEventListener("change", renderTable);

exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(store,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "palworld_tracker_export.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
importInput.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(obj && obj.pals && obj.allCombos){
        store = obj;
        saveStore(store);
        renderTable();
        toast("Import geslaagd");
      }else toast("Bestand niet herkend");
    }catch{ toast("Ongeldig JSON"); }
  };
  reader.readAsText(file);
});
resetBtn.addEventListener("click", ()=>{
  if(confirm("Alles wissen?")){
    store = { pals:{}, allCombos:[] };
    saveStore(store);
    renderTable();
  }
});

// Settings dialog
openSettingsBtn.addEventListener("click", ()=> settingsDlg.showModal());
closeSettingsBtn.addEventListener("click", ()=> settingsDlg.close());

downloadPaldexBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(paldexMap,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "paldex.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
importPaldexInput.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(obj && typeof obj === 'object'){
        paldexMap = obj;
        savePaldex(paldexMap);
        refreshNameList();
        toast("Palpedia geïmporteerd");
      } else toast("JSON niet herkend");
    }catch{ toast("Ongeldige JSON"); }
  };
  reader.readAsText(file);
});
if(parseBtn){
  parseBtn.addEventListener("click", ()=>{
    const txt = (pasteEl.value||"").trim();
    if(!txt){ toast("Plak eerst tekst in het vak."); return; }
    const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const map = {};
    for(let i=0;i<lines.length;i++){
      const m = lines[i].match(/^(\d+)([A-Za-z]?)$/);
      if(m){
        const id = m[1] + (m[2]||"");
        // find next 'name' line
        let j=i+1;
        while(j<lines.length && !/^[A-Za-z][A-Za-z' -]*$/.test(lines[j])) j++;
        if(j<lines.length){
          const name = lines[j];
          map[name] = id;
          i = j;
        }
      }
    }
    const count = Object.keys(map).length;
    if(!count){ toast("Geen namen gevonden."); return; }
    paldexMap = { ...paldexMap, ...map };
    savePaldex(paldexMap);
    refreshNameList();
    toast(`Palpedia bijgewerkt (${count} namen).`);
  });
}

// PWA install
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',(e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

// Service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js'));
}

renderTable();
ensurePaldex();
