/* DoseVital — lógica do site (dados em js/dados.js). Pacientes e fichas ficam no navegador (localStorage). */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const REG = Object.fromEntries(REGIOES.map(r => [r.id, r.nome]));
const EXID = Object.fromEntries(EXERCICIOS.map(e => [e.id, e]));
const GRUPOS = { none: "Sem equipamento", elastic: "Elástico", ball: "Bola", weights: "Pesos", pilates: "Pilates", balance: "Equilíbrio", support: "Apoio", other: "Outros" };
const KEY = "dosevital:v1";

let S = { pac: [], fis: [], hist: {}, ficha: [], pid: "", fid: "" };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
let reg = "", vista = "frente", histPid = "", filtro = { r: "", g: "", c: "" };
const aberto = new Set(), editando = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

let tt;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); }
function show(p) {
  document.querySelectorAll(".tab-content").forEach(x => x.classList.toggle("active", x.id === "p-" + p));
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.toggle("active", x.dataset.p === p));
  window.scrollTo(0, 0);
}

/* Foto do exercício: salve o arquivo em img/exercicios/<id>.webp (ou .jpg / .png). Sem arquivo, aparece só a região. */
const foto = e => `<div class="ph"><span>${esc(REG[e.r[0]])}</span><img src="img/exercicios/${e.id}.webp" alt="${esc(e.n)}" loading="lazy" data-x="0"></div>`;
document.addEventListener("error", ev => {
  const i = ev.target; if (i.tagName !== "IMG" || i.dataset.x === undefined) return;
  const n = +i.dataset.x, ext = ["jpg", "png"];
  if (n < 2) { i.dataset.x = n + 1; i.src = i.src.replace(/\.\w+$/, "." + ext[n]); } else i.remove();
}, true);

/* ---------- mapa corporal ---------- */
function mapa() {
  $("vistas").innerHTML = Object.entries(VISTAS).map(([k, v]) => `<button class="view-btn ${k === vista ? "active" : ""}" data-v="${k}">${v.nome}</button>`).join("");
  const v = VISTAS[vista], [, , w, h] = v.vb.split(" ").map(Number);
  const at = r => `class="hs ${r === reg ? "sel" : ""}" data-r="${r}" role="button" tabindex="0" aria-label="${esc(REG[r])}"`;
  let s = `<svg viewBox="${v.vb}">`;
  if (v.poly) s += `<g transform="translate(${v.dx} 0)">` + v.poly.map(p => `<path ${at(p.r)} d="${p.d}"><title>${esc(REG[p.r])}</title></path><path ${at(p.r)} d="${p.d}" transform="translate(${p.m} 0) scale(-1 1)"><title>${esc(REG[p.r])}</title></path>`).join("") + "</g>";
  else s += v.el.map(([r, x, y, rx, ry]) => `<ellipse ${at(r)} cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"><title>${esc(REG[r])}</title></ellipse>`).join("");
  $("fig").style.aspectRatio = w + "/" + h;
  $("fig").innerHTML = `<img src="${v.img}" alt="Corpo — ${v.nome}">` + s + "</svg>";
  $("sel-tag").textContent = reg ? REG[reg] : "Todas as Regiões";
}

