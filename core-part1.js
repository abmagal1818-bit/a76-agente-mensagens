const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const nodeCrypto = require("crypto");
const multer = require("multer");
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
const { createClient } = require("@supabase/supabase-js");
const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use("/public", express.static(path.join(__dirname, "public")));
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "meu_token_verificacao";
const PAINEL_TOKEN = process.env.PAINEL_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || ""; // conta Instagram da A76 Motors
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ===== Identidade da A76 Motors =====
const NOME_IA = process.env.NOME_IA || "Clara";
const NOME_EMPRESA = process.env.NOME_EMPRESA || "A76 Motors";
const SITE_EMPRESA = process.env.SITE_EMPRESA || "a76motors.com.br";
const TELEFONE_CONSULTOR = process.env.TELEFONE_CONSULTOR || ""; // A DEFINIR: telefone humano para escalonamento/consultor da A76
const NUMERO_AUGUSTO = process.env.NUMERO_AUGUSTO || TELEFONE_CONSULTOR; // numero do consultor humano da A76 para escalonamento
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || "public"; // A76 tem projeto Supabase proprio e dedicado; tabelas vivem no schema public
const BASE_URL = process.env.BASE_URL || "https://a76-agente-mensagens.onrender.com"; // A DEFINIR quando o servico Render for criado

const COOKIE_NOME_TOKEN = "a76_painel_auth";

