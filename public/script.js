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

  let filtroMes = mes.value;
  let filtroDir = diretos.value;
  let termo = search.value.toLowerCase();

  dados.sort((a, b) => {

    if(filtroMes != "todos"){
      let creditoA = toNumber(a.meses[filtroMes]?.credito);
      let creditoB = toNumber(b.meses[filtroMes]?.credito);
      return creditoB - creditoA;
    }

    let totalA = a.meses.reduce((s, m) => s + toNumber(m.credito), 0);
    let totalB = b.meses.reduce((s, m) => s + toNumber(m.credito), 0);

    return totalB - totalA;
  });

  thead.innerHTML = "";
  tbody.innerHTML = "";

  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let head = "<tr><th>Cliente</th><th>Diretos</th>";

  meses.forEach((m,i)=>{
    if(filtroMes=="todos" || filtroMes==i){
      head += `<th>${m} OTB</th><th>${m} Real</th><th>Crédito</th>`;
    }
  });

  thead.innerHTML = head + "</tr>";

  let total = 0;
  let filtrados = [];

  dados.forEach((d,i)=>{

    if(diretos.value !== "todos" && d.diretos != filtroDir) return;
    if(!d.cliente.toLowerCase().includes(termo)) return;

    filtrados.push({ ...d, index:i });

    let tr = `<tr onclick="selectCliente(${i})">`;

    tr += `
      <td class="cliente-cell">
        ${d.cliente}
        <span class="eye-icon" onclick="event.stopPropagation(); abrirObs(${i})">📁</span>
      </td>
      <td>${d.diretos}</td>
    `;

    d.meses.forEach((m,index)=>{

      if(filtroMes!="todos" && filtroMes!=index) return;

      let otb = toNumber(m.otb);
      let real = toNumber(m.real);
      let credito = toNumber(m.credito);

      // 🔥 AJUSTE AQUI (SÓ SOMA SE FOR MAIOR QUE ZERO)
      if(credito > 0){
        total += credito;
      }

      tr += `
      <td class="otb">${format(otb)}</td>
      <td class="real">${format(real)}</td>
      <td class="credito">${credito < 0 ? "Crédito já utilizado" : format(credito)}</td>
      `;
    });

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

  let filtroMes = mes.value;
  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let labels = [];
  let otb = [];
  let real = [];

  meses.forEach((m,i)=>{

    if(filtroMes!="todos" && filtroMes!=i) return;

    let somaOtb = 0;
    let somaReal = 0;

    lista.forEach(d=>{

      if(clienteAtual !== null && d.index !== clienteAtual) return;

      let mData = d.meses[i];
      if(!mData) return;

      somaOtb += toNumber(mData.otb);
      somaReal += toNumber(mData.real);
    });

    labels.push(m);
    otb.push(somaOtb);
    real.push(somaReal);
  });

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

  let filtroMes = mes.value;
  let filtroDir = diretos.value;

  let meses = ["Jan","Fev","Mar","Abr","Mai","Jun"];

  let partes = [];

  if(filtroMes != "todos"){
    partes.push(meses[filtroMes]);
  }

  if(filtroDir != "todos"){
    partes.push("Diretos: " + filtroDir);
  }

  let titulo = partes.join(" + ");

  if(clienteAtual !== null){
    titulo = dados[clienteAtual].cliente + " - " + titulo;
  }

  graficoTitulo.innerText = titulo || "Todos os dados";
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
  mes.value = "todos";
  diretos.value = "todos";
  search.value = "";
  clienteAtual = null;
  carregar();
}

mes.innerHTML =
'<option value="todos">Todos</option>' +
[0,1,2,3,4,5].map(i =>
`<option value="${i}">${["Jan","Fev","Mar","Abr","Mai","Jun"][i]}</option>`
).join('');

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