/* ---------- biblioteca e busca ---------- */
const tags = e => [...new Set(e.e.map(x => EQUIP[x].l))].map(l => `<span class="tag">${esc(l)}</span>`).join("") + e.c.map(c => `<span class="tag">${esc(CATEG[c])}</span>`).join("");
function linha(e) {
  const tem = S.ficha.some(i => i.id === e.id);
  return `<div class="exercise-card-item">${foto(e)}<div class="exercise-info"><h4>${esc(e.n)}</h4>${tags(e)}</div><button class="btn btn-primary btn-sm" data-add="${e.id}" ${tem ? "disabled" : ""}>${tem ? "Na ficha" : "+ Adicionar"}</button></div>`;
}
const texto = e => norm([e.n, e.e.map(x => EQUIP[x].l).join(" "), e.c.map(c => CATEG[c]).join(" "), e.r.map(r => REG[r]).join(" ")].join(" "));
const casa = (e, q) => !q || q.split(/\s+/).every(w => texto(e).includes(w));
function biblioteca() {
  const q = norm($("q-lib").value.trim()), l = EXERCICIOS.filter(e => (!reg || e.r.includes(reg)) && casa(e, q));
  $("cnt-lib").textContent = `${l.length} Exercícios`;
  $("regs").innerHTML = `<button class="filter-pill ${reg ? "" : "active"}" data-r="">Todas as Regiões</button>` + REGIOES.map(r => `<button class="filter-pill ${r.id === reg ? "active" : ""}" data-r="${r.id}">${esc(r.nome)}</button>`).join("");
  $("grid").innerHTML = l.map(linha).join("") || '<div class="empty-state">Nenhum exercício encontrado.</div>';
}
function busca() {
  const q = norm($("q").value.trim());
  const grupo = (k, rot, opc) => `<div class="fl"><span>${rot}</span><div class="filter-pills-container"><button class="filter-pill ${filtro[k] ? "" : "active"}" data-f="${k}|">Todos</button>${opc.map(([v, t]) => `<button class="filter-pill ${filtro[k] === v ? "active" : ""}" data-f="${k}|${v}">${esc(t)}</button>`).join("")}</div></div>`;
  $("filtros").innerHTML = grupo("r", "Região", REGIOES.map(r => [r.id, r.nome])) + grupo("g", "Equipamento", Object.entries(GRUPOS)) + grupo("c", "Tipo de exercício", Object.entries(CATEG));
  const l = EXERCICIOS.filter(e => (!filtro.r || e.r.includes(filtro.r)) && (!filtro.g || e.e.some(x => EQUIP[x].g === filtro.g)) && (!filtro.c || e.c.includes(filtro.c)) && casa(e, q));
  $("rc").textContent = `${l.length} exercício${l.length === 1 ? "" : "s"} encontrado${l.length === 1 ? "" : "s"}`;
  $("sgrid").innerHTML = l.map(linha).join("") || '<div class="empty-state">Nenhum exercício encontrado.</div>';
}

/* ---------- ficha ativa ---------- */
const dose = i => `<b>${i.s}</b> séries <b>${i.a}${i.b && i.b !== i.a ? "-" + i.b : ""}</b> repetições`;
const doseTxt = i => `${i.s} séries ${i.a}${i.b && i.b !== i.a ? "-" + i.b : ""} repetições`;
const pac = () => S.pac.find(p => p.id === S.pid);
const fisio = () => S.fis.find(f => f.id === S.fid);
function ficha() {
  const n = S.ficha.length;
  $("f-n").textContent = `${n} exercício${n === 1 ? "" : "s"} na lista`;
  $("f-pac").innerHTML = `<option value="">-- Selecione um paciente cadastrado --</option>` + S.pac.map(p => `<option value="${p.id}" ${p.id === S.pid ? "selected" : ""}>${esc(p.nome)}</option>`).join("");
  const p = pac(); $("f-idade").value = p ? p.idade + " anos" : ""; $("f-diag").value = p ? p.diag : "";
  $("f-fis").innerHTML = `<option value="">-- Selecione o fisioterapeuta --</option>` + S.fis.map(f => `<option value="${f.id}" ${f.id === S.fid ? "selected" : ""}>${esc(f.nome)}</option>`).join("");
  $("f-crefito").value = fisio() ? fisio().crefito : "";
  $("itens").innerHTML = S.ficha.map((i, k) => {
    const e = EXID[i.id];
    return `<div class="it"><div class="top"><span class="num">${String(k + 1).padStart(2, "0")}</span>${foto(e)}<div><div class="nm">${esc(e.n)}</div><div class="dose">${dose(i)}</div>${i.obs ? `<div class="obs">Obs.: ${esc(i.obs)}</div>` : ""}</div></div>` +
      (editando.has(i.id) ? `<div class="ed"><div><label class="obs">Séries</label><input class="form-control" type="number" min="1" data-k="s" data-i="${k}" value="${i.s}"></div><div><label class="obs">Repetições (mín.)</label><input class="form-control" type="number" min="1" data-k="a" data-i="${k}" value="${i.a}"></div><div><label class="obs">Repetições (máx.)</label><input class="form-control" type="number" min="1" data-k="b" data-i="${k}" value="${i.b}"></div><div class="full"><label class="obs">Observações</label><input class="form-control" data-k="obs" data-i="${k}" value="${esc(i.obs)}"></div></div>` : "") +
      `<div class="act"><button data-up="${k}" ${k ? "" : "disabled"} title="Subir">↑</button><button data-down="${k}" ${k < n - 1 ? "" : "disabled"} title="Descer">↓</button><button data-edit="${i.id}" title="Editar">✎</button><button data-del="${k}" title="Remover">🗑</button></div></div>`;
  }).join("") || '<div class="empty-state">Nenhum exercício selecionado para esta ficha.</div>';
}
const novo = e => ({ id: e.id, s: 3, a: 10, b: 12, obs: "" });