function exigirToken(req, res, next) {
  if (!PAINEL_TOKEN) {
    return res.status(503).send("Acesso bloqueado: configure a variável de ambiente PAINEL_TOKEN no Render para habilitar o painel.");
  }
  const tokenQuery = req.query.token;
  const tokenCookie = (req.headers.cookie || "").split(";").map(c => c.trim()).find(c => c.startsWith(COOKIE_NOME_TOKEN + "="))?.split("=")[1];
  function tokenValido(t) {
    if (!t || t.length !== PAINEL_TOKEN.length) return false;
    try { return nodeCrypto.timingSafeEqual(Buffer.from(t), Buffer.from(PAINEL_TOKEN)); } catch { return false; }
  }
  if (tokenValido(tokenQuery) || tokenValido(tokenCookie)) {
    if (tokenValido(tokenQuery)) {
      res.setHeader("Set-Cookie", `${COOKIE_NOME_TOKEN}=${PAINEL_TOKEN}; Max-Age=${30 * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
    return next();
  }
  return res.status(401).send("Acesso negado. Use o link com ?token=SEU_TOKEN para entrar.");
}

app.use("/painel", exigirToken);
app.use("/crm", exigirToken);
app.use("/followups", exigirToken);
app.use("/estoque", exigirToken);
app.use("/sincronizar", exigirToken);
app.use("/testar-supabase", exigirToken);
app.use("/diagnostico", exigirToken);
app.use("/testar-notificacao", exigirToken);
app.use("/testar-alerta-api", exigirToken);
app.use("/testar-retry", exigirToken);
app.use("/registrar", exigirToken);

console.log("SUPABASE_URL:", SUPABASE_URL ? "OK" : "VAZIA");
console.log("SUPABASE_KEY:", SUPABASE_KEY ? "OK" : "VAZIA");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SUPABASE_SCHEMA } });

async function enviarWhatsApp(telefone, corpo) {
  const resp = await axios.post(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to: telefone, ...corpo },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );
  return resp.data;
}

async function enviarTexto(telefone, texto) {
  const data = await enviarWhatsApp(telefone, { text: { body: texto } });
  return data?.messages?.[0]?.id || null;
}

async function testarSupabase() {
  try {
    const { error } = await supabase.from("mensagens").select("count").limit(1);
    if (error) console.error("[Supabase] ❌ Erro:", error.message);
    else console.log("[Supabase] ✅ Conexão OK!");
  } catch (e) { console.error("[Supabase] ❌ Exceção:", e.message); }
}
testarSupabase();

(async () => {
  try {
    const { data } = await supabase.from("clientes")
      .select("telefone, ultima_interacao")
      .is("ultima_mensagem_cliente", null)
      .not("ultima_interacao", "is", null)
      .limit(500);
    if (data?.length) {
      for (const cli of data) {
        await supabase.from("clientes").update({ ultima_mensagem_cliente: cli.ultima_interacao }).eq("telefone", cli.telefone);
      }
      console.log(`[Migração] ✅ ultima_mensagem_cliente preenchida para ${data.length} clientes`);
    }
  } catch (e) { console.error("[Migração] Erro:", e.message); }
})();

let estoqueAtual = [];
let ultimaAtualizacao = null;
const conversas = {};
const mensagensProcessadas = new Set();
const fipeCache = {};
let cacheMarcasFipe = null;
const filaFotos = {};
const ultimaNotificacao = {};
const conversasVisualizadas = {};
const cacheContextoConversa = {};
const ultimaMensagemCliente = {};
const veiculoAtualCache = {};

const coletaCredito = {};

async function salvarColetaCreditoPendente(telefone, estado) {
  try {
    await supabase.from("coleta_credito_pendente").upsert({
      telefone, estado: JSON.stringify(estado), atualizado_em: new Date().toISOString()
    }, { onConflict: "telefone" });
  } catch (e) {
    console.error("[ColetaCredito] Erro ao persistir (tabela pode não existir ainda):", e.message);
  }
}

async function limparColetaCreditoPendente(telefone) {
  try {
    await supabase.from("coleta_credito_pendente").delete().eq("telefone", telefone);
  } catch (e) {
    console.error("[ColetaCredito] Erro ao limpar persistência:", e.message);
  }
}

async function carregarColetaCreditoPendente(telefone) {
  if (coletaCredito[telefone]) return coletaCredito[telefone];
  try {
    const { data } = await supabase.from("coleta_credito_pendente").select("*").eq("telefone", telefone).limit(1);
    if (data && data.length > 0) {
      coletaCredito[telefone] = typeof data[0].estado === "string" ? JSON.parse(data[0].estado) : data[0].estado;
      console.log(`[ColetaCredito] Recuperado da persistência: ${telefone}`);
    }
  } catch (e) {
  }
  return coletaCredito[telefone];
}

let descontoPendente = null;

const filaProcessamento = {};

async function processarMensagemNaFila(from, text, tentativasAnteriores = 0) {
  const anterior = filaProcessamento[from] || Promise.resolve();
  const atual = anterior
    .catch(() => {})
    .then(() => processarMensagem(from, text, tentativasAnteriores));
  filaProcessamento[from] = atual;
  return atual;
}

let ultimoAlertaApiFalha = 0;
const COOLDOWN_ALERTA_API = 15 * 60 * 1000;

async function notificarFalhaApiClaude(erro, contexto = "") {
  const agora = Date.now();
  if (agora - ultimoAlertaApiFalha < COOLDOWN_ALERTA_API) return;
  ultimoAlertaApiFalha = agora;

  const status = erro.response?.status;
  const mensagemErro = erro.response?.data?.error?.message || erro.message;
  const tipoErro = erro.response?.data?.error?.type || "desconhecido";

  let motivoAmigavel = "Erro desconhecido na API da Anthropic.";
  if (mensagemErro?.toLowerCase().includes("credit balance is too low")) {
    motivoAmigavel = `🚨 *SEM CRÉDITO NA API DA ANTHROPIC!*\nA ${NOME_IA} PAROU de responder aos clientes. Adicione fundos em console.anthropic.com > Billing.`;
  } else if (status === 401) {
    motivoAmigavel = `🚨 *Chave de API inválida/expirada!*\nA ${NOME_IA} parou de funcionar. Verifique a CLAUDE_API_KEY no Render.`;
  } else if (status === 429) {
    motivoAmigavel = "⚠️ *Limite de requisições (rate limit) atingido.*\nAlgumas respostas podem estar atrasando.";
  } else if (status >= 500) {
    motivoAmigavel = "⚠️ *Instabilidade na API da Anthropic* (erro do lado deles). Deve se normalizar sozinho.";
  }

  const msg = `${motivoAmigavel}\n\n${contexto ? `Contexto: ${contexto}\n` : ""}Status: ${status || "N/A"} | Tipo: ${tipoErro}\nDetalhe: ${String(mensagemErro).substring(0, 200)}`;

  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msg } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log("[Alerta API] ✅ Consultor notificado sobre falha da API");
  } catch (e) {
    console.error("[Alerta API] Erro ao notificar (e a API principal já está fora!):", e.message);
  }
}

const MAX_TENTATIVAS_PENDENTE = 6;

async function salvarMensagemPendente(telefone, texto) {
  try {
    await supabase.from("mensagens_pendentes").insert({ telefone, texto, tentativas: 0 });
    console.log(`[Retry] Mensagem de ${telefone} salva como pendente para reprocessar depois`);
  } catch (e) {
    console.error("[Retry] Erro ao salvar mensagem pendente (tabela pode não existir):", e.message);
  }
}

async function processarMensagensPendentes() {
  try {
    const MAX_TENTATIVAS = 5;
    const { data: pendentes } = await supabase.from("mensagens_pendentes").select("*").order("criado_em", { ascending: true }).limit(20);
    if (!pendentes?.length) return;
    console.log(`[Retry] ${pendentes.length} mensagem(ns) pendente(s) para reprocessar`);
    for (const p of pendentes) {
      if ((p.tentativas || 0) >= MAX_TENTATIVAS) {
        console.log(`[Retry] Descartando mensagem de ${p.telefone} após ${p.tentativas} tentativas`);
        await supabase.from("mensagens_pendentes").delete().eq("id", p.id);
        continue;
      }
      try {
        await supabase.from("mensagens_pendentes").delete().eq("id", p.id);
        await processarMensagemNaFila(p.telefone, p.texto, p.tentativas || 0);
      } catch (e) {
        console.error(`[Retry] Erro ao reprocessar pendente de ${p.telefone}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[Retry] Erro ao buscar pendentes:", e.message);
  }
}

setInterval(processarMensagensPendentes, 5 * 60 * 1000);

let cacheAprendizados = "";
let ultimoCarregamentoAprendizados = 0;

async function obterAprendizados() {
  const agora = Date.now();
  if (agora - ultimoCarregamentoAprendizados < 30 * 60 * 1000) return cacheAprendizados;
  try {
    const { data } = await supabase.from("aprendizados").select("*").order("criado_em", { ascending: false }).limit(10);
    if (data && data.length > 0) {
      cacheAprendizados = "\n\nEXEMPLOS DE COMO RESPONDER:\n" +
        data.map(a => `Situação: ${a.situacao}\nResposta correta: ${a.correcao}`).join("\n---\n");
    } else {
      cacheAprendizados = "";
    }
    ultimoCarregamentoAprendizados = agora;
  } catch (e) { console.error("[Cache] Erro:", e.message); }
  return cacheAprendizados;
}

function limparTexto(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .trim();
}

function clienteEstaEmFluxoTroca(historicoConversa) {
  const mensagensRecentes = (historicoConversa || []).slice(-10);
  // Correcao 2026-10-29: antes disso, "historico" juntava mensagens do CLIENTE e da
  // SARA indiscriminadamente antes de checar frasesCliente. Isso fazia a propria Sara
  // disparar um falso-positivo de "fluxo de troca" ao dizer algo como "Vou mandar as
  // fotos pra você!" (oferecendo fotos do ESTOQUE), porque a frase "mandar as fotos"
  // batia com a lista pensada pra detectar o CLIENTE oferecendo fotos do carro dele na
  // troca. Com o fluxo de troca "ligado" por engano, clienteEstaPedindoFotosDoEstoque
  // passava a sempre devolver false pros proximos pedidos de foto daquele cliente,
  // jogando o pedido pro caminho da IA generativa (que podia so afirmar "as fotos ja
  // foram enviadas" sem reenviar de fato — caso Paulo Boaventura, 5551989608248).
  const mensagensCliente = mensagensRecentes.filter(m => m.role === "user").map(m => (m.content || "").toLowerCase()).join(" ");
  // Correcao 2026-11-02: "tenho um"/"tenho uma" removidos daqui por serem genericos
  // demais - batiam com frases sem nenhuma relacao com troca de veiculo, tipo "tenho um
  // credito aprovado" (cliente vindo de anuncio do Mercado Livre, caso telefone
  // 5554992093244, Jetta Variant). Casos legitimos de troca continuam cobertos pelas
  // frases mais especificas abaixo ("na troca", "pra troca", "dar na troca" etc.).
  const frasesCliente = [
    "meu carro", "na troca", "pra troca", "de troca",
    "dar na troca", "dou na troca", "mandar umas fotos", "manda umas fotos",
    "mandar as fotos", "vou mandar fotos", "tirar umas fotos", "tiro umas fotos",
    "tirar as fotos", "que tinha troca", "falei que tinha troca"
  ];
  if (frasesCliente.some(f => mensagensCliente.includes(f))) return true;
  const frasesSara = [
    "avaliacao certinha", "fazer uma avaliacao", "avaliar direitinho", "qual a versao",
    "quantos km ela", "km ela ta rodando", "km ela esta rodando", "documentacao em dia",
    "estado geral dela", "dar ela na troca", "avaliacao de troca", "avaliacao da sua"
  ];
  const mensagensSara = mensagensRecentes.filter(m => m.role === "assistant").map(m => (m.content || "").toLowerCase()).join(" ");
  return frasesSara.some(f => mensagensSara.includes(f));
}

function ehMensagemSimples(texto) {
  const t = texto.toLowerCase().trim();
  const simples = ["sim", "não", "nao", "ok", "obrigado", "obrigada", "valeu", "certo",
    "tá", "ta", "tá bom", "ta bom", "pode ser", "claro", "perfeito", "ótimo", "otimo",
    "entendi", "entendido", "combinado", "até", "ate", "tchau", "abraço", "abs"];
  return simples.includes(t) || t.length < 8;
}

function limparRespostaIA(texto) {
  return String(texto)
    .replace(/\[SOLICITAR_FOTOS:[^\]]*\]/gi, "")
    .replace(/\[Sistema\b[^\]]*\]/gi, "")
    .replace(/\[instrução:[^\]]*\]/gi, "")
    .replace(/\[instruction:[^\]]*\]/gi, "")
    // Rede de seguranca adicionada 2026-10-28: a IA ocasionalmente ecoa de volta pro
    // cliente um marcador cru do tipo "[fotos enviadas]" (sem o prefixo "Sistema:"),
    // em vez de so usar essa informacao internamente. Isso vazou pro cliente real
    // (caso 5551996050893-like, monitor de 2026-10-28) junto com a afirmacao de que
    // as fotos foram enviadas sem elas terem sido enviadas de fato nessa mensagem.
    .replace(/\[\s*fotos?\s+enviad[ao]s?[^\]]*\]/gi, "")
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .trim();
}

