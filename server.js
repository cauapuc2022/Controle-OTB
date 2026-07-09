const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx");
const cors = require("cors");

const app = express();

// ================= CONFIG =================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(()=>console.log("✅ Conectado ao MongoDB"))
.catch(err=>{
  console.error("❌ Erro Mongo REAL:", err);
});

// ================= MODEL =================
const Cliente = mongoose.model("Cliente", new mongoose.Schema({
  cliente: String,
  diretos: String,
  meses: Array,
  obs: {
    marcelo: Array,
    caua: Array
  }
}));

// ================= HELPERS =================
function normalize(str){
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findKey(row, nome){
  return Object.keys(row).find(k => normalize(k) === normalize(nome));
}

function getValue(row, nome){
  let key = findKey(row, nome);
  return key ? row[key] : 0;
}

function num(v){
  if(v === null || v === undefined || v === "") return 0;

  let str = String(v).trim();
  str = str.replace("R$", "").trim();

  if(str.includes(",")){
    str = str.replace(/\./g, "");
    str = str.replace(",", ".");
  }

  return Number(str) || 0;
}

// ================= GET =================
app.get("/clientes", async (req,res)=>{
  try {
    const clientes = await Cliente.find();
    res.json(clientes || []);
  } catch (err) {
    console.error("🔥 ERRO /clientes:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ================= SALVAR OBS =================
app.post("/obs", async (req,res)=>{
  try {
    const { id, tipo, texto, data } = req.body;

    if(!id || !tipo || !texto || !data){
      return res.status(400).json({ erro: "Dados inválidos" });
    }

    if(!["marcelo","caua"].includes(tipo)){
      return res.status(400).json({ erro: "Tipo inválido" });
    }

    const cliente = await Cliente.findById(id);

    if(!cliente){
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }

    if(!cliente.obs){
      cliente.obs = { marcelo: [], caua: [] };
    }

    if(!cliente.obs.marcelo) cliente.obs.marcelo = [];
    if(!cliente.obs.caua) cliente.obs.caua = [];

    cliente.obs[tipo].push({
    id: new mongoose.Types.ObjectId().toString(),
    texto,
    data
});
    await cliente.save();

    res.json({ sucesso: true });

  } catch (err){
    console.error("🔥 ERRO /obs:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ================= DELETE OBS (🔥 NOVO) =================
app.post("/delete-obs", async (req,res)=>{
  try {

     const { id, tipo, obsId } = req.body;

if(!id || !tipo || !obsId){
  return res.json({ sucesso:false });
}
    const cliente = await Cliente.findById(id);

    if(!cliente){
      return res.json({ sucesso:false });
    }

    if(!cliente.obs || !cliente.obs[tipo]){
      return res.json({ sucesso:false });
    }

    // 🔥 remove observação pelo timestamp
     cliente.obs[tipo] =
    cliente.obs[tipo].filter(o => o.id !== obsId);

    await cliente.save();

    res.json({ sucesso:true });

  } catch(err){
    console.error("🔥 ERRO delete-obs:", err);
    res.json({ sucesso:false });
  }
});

// ================= UPDATE =================
app.post("/update", async (req,res)=>{
  try {
    const {id, mesIndex, campo, valor} = req.body;

    const c = await Cliente.findById(id);
    if(!c) return res.status(404).send();

    c.meses[mesIndex][campo] = valor;
    c.meses[mesIndex].credito = c.meses[mesIndex].otb - c.meses[mesIndex].real;

    await c.save();

    res.sendStatus(200);

  } catch (err){
    console.error("🔥 ERRO /update:", err);
    res.status(500).send();
  }
});

// ================= UPLOAD =================
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req,res)=>{
  try {
    console.log("📊 Importando Excel...");

    const wb = XLSX.readFile(req.file.path);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    // ❌ NÃO APAGA MAIS
    // await Cliente.deleteMany();

    for (let row of data){

      const nomeCliente = getValue(row,"Cliente");

      const meses = [
  {
    mes: "Jul",
    otb: num(getValue(row, "OTB Julho")),
    real: num(getValue(row, "Realizado Julho"))
  },
  {
    mes: "Ago",
    otb: num(getValue(row, "OTB Agosto")),
    real: num(getValue(row, "Realizado Agosto"))
  },
  {
    mes: "Set",
    otb: num(getValue(row, "OTB Setembro")),
    real: num(getValue(row, "Realizado Setembro"))
  },
  {
    mes: "Out",
    otb: num(getValue(row, "OTB Outubro")),
    real: num(getValue(row, "Realizado Outubro"))
  },
  {
    mes: "Nov",
    otb: num(getValue(row, "OTB Novembro")),
    real: num(getValue(row, "Realizado Novembro"))
  },
  {
    mes: "Dez",
    otb: num(getValue(row, "OTB Dezembro")),
    real: num(getValue(row, "Realizado Dezembro"))
  }
].map(m => ({
  ...m,
  credito: m.otb - m.real
}));

      let existente = await Cliente.findOne({ cliente: nomeCliente });

      if(existente){
        existente.diretos = normalize(getValue(row,"Diretos")) === "sim" ? "Sim" : "Não";
        existente.meses = meses;
        await existente.save();

      } else {
        await Cliente.create({
          cliente: nomeCliente,
          diretos: normalize(getValue(row,"Diretos")) === "sim" ? "Sim" : "Não",
          meses,
          obs: { marcelo: [], caua: [] }
        });
      }
    }

    console.log("✅ Excel importado sem perder observações");
    res.json({msg:"Importado"});

  } catch (err){
    console.error("🔥 ERRO /upload:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));