/* ---------- gestão de pacientes e histórico ---------- */
function pacientes() {
  $("pc").textContent = `${S.pac.length} Pacientes`;
  $("tabela").innerHTML = S.pac.length ? `<table class="data-table"><thead><tr><th>Nome</th><th>Idade</th><th>Contato</th><th>Diagnóstico</th><th>Ações</th></tr></thead><tbody>` + S.pac.map(p => `<tr><td><b>${esc(p.nome)}</b></td><td>${p.idade} anos</td><td>${esc(p.tel || "-")}</td><td>${esc(p.diag || "-")}</td><td><button class="btn btn-secondary btn-sm" data-pv="${p.id}">Ver histórico</button> <button class="btn btn-primary btn-sm" data-pu="${p.id}">Usar na ficha</button></td></tr>`).join("") + "</tbody></table>" : '<div class="empty-state">Nenhum paciente cadastrado. Use a aba Cadastros.</div>';
  const p = S.pac.find(x => x.id === histPid);
  $("h-nome").textContent = p ? p.nome : "Nenhum paciente selecionado";
  if (!p) { $("h-body").innerHTML = '<div class="empty-state">Clique em “Ver histórico” em um paciente da tabela para ver as fichas salvas sem sair desta tela.</div>'; return; }
  const L = S.hist[p.id] || [];
  $("h-body").innerHTML = L.map(f => `<div class="history-card-item"><div class="history-card-header"><strong>Ficha salva em ${f.data}</strong><span>Responsável: ${esc(f.medico || "—")}</span></div><p class="note">${f.itens.length} exercícios prescritos</p><button class="btn btn-secondary btn-sm" data-ho="${f.id}">${aberto.has(f.id) ? "Fechar ficha" : "Abrir ficha"}</button> <button class="btn btn-primary btn-sm" data-hr="${f.id}">Reutilizar na ficha ativa</button>${aberto.has(f.id) ? `<div class="history-exercise-details"><strong>Exercícios propostos:</strong><ul>${f.itens.map(i => `<li>${esc(EXID[i.id]?.n || i.id)} — ${doseTxt(i)}${i.obs ? " · " + esc(i.obs) : ""}</li>`).join("")}</ul></div>` : ""}</div>`).join("") || `<div class="empty-state">${esc(p.nome)} ainda não tem fichas salvas.</div>`;
}
function fisioterapeutas() {
  $("fc").textContent = `${S.fis.length} Fisioterapeutas`;
  $("tab-fis").innerHTML = S.fis.length ? `<table class="data-table"><thead><tr><th>Nome</th><th>CREFITO</th><th>Especialidade</th><th>Contato</th><th>Ações</th></tr></thead><tbody>` + S.fis.map(f => `<tr><td><b>${esc(f.nome)}</b></td><td>${esc(f.crefito)}</td><td>${esc(f.esp || "-")}</td><td>${esc([f.tel, f.email].filter(Boolean).join(" · ") || "-")}</td><td><button class="btn btn-secondary btn-sm" data-fuse="${f.id}">Usar na ficha</button> <button class="btn btn-outline-danger btn-sm" data-fdel="${f.id}">Remover</button></td></tr>`).join("") + "</tbody></table>" : '<div class="empty-state">Nenhum fisioterapeuta cadastrado.</div>';
}
function tudo() { save(); mapa(); biblioteca(); busca(); ficha(); pacientes(); fisioterapeutas(); }