function detectarInteresseFinanciamento(texto, historicoConversa) {
  const t = texto.toLowerCase();
  const frases = [
    "preciso financiar", "quero financiar", "consigo financiar",
    "tenho crédito", "tenho credito", "será que consigo crédito",
    "será que consigo credito", "consigo parcelar", "vai dar pra financiar",
    "tem como financiar", "tem credito", "tem crédito",
    "fazer financiamento", "simular financiamento", "simular crédito",
    "simular credito", "ver se aprova", "ver se passa", "análise de crédito",
    "analise de credito", "consultar meu nome", "consultar meu cpf",
    "quanto fica a parcela", "quanto fica parcelado", "quanto ficaria a parcela",
    "qual valor da parcela", "qual o valor da parcela", "valor da parcela",
    "quanto seria por mês", "quanto seria por mes", "quanto fica por mês",
    "quanto fica por mes", "em quantas vezes", "quantas parcelas",
    "dá pra parcelar", "da pra parcelar", "dá pra financiar", "da pra financiar",
    "como funciona o financiamento", "quero saber sobre financiamento",
    "informações sobre financiamento", "informacoes sobre financiamento",
    "quero parcelar", "pode parcelar", "financia", "financiamento"
  ];
  return frases.some(f => t.includes(f));
}

function validarCPF(cpfTexto) {
  const cpf = String(cpfTexto).replace(/\D/g, "");
  if (cpf.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(cpf)) return null;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return null;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[10])) return null;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function extrairDataNascimento(texto) {
  const t = texto.trim();

  const matchSeparado = t.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (matchSeparado) {
    let [, dia, mes, ano] = matchSeparado;
    if (ano.length === 2) ano = (parseInt(ano) > 30 ? "19" : "20") + ano;
    dia = dia.padStart(2, "0");
    mes = mes.padStart(2, "0");
    const diaN = parseInt(dia), mesN = parseInt(mes), anoN = parseInt(ano);
    if (diaN >= 1 && diaN <= 31 && mesN >= 1 && mesN <= 12 && anoN >= 1900 && anoN <= new Date().getFullYear()) {
      return `${dia}/${mes}/${ano}`;
    }
  }

  const apenasDigitos = t.replace(/\D/g, "");
  if (apenasDigitos.length === 8) {
    const dia = apenasDigitos.slice(0, 2);
    const mes = apenasDigitos.slice(2, 4);
    const ano = apenasDigitos.slice(4, 8);
    const diaN = parseInt(dia), mesN = parseInt(mes), anoN = parseInt(ano);
    if (diaN >= 1 && diaN <= 31 && mesN >= 1 && mesN <= 12 && anoN >= 1900 && anoN <= new Date().getFullYear()) {
      return `${dia}/${mes}/${ano}`;
    }
  }
  if (apenasDigitos.length === 6) {
    const dia = apenasDigitos.slice(0, 2);
    const mes = apenasDigitos.slice(2, 4);
    let ano = apenasDigitos.slice(4, 6);
    ano = (parseInt(ano) > 30 ? "19" : "20") + ano;
    const diaN = parseInt(dia), mesN = parseInt(mes), anoN = parseInt(ano);
    if (diaN >= 1 && diaN <= 31 && mesN >= 1 && mesN <= 12) {
      return `${dia}/${mes}/${ano}`;
    }
  }

  return null;
}

