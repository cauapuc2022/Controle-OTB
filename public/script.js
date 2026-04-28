let dados = [];
let chart = null;
let clienteAtual = null;

function toNumber(v){
  if(v === null || v === undefined || v === "") return 0;
  return Number(v);
}

function format(v){
  return "R$ " + toNumber(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function carregar(){
  try {
    dados = await fetch("/clientes", { cache: "no-store" }).then(r => r.json());
    render();
  } catch (e) {
    console.error("Erro ao carregar clientes:", e);
    alert("Erro ao carregar dados");
  }
}

function render(){

  let filtroMes = Number(mes.value);
  let filtroDir = diretos.value;
  let termo = search.value.toLowerCase();

  dados.sort((a, b) => {
    let creditoA = toNumber(a.meses[filtroMes]?.credito);
    let creditoB = toNumber(b.meses[filtroMes]?.credito);
    return creditoB - creditoA;
  });

  thead.innerHTML = "";
  tbody.innerHTML = "";

  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let head = `<tr><th>Cliente</th><th>Diretos</th>
  <th>${meses[filtroMes]} OTB</th>
  <th>${meses[filtroMes]} Real</th>
  <th>Crédito</th></tr>`;

  thead.innerHTML = head;

  let total = 0;
  let filtrados = [];

  dados.forEach((d,i)=>{

    if(diretos.value !== "todos" && d.diretos != filtroDir) return;
    if(!d.cliente.toLowerCase().includes(termo)) return;

    if(clienteAtual !== null && i !== clienteAtual){
      filtrados.push({ ...d, index:i });
      return;
    }

    filtrados.push({ ...d, index:i });

    let tr = `<tr onclick="selectCliente(${i})">`;

    // 🔴 NOVA REGRA: verifica se tem observação
    let temObs = (d.obs?.marcelo?.length || 0) > 0 || (d.obs?.caua?.length || 0) > 0;

    tr += `
      <td class="cliente-cell">
        ${d.cliente}
        <span class="eye-icon" onclick="event.stopPropagation(); abrirObs(${i})">📁</span>
        ${temObs ? '<span class="obs-alert">❗</span>' : ''}
      </td>
      <td>${d.diretos}</td>
    `;

    let m = d.meses[filtroMes];

    let otb = toNumber(m?.otb);
    let real = toNumber(m?.real);
    let credito = toNumber(m?.credito);

    if(credito > 0){
      total += credito;
    }

    tr += `
      <td class="otb">${format(otb)}</td>
      <td class="real">${format(real)}</td>
      <td class="credito">${credito < 0 ? "Crédito já utilizado" : format(credito)}</td>
    `;

    tr += "</tr>";
    tbody.innerHTML += tr;
  });

  totalCredito.innerText = "Total de crédito: " + format(total);

  renderGrafico(filtrados);
}

function selectCliente(i){
  clienteAtual = i;
  render();
}

function renderGrafico(lista){

  let filtroMes = Number(mes.value);
  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let labels = [];
  let otb = [];
  let real = [];

  let somaOtb = 0;
  let somaReal = 0;

  lista.forEach(d=>{

    if(clienteAtual !== null && d.index !== clienteAtual) return;

    let mData = d.meses[filtroMes];
    if(!mData) return;

    somaOtb += toNumber(mData.otb);
    somaReal += toNumber(mData.real);
  });

  labels.push(meses[filtroMes]);
  otb.push(somaOtb);
  real.push(somaReal);

  if(chart) chart.destroy();

  chart = new Chart(grafico,{
    type:"bar",
    data:{
      labels,
      datasets:[
        { label:"OTB", data:otb, backgroundColor:"black" },
        { label:"Realizado", data:real, backgroundColor:"green" }
      ]
    },
    options:{
      plugins:{ legend:{display:true} },
      responsive:true
    }
  });

  atualizarTitulo();
}

function atualizarTitulo(){

  let filtroMes = Number(mes.value);
  let filtroDir = diretos.value;

  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let partes = [];

  partes.push(meses[filtroMes]);

  if(filtroDir != "todos"){
    partes.push("Diretos: " + filtroDir);
  }

  let titulo = partes.join(" + ");

  if(clienteAtual !== null){
    titulo = dados[clienteAtual].cliente + " - " + titulo;
  }

  graficoTitulo.innerText = titulo;
}

async function uploadExcel(){

  let file = excel.files[0];

  if(!file){
    alert("Selecione um arquivo");
    return;
  }

  loading.style.display = "block";

  let form = new FormData();
  form.append("file", file);

  await fetch("/upload",{ method:"POST", body: form });

  loading.style.display = "none";

  alert("Importado com sucesso");

  carregar();
}

function limpar(){
  diretos.value = "todos";
  search.value = "";
  clienteAtual = null;
  setMesAtual();
  carregar();
}

function setMesAtual(){
  const hoje = new Date().getMonth();
  const mesIndex = hoje <= 5 ? hoje : 5;
  mes.value = mesIndex;
}

mes.innerHTML =
[0,1,2,3,4,5].map(i =>
`<option value="${i}">${["Jan","Fev","Mar","Abr","Mai","Jun"][i]}</option>`
).join('');

setMesAtual();

search.addEventListener("keyup", render);

function abrirObs(i){
  clienteAtual = i;
  let c = dados[i];

  tituloModal.innerText = "Observações do Cliente: " + c.cliente;

  chatMarcelo.innerHTML="";
  chatCaua.innerHTML="";

  (c.obs?.marcelo || []).forEach(o=>{
    chatMarcelo.innerHTML += `
      <div class="msg left">
        <div>${o.texto}</div>
        <small>${o.data}</small>
      </div>`;
  });

  (c.obs?.caua || []).forEach(o=>{
    chatCaua.innerHTML += `
      <div class="msg right">
        <div>${o.texto}</div>
        <small>${o.data}</small>
      </div>`;
  });

  modal.style.display="block";
}

async function addObs(tipo){

  let input = tipo=="marcelo"?inputMarcelo:inputCaua;
  let texto = input.value.trim();

  if(!texto) return;

  let agora = new Date();

  let data = agora.toLocaleDateString("pt-BR") + " " +
             agora.toLocaleTimeString("pt-BR", {
               hour: "2-digit",
               minute: "2-digit"
             });

  input.value = "";

  const cliente = dados[clienteAtual];

  try {

    const resp = await fetch("/obs",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        id: cliente._id,
        tipo,
        texto,
        data
      })
    });

    const result = await resp.json();

    if(!result || !result.sucesso){
      throw new Error("Falha ao salvar");
    }

    await carregar();

    const novoIndex = dados.findIndex(d => d._id === cliente._id);

    if(novoIndex !== -1){
      abrirObs(novoIndex);
    } else {
      alert("Erro ao recarregar cliente");
    }

  } catch (e) {
    console.error("Erro ao salvar observação:", e);
    alert("Erro ao salvar no banco");
  }
}

function fecharModal(){
  modal.style.display="none";
}

carregar();