/* ---------- impressão / PDF ---------- */
function imprimir() {
  if (!S.ficha.length) return toast("Adicione ao menos um exercício à ficha.");
  const p = pac(), d = new Date().toLocaleDateString("pt-BR");
  $("print").innerHTML = `<div class="print-header"><div class="print-brand"><img src="img/logo.jpg" alt="DoseVital"><div><h1 class="print-title">DoseVital</h1><p class="print-subtitle">Prescrição de Fisioterapia &amp; Exercícios</p></div></div><div><p><strong>Data:</strong> ${d}</p><p><strong>Fisioterapeuta:</strong> ${esc(fisio() ? fisio().nome : "______________")}</p><p><strong>CREFITO:</strong> ${esc(fisio() ? fisio().crefito : "________")}</p></div></div><hr class="print-divider">
  <div class="print-patient-info"><div><strong>Paciente:</strong> ${esc(p ? p.nome : "______________________")} &nbsp;&nbsp; <strong>Idade:</strong> ${p ? p.idade + " anos" : "____"}</div><div><strong>Diagnóstico:</strong> ${esc((p && p.diag) || "______________________")}</div></div>
  <h2 class="print-section-title">PLANO DE EXERCÍCIOS PRESCRITOS</h2><div class="print-grid">` +
    S.ficha.map((i, k) => { const e = EXID[i.id]; return `<div class="print-card"><h4>${k + 1}. ${esc(e.n)}</h4><p>${esc(REG[e.r[0]])}</p><div class="print-dosing">${doseTxt(i)}</div>${i.obs ? `<p><strong>Obs.:</strong> ${esc(i.obs)}</p>` : ""}</div>`; }).join("") +
    `</div><div class="print-footer"><p>Siga rigorosamente as orientações de séries e repetições.</p><div class="signature-line">${esc(fisio() ? "Assinatura de " + fisio().nome : "Assinatura do Fisioterapeuta")}</div></div>`;
  window.print();
}