function mascararCPF(cpfFormatado) {
  if (!cpfFormatado) return cpfFormatado;
  const digitos = cpfFormatado.replace(/\D/g, "");
  if (digitos.length !== 11) return cpfFormatado;
  return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9)}`;
}

async function notificarDadosCredito(telefone, dados) {
  const numero = telefone.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : telefone;
  const linkSeguro = PAINEL_TOKEN
    ? `${BASE_URL}/painel/simulacoes?token=${PAINEL_TOKEN}`
    : null;
  const msg = `📋 *Simulação de crédito solicitada*
Cliente: ${formatado}
Nome: *${dados.nome}*
CPF: *${dados.cpf}*
Nascimento: *${dados.nascimento}*
CNH: *${dados.temCnh || "Não informado"}*
${dados.veiculo ? `Veículo de interesse: *${dados.veiculo}*` : "Veículo de interesse: não identificado"}
${dados.entrada ? `Valor de entrada: *${dados.entrada}*` : "Entrada: à combinar"}
${linkSeguro ? `\nVer todas as simulações: ${linkSeguro}` : ""}

Faça a simulação nas financeiras e responda:
✅ *SIMULACAO ${telefone} [resultado]* — ex: SIMULACAO ${telefone} Aprovado BV, parcela R$ 1.250 em 48x`;
  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msg } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`[Crédito] ✅ Consultor notificado sobre dados de ${telefone}`);
  } catch (e) { console.error("[Crédito] Erro notificação:", e.message); }
}

async function salvarSimulacaoCredito(telefone, dados) {
  try {
    const { data, error } = await supabase.from("simulacoes_credito").insert({
      telefone, nome: dados.nome, cpf: dados.cpf, nascimento: dados.nascimento,
      veiculo: dados.veiculo || null, entrada: dados.entrada || null, tem_cnh: dados.temCnh || null, status: "pendente"
    }).select("id").single();
    if (error) throw error;
    console.log(`[Crédito] ✅ Salvo no Supabase: ${telefone} (id ${data?.id})`);
    return data?.id || null;
  } catch (e) {
    console.error("[Crédito] Erro ao salvar (tabela pode não existir ainda):", e.message);
    return null;
  }
}

async function atualizarStatusSimulacao(telefone, resultado) {
  try {
    await supabase.from("simulacoes_credito")
      .update({ status: "respondido", resultado })
      .eq("telefone", telefone)
      .eq("status", "pendente");
  } catch (e) {
    console.error("[Crédito] Erro ao atualizar status:", e.message);
  }
}

// ─────────────────────────────────────────────
// SIMULAÇÃO MULTI-BANCO (adaptadores por banco)
// ─────────────────────────────────────────────
// Cada banco tem sua própria função "adaptadora". Todas recebem o mesmo
// formato de entrada e devolvem o mesmo formato de saída, então o
// orquestrador (simularTodosBancos) não precisa saber os detalhes de
// cada API — só chama todas e junta o resultado.
//
// Formato de entrada (dados): { nome, cpf, nascimento, telefone, placa, veiculoValor, entrada, prazoMeses }
// nome é opcional — nenhum banco listado abaixo precisa do nome pra simular, só do CPF
// e, dependendo do banco, telefone, placa do veículo, valor do carro ou data de nascimento.
// Formato de saída: { banco, status: 'aprovado'|'negado'|'erro'|'nao_configurado'|'dados_insuficientes',
//                      taxa, parcela, cet, prazoMeses, mensagem, respostaBruta }
//
// IMPORTANTE: até termos a documentação oficial de cada banco, essas
// funções ficam como STUB — checam se a credencial de API existe
// (variável de ambiente) e, se não existir, retornam 'nao_configurado'
// sem tentar nenhuma chamada real. Assim que a doc de um banco chegar,
// é só preencher o corpo da função correspondente com a chamada real —
// nada mais no sistema precisa mudar.

// Confere se os campos que aquele banco exige vieram preenchidos. Útil desde
// já (mesmo em stub) pra pegar na hora os casos em que falta placa/telefone,
// em vez de só descobrir isso quando a API real estiver ligada.
function faltamCampos(dados, campos) {
  return campos.filter(c => dados[c] === null || dados[c] === undefined || dados[c] === "");
}

async function simularPan(dados) {
  // Pan exige CPF + telefone do cliente.
  const faltando = faltamCampos(dados, ["cpf", "telefone"]);
  if (faltando.length) return { banco: "Pan", status: "dados_insuficientes", mensagem: `Faltam: ${faltando.join(", ")}` };
  const apiKey = process.env.PAN_API_KEY;
  if (!apiKey) return { banco: "Pan", status: "nao_configurado", mensagem: "PAN_API_KEY não configurada ainda" };
  try {
    // TODO: substituir pelo endpoint real assim que o Pan enviar a documentação.
    // Exemplo do formato esperado (ajustar conforme doc real):
    // const res = await axios.post("https://api.bancopan.com.br/.../simulacao", {
    //   cpf: dados.cpf, telefone: dados.telefone, valorVeiculo: dados.veiculoValor, valorEntrada: dados.entrada, prazoMeses: dados.prazoMeses
    // }, { headers: { Authorization: `Bearer ${apiKey}` } });
    // return { banco: "Pan", status: res.data.aprovado ? "aprovado" : "negado", taxa: res.data.taxa, parcela: res.data.valorParcela, cet: res.data.cet, prazoMeses: res.data.prazo, respostaBruta: res.data };
    return { banco: "Pan", status: "erro", mensagem: "Adaptador ainda não implementado (aguardando documentação da API)" };
  } catch (e) {
    return { banco: "Pan", status: "erro", mensagem: e.response?.data?.mensagem || e.message };
  }
}

async function simularSantander(dados) {
  // Santander exige CPF + placa do veículo + valor do veículo (abre a tela já com aprovação/negação).
  const faltando = faltamCampos(dados, ["cpf", "placa", "veiculoValor"]);
  if (faltando.length) return { banco: "Santander", status: "dados_insuficientes", mensagem: `Faltam: ${faltando.join(", ")}` };
  const apiKey = process.env.SANTANDER_API_KEY;
  if (!apiKey) return { banco: "Santander", status: "nao_configurado", mensagem: "SANTANDER_API_KEY não configurada ainda" };
  try {
    // TODO: substituir pelo endpoint real assim que o Santander enviar a documentação.
    return { banco: "Santander", status: "erro", mensagem: "Adaptador ainda não implementado (aguardando documentação da API)" };
  } catch (e) {
    return { banco: "Santander", status: "erro", mensagem: e.response?.data?.mensagem || e.message };
  }
}

async function simularItau(dados) {
  // Itaú exige CPF + placa do veículo.
  const faltando = faltamCampos(dados, ["cpf", "placa"]);
  if (faltando.length) return { banco: "Itaú", status: "dados_insuficientes", mensagem: `Faltam: ${faltando.join(", ")}` };
  const apiKey = process.env.ITAU_API_KEY;
  if (!apiKey) return { banco: "Itaú", status: "nao_configurado", mensagem: "ITAU_API_KEY não configurada ainda — confirmar com o banco se é API ou BPO antes de habilitar" };
  try {
    // TODO: substituir pelo endpoint real assim que o Itaú confirmar o modelo de integração (API x BPO).
    return { banco: "Itaú", status: "erro", mensagem: "Adaptador ainda não implementado (aguardando documentação da API)" };
  } catch (e) {
    return { banco: "Itaú", status: "erro", mensagem: e.response?.data?.mensagem || e.message };
  }
}

async function simularBV(dados) {
  // BV exige CPF + placa do veículo; às vezes também pede data de nascimento.
  const faltando = faltamCampos(dados, ["cpf", "placa"]);
  if (faltando.length) return { banco: "BV", status: "dados_insuficientes", mensagem: `Faltam: ${faltando.join(", ")}` };
  const apiKey = process.env.BV_API_KEY;
  if (!apiKey) return { banco: "BV", status: "nao_configurado", mensagem: "BV_API_KEY não configurada ainda" };
  try {
    // TODO: substituir pelo endpoint real assim que o BV enviar a documentação.
    return { banco: "BV", status: "erro", mensagem: "Adaptador ainda não implementado (aguardando documentação da API)" };
  } catch (e) {
    return { banco: "BV", status: "erro", mensagem: e.response?.data?.mensagem || e.message };
  }
}

// Mapa central de bancos habilitados — pra ligar/desligar um banco (ex: se
// a API cair ou o contrato mudar) é só comentar/remover a linha aqui,
// sem precisar mexer em mais nada.
const ADAPTADORES_BANCOS = {
  Pan: simularPan,
  Santander: simularSantander,
  Itaú: simularItau,
  BV: simularBV
};

// Busca placa e valor do veículo no Supabase a partir do nome (marca+modelo+versão)
// que a Sara já tem salvo no estado da conversa. Hoje (2026-10) nenhum veículo
// tem a placa cadastrada no Supabase ainda — isso precisa ser alimentado a partir
// do MobiAuto (ou outra fonte) separadamente. Essa função já fica pronta: no dia
// que a placa estiver no banco, a simulação automática da Sara passa a enviá-la
// sem precisar tocar em mais nada aqui.
async function buscarVeiculoParaSimulacao(nomeVeiculo) {
  if (!nomeVeiculo) return { placa: null, veiculoValor: null };
  try {
    const { data } = await supabase
      .from("veiculos")
      .select("placa, preco, marca, modelo, versao")
      .eq("status", "disponivel");
    const alvo = (nomeVeiculo || "").toLowerCase();
    const match = (data || []).find(v => alvo.includes(`${v.marca || ""} ${v.modelo || ""}`.trim().toLowerCase()));
    return { placa: match?.placa || null, veiculoValor: match?.preco || null };
  } catch (e) {
    console.error("[SimulaçãoBancos] Erro ao buscar placa/valor do veículo:", e.message);
    return { placa: null, veiculoValor: null };
  }
}

// Roda todos os bancos configurados em paralelo. Um banco fora do ar ou
// com erro não trava os outros (Promise.allSettled). Salva cada resultado
// na tabela simulacoes_bancos e devolve a lista consolidada.
async function simularTodosBancos(dados, simulacaoId = null, telefone = null) {
  const bancos = Object.keys(ADAPTADORES_BANCOS);
  const resultados = await Promise.allSettled(bancos.map(b => ADAPTADORES_BANCOS[b](dados)));
  const consolidado = resultados.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { banco: bancos[i], status: "erro", mensagem: r.reason?.message || "Falha desconhecida" };
  });

  for (const item of consolidado) {
    try {
      await supabase.from("simulacoes_bancos").insert({
        simulacao_id: simulacaoId,
        telefone: telefone || "",
        banco: item.banco,
        status: item.status,
        taxa: item.taxa || null,
        parcela: item.parcela || null,
        cet: item.cet || null,
        prazo_meses: item.prazoMeses || null,
        mensagem: item.mensagem || null,
        resposta_bruta: item.respostaBruta || null
      });
    } catch (e) {
      console.error(`[SimulaçãoBancos] Erro ao salvar resultado de ${item.banco}:`, e.message);
    }
  }

  return consolidado;
}

// 🚨 Guarda-freio determinístico: a IA às vezes "inventa" parcelas de financiamento mesmo
// com a instrução no prompt pra nunca fazer isso — sobretudo depois de um desconto de PREÇO
// ser autorizado pelo consultor, que não tem nenhuma relação com aprovação de crédito na
// financeira. Isso causou o caso da Cristiane (5551993498601, 2026-09-18): Sara confirmou
// "consegui! 24x de R$1.663..." com a simulação real ainda "pendente" na tabela
// simulacoes_credito, cliente foi até a loja achando que tava aprovado e não estava.
// Este check roda em código (não depende do modelo obedecer o prompt) antes de QUALQUER
// mensagem sair pro cliente.
function contemOfertaFinanciamentoConcreta(texto) {
  if (!texto) return false;
  return /\d{1,3}\s*x\s*(?:de\s*)?r\$\s*[\d.,]+/i.test(texto);
}

async function temSimulacaoPendente(telefone) {
  try {
    const { data } = await supabase.from("simulacoes_credito")
      .select("id")
      .eq("telefone", telefone)
      .eq("status", "pendente")
      .limit(1);
    return !!(data && data.length > 0);
  } catch (e) {
    console.error("[Crédito] Erro ao checar simulação pendente:", e.message);
    return false;
  }
}

async function bloquearSeParcelaSemSimulacaoReal(telefone, reply) {
  if (!contemOfertaFinanciamentoConcreta(reply)) return reply;
  if (!(await temSimulacaoPendente(telefone))) return reply;
  console.warn(`[Crédito] 🚨 Bloqueado: resposta tentou confirmar parcelas pra ${telefone} sem resultado real da financeira (simulação ainda pendente).`);
  try {
    const numero = telefone.replace(/\D/g, "");
    await enviarTexto(NUMERO_AUGUSTO, `⚠️ *${NOME_IA} tentou confirmar parcelas de financiamento sem simulação real*\nCliente: ${numero}\nA simulação de crédito desse cliente ainda está PENDENTE (nenhum resultado real informado). Bloqueei a mensagem automaticamente pra não passar valor errado.\nSe já tiver o resultado da financeira, responda: SIMULACAO ${numero} [resultado]`);
  } catch (e) {
    console.error("[Crédito] Erro ao notificar bloqueio de parcela:", e.message);
  }
  return "Ainda estou aguardando o retorno da nossa equipe sobre a sua simulação de crédito — assim que sair o resultado certinho da financeira, te aviso por aqui! 😊";
}

function detectarPedidoDesconto(texto) {
  const t = texto.toLowerCase().trim();
  const frases = [
    "consegue baixar", "pode baixar", "tem desconto", "da desconto",
    "aceita menos", "fecha por menos", "consegue por", "fecha por",
    "sai por", "toparia",
    "pago a vista", "pago em dinheiro", "pago no pix",
    "chegar em", "consegue em", "fecha em", "vai em", "sai em",
    "por menos", "aceita por", "topas por", "consegue chegar",
    "chega em", "voce consegue", "vc consegue",
    "tem como chegar", "tem como baixar", "consegue fazer",
    "daria pra fazer", "daria pra baixar", "da pra fazer", "da pra baixar",
    "ofereci", "ofereço", "minha proposta", "proponho",
    "topam", "topas", "topa", "bora fechar", "fecho por"
  ];
  const temValor = /r\$\s*[\d.,]+|[\d.,]+\s*mil|\d{4,}/.test(t);
  const temFrase = frases.some(f => t.includes(f));
  const temPropostaDireta = /\d{2,}\s*(mil|k)?\s*(a|à)\s*vista/i.test(t);
  const temOferta = /ofereci\s+\d|ofereço\s+\d|proponho\s+\d/.test(t);
  return (temFrase && temValor) || temPropostaDireta || temOferta || /em [5-9]\d/.test(t);
}

let avaliacaoPendente = null;

async function salvarAvaliacaoPendente(telefone, info) {
  avaliacaoPendente = { telefone, info, timestamp: Date.now() };
  try {
    await supabase.from("avaliacoes_pendentes").delete().neq("telefone", "");
    await supabase.from("avaliacoes_pendentes").insert({ telefone, info: JSON.stringify(info) });
  } catch (e) {
    console.error("[Avaliação] Erro ao persistir (tabela pode não existir ainda):", e.message);
  }
}

async function limparAvaliacaoPendente() {
  avaliacaoPendente = null;
  try {
    await supabase.from("avaliacoes_pendentes").delete().neq("telefone", "");
  } catch (e) {
    console.error("[Avaliação] Erro ao limpar persistência:", e.message);