/* ---------- eventos ---------- */
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-p],[data-v],[data-r],[data-f],[data-add],[data-up],[data-down],[data-edit],[data-del],[data-pv],[data-pu],[data-fuse],[data-fdel],[data-ho],[data-hr],button[id]");
  if (!t) return; const d = t.dataset;
  if (d.p) show(d.p);
  else if (d.v) { vista = d.v; mapa(); }
  else if (d.r !== undefined) { reg = (d.r === reg && t.classList.contains("hs")) ? "" : d.r; mapa(); biblioteca(); }
  else if (d.f) { const [k, v] = d.f.split("|"); filtro[k] = v; busca(); }
  else if (d.add) { S.ficha.push(novo(EXID[d.add])); tudo(); toast("Exercício adicionado à ficha."); }
  else if (d.up !== undefined) { const k = +d.up;[S.ficha[k - 1], S.ficha[k]] = [S.ficha[k], S.ficha[k - 1]]; tudo(); }
  else if (d.down !== undefined) { const k = +d.down;[S.ficha[k + 1], S.ficha[k]] = [S.ficha[k], S.ficha[k + 1]]; tudo(); }
  else if (d.edit) { editando.has(d.edit) ? editando.delete(d.edit) : editando.add(d.edit); ficha(); }
  else if (d.del !== undefined) { S.ficha.splice(+d.del, 1); tudo(); toast("Exercício removido da ficha."); }
  else if (d.pv) { histPid = d.pv; pacientes(); }
  else if (d.pu) { S.pid = d.pu; tudo(); show("inicio"); toast("Paciente selecionado na ficha."); }
  else if (d.fuse) { S.fid = d.fuse; tudo(); show("inicio"); toast("Fisioterapeuta selecionado na ficha."); }
  else if (d.fdel) { S.fis = S.fis.filter(f => f.id !== d.fdel); if (S.fid === d.fdel) S.fid = ""; tudo(); toast("Fisioterapeuta removido."); }
  else if (d.ho) { aberto.has(d.ho) ? aberto.delete(d.ho) : aberto.add(d.ho); pacientes(); }
  else if (d.hr) { const f = (S.hist[histPid] || []).find(x => x.id === d.hr); S.ficha = f.itens.map(i => ({ ...i })); S.pid = histPid; tudo(); toast("Ficha carregada na ficha ativa."); }
  else if (t.id === "b-ex") { S.ficha = REGIOES.slice(0, 10).map(r => novo(EXERCICIOS.find(e => e.r[0] === r.id))); tudo(); toast("Ficha de exemplo carregada (10 exercícios)."); }
  else if (t.id === "b-clr") { S.ficha = []; editando.clear(); tudo(); toast("Ficha limpa."); }
  else if (t.id === "b-print") imprimir();
  else if (t.id === "b-save") {
    if (!S.pid) return toast("Selecione um paciente para salvar a ficha.");
    if (!S.ficha.length) return toast("A ficha está vazia.");
    (S.hist[S.pid] = S.hist[S.pid] || []).unshift({ id: "h" + Date.now(), data: new Date().toLocaleDateString("pt-BR"), medico: fisio() ? fisio().nome : "", itens: S.ficha.map(i => ({ ...i })) });
    tudo(); toast("Ficha salva no histórico do paciente.");
  } else if (t.id === "b-fis") {
    const nome = $("m-nome").value.trim(), crefito = $("m-crefito").value.trim().toUpperCase();
    if (!nome || !crefito) return toast("Informe o nome e o CREFITO do fisioterapeuta.");
    if (S.fis.some(f => norm(f.crefito) === norm(crefito))) return toast("Já existe um fisioterapeuta com este CREFITO.");
    const f = { id: "f" + Date.now(), nome, crefito, esp: $("m-esp").value.trim(), tel: $("m-tel").value.trim(), email: $("m-email").value.trim() };
    S.fis.push(f); S.fid = f.id; ["m-nome", "m-crefito", "m-esp", "m-tel", "m-email"].forEach(i => $(i).value = ""); tudo(); toast("Fisioterapeuta cadastrado com sucesso.");
  } else if (t.id === "b-novo") {
    const nome = $("n-nome").value.trim(), idade = parseInt($("n-idade").value, 10);
    if (!nome || isNaN(idade)) return toast("Informe nome e idade do paciente.");
    const p = { id: "p" + Date.now(), nome, idade, tel: $("n-tel").value.trim(), diag: $("n-diag").value.trim() };
    S.pac.push(p); S.pid = p.id; ["n-nome", "n-idade", "n-tel", "n-diag"].forEach(i => $(i).value = ""); tudo(); toast("Paciente cadastrado com sucesso.");
  }
});
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.classList?.contains("hs")) ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
document.addEventListener("input", ev => {
  const e = ev.target;
  if (e.id === "q") busca(); else if (e.id === "q-lib") biblioteca();
  else if (e.dataset.k) { const i = S.ficha[+e.dataset.i]; i[e.dataset.k] = e.dataset.k === "obs" ? e.value : Math.max(1, +e.value || 1); save(); document.querySelectorAll(".it .dose")[+e.dataset.i].innerHTML = dose(i); }
  else if (e.id === "f-diag" && pac()) { pac().diag = e.value; save(); }
});
$("f-pac").addEventListener("change", e => { S.pid = e.target.value; tudo(); });
$("f-fis").addEventListener("change", e => { S.fid = e.target.value; tudo(); });
tudo();
