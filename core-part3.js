        await supabase.from("followups").update({ enviado: true }).eq("id", followup.id);
        await salvarMensagem(followup.telefone, "sara", mensagem);
        if (!conversas[followup.telefone]) conversas[followup.telefone] = [];
        conversas[followup.telefone].push({ role: "assistant", content: mensagem });
        await notificarAugusto(followup.telefone, `[FollowUp]: ${mensagem}`, false);

        if (followup.motivo === "sumiu") {
          const nivelAtual = followup.nivel || 1;
          const proximoNivel = nivelAtual + 1;
          if (proximoNivel <= NIVEL_MAXIMO_REATIVACAO) {
            const diasEspera = DIAS_PROXIMO_NIVEL[nivelAtual] || 3;
            await agendarFollowUp(followup.telefone, "sumiu", followup.veiculo_interesse, diasEspera, proximoNivel);
          } else {
            console.log(`[FollowUp] Régua de reativação encerrada (nível máximo) para ${followup.telefone}`);
          }
        }
      } catch (e) { console.error(`[FollowUp] Erro envio:`, e.message); }
    }
  } catch (e) { console.error("[FollowUp] Erro:", e.message); }
}

setInterval(processarFollowUpsPendentes, 30 * 60 * 1000);
processarFollowUpsPendentes();

function estaNoHorarioComercial() {
  const agora = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const d = new Date(agora);
  const dia = d.getDay();
  const hora = d.getHours();
  if (dia === 0) return false;
  if (dia === 6) return hora >= 8 && hora < 12;
  return hora >= 8 && hora < 18;
}

function avisoForaDoHorario() {
  const agora = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const d = new Date(agora);
  const dia = d.getDay();
  if (dia === 0) return "nosso consultor retorna amanhã (segunda-feira) a partir das 8h";
  if (dia === 6) return "nosso consultor retorna na segunda-feira a partir das 8h";
  return "nosso consultor retorna amanhã a partir das 8h";
}

async function notificarAugusto(from, texto, primeiraVez = false) {
  const agora = Date.now();
  const ultima = ultimaNotificacao[from] || 0;
  if (!primeiraVez && agora - ultima < 30 * 60 * 1000) return;
  ultimaNotificacao[from] = agora;
  const numero = from.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
  const mensagem = `${primeiraVez ? "🆕 *Novo cliente*" : "📩 *Mensagem*"}\nNúmero: ${formatado}\n"${String(texto).substring(0, 100)}"\n\n${BASE_URL}/painel`;
  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: mensagem } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`[Notificação] ✅ ${primeiraVez ? "Novo" : "Update"} — ${formatado}`);
  } catch (e) {
    console.error(`[Notificação] Erro:`, e.message);
    const codigoMeta = e.response?.data?.error?.code;
    if (codigoMeta === 131047) {
      try {
        await supabase.from("alertas_pendentes").insert({ texto: mensagem });
        console.log(`[Notificação] ⚠️ Alerta salvo como pendente (janela 24h fechada): ${formatado}`);
      } catch (e2) { console.error("[Notificação] Erro ao salvar alerta pendente:", e2.message); }
    }
  }
}

async function notificarCarroNaoDisponivel(from, modeloBuscado, infoCliente) {
  const numero = from.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
  const linkWhatsApp = `https://wa.me/${numero}`;
  const mensagem = `🔍 *Solicitação de veículo não disponível*\nCliente: ${formatado}\nProcura: *${modeloBuscado}*\n${infoCliente ? `Mensagem: "${infoCliente.substring(0, 150)}"` : ""}\n\nFalar com cliente: ${linkWhatsApp}`;
  try {
    await enviarTexto(NUMERO_AUGUSTO, mensagem);
    console.log(`[Notificação] ✅ Carro não disponível notificado: ${modeloBuscado} de ${formatado}`);
  } catch (e) { console.error(`[Notificação] Erro carro:`, e.message); }
}

function veiculoAindaEstaDisponivel(nomeVeiculo) {
  if (!nomeVeiculo) return true; // sem veiculo associado, nao ha o que checar
  // Guarda contra condição de corrida na inicialização do servidor: processarFollowUpsPendentes()
  // roda logo no boot, ANTES de sincronizarEstoque() terminar de popular estoqueAtual pela primeira
  // vez. Sem essa guarda, todo follow-up pendente no momento de um restart é cancelado como "vendido"
  // porque estoqueAtual ainda está vazio ([]) — caso real: Ecosport 2005 (ainda disponível/publicado
  // no Supabase) cancelado erroneamente logo após um restart em 2026-10-08. Se o estoque ainda não
  // carregou nenhuma vez, não dá pra confiar que o veículo "sumiu" — assume disponível e deixa o
  // follow-up seguir; a checagem roda de novo no próximo ciclo (a cada 30min) já com estoque carregado.
  if (!estoqueAtual.length) return true;
  const normalizarPalavras = (str) => limparTexto(str || "").toLowerCase().split(/\s+/).filter(p => p.length >= 3 && !/^\d+([.,]\d+)?$/.test(p));
  const nomeLower = limparTexto(nomeVeiculo).toLowerCase();
  const palavrasBuscadas = normalizarPalavras(nomeVeiculo);
  if (!palavrasBuscadas.length) return true; // nome generico demais pra checar com seguranca
  return estoqueAtual.some(v => {
    const modeloEstoque = limparTexto(v.modelo || "").toLowerCase();
    const palavrasEstoque = normalizarPalavras(v.modelo);
    return modeloEstoque.includes(nomeLower) ||
      nomeLower.includes(modeloEstoque) ||
      palavrasBuscadas.some(p => palavrasEstoque.includes(p));
  });
}

async function notificarFollowUpVeiculoVendido(telefone, veiculo) {
  const numero = telefone.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : telefone;
  const linkWhatsApp = `https://wa.me/${numero}`;
  const mensagem = `⏸️ *Follow-up cancelado — veículo vendido*\nCliente: ${formatado}\nEstava de olho em: *${veiculo}*\n\nEsse veículo já saiu do estoque, então o follow-up automático foi cancelado pra não incomodar o cliente com um carro que já era. Se fizer sentido, oferece uma alternativa parecida.\n\nFalar com cliente: ${linkWhatsApp}`;
  try {
    await enviarTexto(NUMERO_AUGUSTO, mensagem);
    console.log(`[FollowUp] ✅ Notificado cancelamento (veiculo vendido): ${veiculo} de ${formatado}`);
  } catch (e) { console.error(`[FollowUp] Erro ao notificar cancelamento:`, e.message); }
}

async function notificarFotoComAnalise(from, imageBuffer, mimeType, analise, caption = "") {
  const numero = from.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
  const legenda = `📸 *Foto recebida de ${formatado}*${caption ? `\nLegenda do cliente: "${caption}"` : ""}\n\n*Analise da ${NOME_IA}:*\n${analise}`;
  try {
    const formData = new FormData();
    formData.append("file", Buffer.from(imageBuffer), { filename: "foto.jpg", contentType: mimeType });
    formData.append("messaging_product", "whatsapp");
    const uploadRes = await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/media`, formData,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, ...formData.getHeaders() } }
    );
    const novoMediaId = uploadRes.data.id;

    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, type: "image", image: { id: novoMediaId, caption: legenda.substring(0, 1024) } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`[Foto→Consultor] ✅ Repassada foto de ${from}`);
    await registrarEnvioFotoConsultor(from, analise, caption, true, null);
    return true;
  } catch (e) {
    console.error(`[Foto→Consultor] Erro ao reenviar imagem (tentando so texto):`, e.response?.data ? JSON.stringify(e.response.data) : e.message);
    try {
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: legenda + "\n\n⚠️ (nao foi possivel reenviar a imagem original)" } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await registrarEnvioFotoConsultor(from, analise, caption, true, `Imagem falhou, enviado como texto: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`);
      return true;
    } catch (e2) {
      console.error(`[Foto→Consultor] Erro tambem no fallback de texto:`, e2.message);
      try {
        await supabase.from("alertas_pendentes").insert({
          texto: `📸 *Falha ao repassar foto de troca*\nCliente: ${formatado}\n${caption ? `Legenda: "${caption}"\n` : ""}\n*Analise da ${NOME_IA}:*\n${analise}\n\n⚠️ Nem a imagem nem o texto chegaram ao WhatsApp do consultor (erro: ${e2.message}). Confira a conversa no CRM.`
        });
      } catch (e3) { console.error("[Foto→Consultor] Erro ao salvar alerta pendente:", e3.message); }
      await registrarEnvioFotoConsultor(from, analise, caption, false, e2.message);
      return false;
    }
  }
}

async function arquivarFotoCliente(urlTemporaria, mediaId, mimeType) {
  // A URL que a Meta devolve pra mídia recebida é assinada e expira rápido (horas, não dias).
  // Baixamos o arquivo agora e guardamos uma cópia permanente no Supabase Storage,
  // no mesmo bucket já usado pras fotos/vídeos de veículo, pra nunca perder a foto do cliente.
  try {
    const imgRes = await axios.get(urlTemporaria, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, responseType: "arraybuffer" });
    const ext = (mimeType || "image/jpeg").split("/")[1]?.split("+")[0] || "jpg";
    const nomeArquivo = `fotos-clientes/${mediaId}.${ext}`;
    const { error } = await supabase.storage.from("veiculos").upload(nomeArquivo, imgRes.data, {
      contentType: mimeType || "image/jpeg",
      upsert: true
    });
    if (error) { console.error("[FotoCliente] Erro ao subir pro Storage:", error.message); return null; }
    const { data: urlData } = supabase.storage.from("veiculos").getPublicUrl(nomeArquivo);
    console.log(`[FotoCliente] ✅ Arquivada permanentemente: ${nomeArquivo}`);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("[FotoCliente] Erro ao arquivar foto do cliente:", e.message);
    return null;
  }
}

async function registrarEnvioFotoConsultor(telefone, analise, caption, sucesso, erro) {
  try {
    await supabase.from("fotos_consultor_log").insert({ telefone, analise, legenda_cliente: caption || null, sucesso, erro });
  } catch (e) {
    console.error("[Foto→Consultor] Erro ao registrar log em fotos_consultor_log:", e.message);
  }
}

async function buscarEstoqueInstagram() {
  try {
    console.log("[Instagram] Buscando posts...");
    const veiculos = [];
    let url = `https://graph.facebook.com/v25.0/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_type,media_url,children{media_url}&limit=50&access_token=${INSTAGRAM_TOKEN}`;
    let paginas = 0;
    const maxPaginas = 10;

    while (url && paginas < maxPaginas) {
      const res = await axios.get(url);
      const posts = res.data.data || [];
      paginas++;

      for (const post of posts) {
        const caption = limparTexto(post.caption || "");
        if (!caption.includes("R$")) continue;
        let fotos = [];
        if (post.media_type === "CAROUSEL_ALBUM" && post.children) fotos = post.children.data.map(c => c.media_url).filter(Boolean);
        else if (post.media_url) fotos = [post.media_url];
        const precoMatch = caption.match(/R\$\s*([\d.,]+)/);
        const kmMatch = caption.match(/([\d.,]+)\s*km/i);
        const anoMatch = caption.match(/(\d{4})\/\d{4}|(\d{4})/);
        const linhas = caption.split("\n").filter(l => l.trim());
        const preco = precoMatch ? parseFloat(precoMatch[1].replace(/\./g, "").replace(",", ".")) : 0;
        if (preco === 0) continue;
        veiculos.push({
          id: post.id,
          modelo: limparTexto(linhas[0] || "").replace(/[🚗🚙🏎️]/g, "").trim(),
          ano: anoMatch ? (anoMatch[1] || anoMatch[2]) : "",
          km: kmMatch ? parseFloat(kmMatch[1].replace(/\./g, "").replace(",", ".")) : 0,
          preco,
          descricao: caption, fotos, atualizadoEm: new Date().toISOString()
        });
      }

      const nextCursor = res.data.paging?.cursors?.after;
      const hasNext = res.data.paging?.next;
      if (hasNext && nextCursor && posts.length > 0) {
        url = `https://graph.facebook.com/v25.0/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_type,media_url,children{media_url}&limit=50&after=${nextCursor}&access_token=${INSTAGRAM_TOKEN}`;
        console.log(`[Instagram] Buscando página ${paginas + 1}... (${veiculos.length} veículos até agora)`);
      } else {
        url = null;
      }
    }

    console.log(`[Instagram] ✅ ${veiculos.length} veículos extraídos (${paginas} página(s))`);
    return veiculos;
  } catch (e) { console.error("[Instagram] Erro:", e.message); return []; }
}

async function sincronizarEstoque() {
  try {
    const { data: veiculosSupabase, error } = await supabase
      .from("veiculos")
      .select("id, marca, modelo, versao, ano_fabricacao, ano_modelo, km, preco, descricao, fotos, cambio, combustivel, cor")
      .eq("status", "disponivel")
      .order("criado_em", { ascending: false });

    if (!error && veiculosSupabase?.length > 0) {
      estoqueAtual = veiculosSupabase.map(v => ({
        id: v.id,
        modelo: `${v.marca || ""} ${v.modelo || ""} ${v.versao || ""}`.trim(),
        marca: v.marca || "",
        modeloBase: v.modelo || "",
        versaoTexto: v.versao || "",
        ano: v.ano_modelo || v.ano_fabricacao,
        km: v.km,
        preco: v.preco,
        descricao: v.descricao || "",
        fotos: Array.isArray(v.fotos) ? v.fotos : [],
        cambio: v.cambio,
        combustivel: v.combustivel,
        cor: v.cor
      })).filter(v => v.modelo && v.preco);

      ultimaAtualizacao = new Date().toLocaleString("pt-BR");
      console.log(`[Estoque] ✅ ${estoqueAtual.length} veículos do Supabase | ${ultimaAtualizacao}`);
      return;
    }
    if (error) console.error("[Estoque] Erro Supabase:", error.message);
  } catch (e) {
    console.error("[Estoque] Exceção Supabase:", e.message);
  }

  try {
    const veiculos = await buscarEstoqueInstagram();
    if (veiculos.length > 0) {
      estoqueAtual = veiculos;
      ultimaAtualizacao = new Date().toLocaleString("pt-BR");
      console.log(`[Estoque] ✅ ${veiculos.length} veículos do Instagram (fallback) | ${ultimaAtualizacao}`);
    }
  } catch (e) { console.error("[Estoque] Erro Instagram:", e.message); }
}

sincronizarEstoque();
setInterval(sincronizarEstoque, 30 * 60 * 1000);

setInterval(async () => {
  try {
    await axios.get(`${BASE_URL}`);
    console.log("[KeepAlive] ✅ Ativo");
  } catch (e) { console.error("[KeepAlive] Erro:", e.message); }
}, 10 * 60 * 1000);

async function getMarcasFipe() {
  if (cacheMarcasFipe) return cacheMarcasFipe;
  const res = await axios.get("https://parallelum.com.br/fipe/api/v1/carros/marcas");
  cacheMarcasFipe = res.data;
  return cacheMarcasFipe;
}

async function consultarFipe(marca, modelo, ano) {
  if (!marca || !modelo || !ano) return null;
  const chave = `${marca}-${modelo}-${ano}`.toLowerCase();
  if (fipeCache[chave]) return fipeCache[chave];
  try {
    const marcas = await getMarcasFipe();
    const marcaFipe = marcas.find(m => m.nome.toLowerCase().includes(marca.toLowerCase()) || marca.toLowerCase().includes(m.nome.toLowerCase().split(" ")[0]));
    if (!marcaFipe) return null;
    const modelosRes = await axios.get(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${marcaFipe.codigo}/modelos`);
    const palavrasModelo = modelo.toLowerCase().split(" ").filter(p => p.length > 1);
    let candidatos = modelosRes.data.modelos.filter(m => palavrasModelo.every(p => m.nome.toLowerCase().includes(p)));
    let _fipeIncerto = false;
    if (!candidatos.length) {
      candidatos = modelosRes.data.modelos.filter(m => m.nome.toLowerCase().includes(palavrasModelo[0]));
      _fipeIncerto = true;
    }
    if (candidatos.length > 1) _fipeIncerto = true;
    if (!candidatos.length) return null;
    for (const c of candidatos) {
      const anosRes = await axios.get(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${marcaFipe.codigo}/modelos/${c.codigo}/anos`);
      const anoFipe = anosRes.data.find(a => a.nome.includes(ano.toString()) && !a.nome.includes("32000"));
      if (anoFipe) {
        const valorRes = await axios.get(`https://parallelum.com.br/fipe/api/v1/carros/marcas/${marcaFipe.codigo}/modelos/${c.codigo}/anos/${anoFipe.codigo}`);
        valorRes.data._incerto = _fipeIncerto;
        valorRes.data._candidatos = candidatos.map(x => x.nome).slice(0, 5);
        fipeCache[chave] = valorRes.data;
        console.log(`✅ FIPE: ${valorRes.data.Modelo} = ${valorRes.data.Valor}`);
        return valorRes.data;
      }
    }
    return null;
  } catch (e) { return null; }
}

function calcularValoresTroca(valorFipeStr) {
  const valor = parseFloat(valorFipeStr.replace("R$ ", "").replace(/\./g, "").replace(",", "."));
  return {
    minimoFormatado: Math.round(valor * 0.80).toLocaleString("pt-BR"),
    maximoFormatado: Math.round(valor * 0.85).toLocaleString("pt-BR")
  };
}

async function transcreverAudio(mediaId) {
  try {
    const mediaRes = await axios.get(`https://graph.facebook.com/v25.0/${mediaId}`, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    const audioRes = await axios.get(mediaRes.data.url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, responseType: "arraybuffer" });
    const formData = new FormData();
    formData.append("file", Buffer.from(audioRes.data), { filename: "audio.ogg", contentType: "audio/ogg" });
    formData.append("model", "whisper-large-v3");
    formData.append("language", "pt");
    const res = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", formData, { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, ...formData.getHeaders() } });
    return res.data.text;
  } catch (e) { return null; }
}

async function analisarImagem(mediaId, caption, from) {
  try {
    const mediaRes = await axios.get(`https://graph.facebook.com/v25.0/${mediaId}`, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    const imageRes = await axios.get(mediaRes.data.url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, responseType: "arraybuffer" });
    const base64Image = Buffer.from(imageRes.data).toString("base64");
    const res = await axios.post("https://api.anthropic.com/v1/messages",
      { model: "claude-haiku-4-5", max_tokens: 200, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaRes.data.mime_type || "image/jpeg", data: base64Image } },
        { type: "text", text: `Avaliador de veículos. Com base SOMENTE nesta foto, descreva em até 2 linhas uma IMPRESSÃO PRELIMINAR (não um laudo confirmado): estado geral aparente, pontos positivos e pontos de atenção. Use linguagem de possibilidade ("parece", "pode ser", "aparenta", "dá pra notar algo que pode ser") e NUNCA afirme categoricamente um defeito, dano ou estado do veículo como fato — a palavra final é sempre do consultor humano, presencialmente. ${caption ? `Contexto: ${caption}` : ""}` }
      ]}] },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );
    const analise = res.data.content[0].text;

    if (from) notificarFotoComAnalise(from, imageRes.data, mediaRes.data.mime_type || "image/jpeg", analise, caption).catch(() => {});

    return analise;
  } catch (e) {
    if (e.response) {
      await notificarFalhaApiClaude(e, `Análise de imagem (${from || "desconhecido"})`);
    } else {
      console.error(`[Foto→Análise] Falha ao baixar/processar mídia de ${from || "desconhecido"} (media ${mediaId}):`, e.message);
      try {
        await supabase.from("alertas_pendentes").insert({
          texto: `⚠️ Falha ao processar foto de cliente (${from || "desconhecido"}, mediaId ${mediaId}): ${e.message}`
        });
      } catch (e2) { console.error("[Foto→Análise] Erro ao salvar alerta pendente:", e2.message); }
    }
    return null;
  }
}

// Detecta quando o cliente esta dizendo que NAO recebeu as fotos (reclamacao), nao
// apenas pedindo fotos pela primeira vez. Adicionado 2026-10-28: sem isso, quando o
// cliente reclamava ("nao recebi", "cade as fotos") depois de uma tentativa de envio,
// o fluxo deterministico podia nao disparar de novo (por causa do jaEnviouFotos) e a
// conversa caia no caminho da IA generativa, que por vezes insistia "ja mandei as
// fotos" (ou ate vazava um marcador interno tipo "[fotos enviadas]") em vez de
// reenviar de fato. Essa reclamacao agora forca uma nova tentativa real de envio,
// mesmo que o sistema acredite que ja enviou antes.
function clienteReclamouFotosNaoRecebidas(texto) {
  const t = (texto || "").toLowerCase();
  if (!t.includes("foto")) return false;
  if (t.includes("cadê") || t.includes("cade")) return true;
  if (/n[ãa]o\s+(recebi|chegou|chegaram|vi|apareceu|apareceram)/.test(t)) return true;
  if (/nenhuma\s+fotos?\s+chegou/.test(t)) return true;
  return false;
}

function clienteEstaPedindoFotosDoEstoque(texto, historicoConversa) {
  const t = texto.toLowerCase().trim();
  if (clienteEstaEmFluxoTroca(historicoConversa)) return false;
  const ultimaResposta = (historicoConversa || []).filter(m => m.role === "assistant").slice(-1)[0]?.content || "";
  const ultimaRespostaLower = ultimaResposta.toLowerCase();
  const confirmacoesSimples = ["sim", "quero", "pode", "manda", "claro", "ok", "vai", "manda sim", "quero sim"];
  const ehConfirmacaoCurta = t.length <= 30 && confirmacoesSimples.some(p => t === p || t.includes(p));
  // Correcao 2026-11-02: antes disso, uma confirmacao curta tipo "Sim" apos QUALQUER
  // mensagem da Sara contendo "foto" disparava envio de fotos do ESTOQUE - mesmo quando a
  // Sara tinha acabado de PEDIR fotos do carro do CLIENTE pra avaliacao de troca (caso
  // Paulo Boaventura Reis, 5551993921038: Sara pediu "consegue me mandar umas fotos?" do
  // Ka de troca, cliente respondeu "Sim", e o sistema mandou fotos do Toyota Etios do
  // estoque por engano). Agora so dispara se a ultima resposta da Sara NAO for um pedido
  // de fotos AO cliente.
  const saraPediuFotoDoCliente = /me\s+mandar?\b[\s\S]{0,25}?fotos?/i.test(ultimaRespostaLower) ||
    /consegue\s+me\s+mandar/i.test(ultimaRespostaLower);
  if (ehConfirmacaoCurta && ultimaRespostaLower.includes("foto") && !saraPediuFotoDoCliente) return true;
  const naoEPedido = ["te mando", "vou mandar", "vou te mandar", "ja mando", "já mando", "mando agora", "mandando foto", "vou enviar", "to mandando", "tô mandando"];
  if (naoEPedido.some(p => t.includes(p))) return false;
  const ePedido = [
    "tem foto", "tem fotos", "manda foto", "manda as foto", "pode mandar foto",
    "me manda foto", "me passa foto", "quero ver foto", "quero ver as foto",
    "me mostra", "posso ver", "foto dele", "fotos dele", "vai mandar as fotos",
    "as fotos", "quero foto", "quero as foto", "manda as fotos", "me manda as foto",
    "quero ver", "me mostra as foto", "me mostra as fotos", "ver as fotos",
    "ver as foto", "pode mandar as foto", "pode mandar as fotos",
    "queto foto", "queto as foto", "queto ver", "quer foto", "quer as foto",
    "manda imagem", "me manda imagem", "tem imagem", "ver imagem",
    "tem interna", "tem internas", "foto interna", "fotos interna",
    "foto do interior", "interior", "foto do painel", "foto dos bancos",
    "foto da frente", "foto de tras", "foto de trás", "mais foto", "mais fotos",
    "outras foto", "outras fotos", "ver mais"
  ];
  const ePedidoAdicional = ["tem interna", "tem internas", "mais foto", "mais fotos", "outras foto", "outras fotos", "ver mais", "interior", "foto do painel", "foto dos bancos"];
  if (ePedidoAdicional.some(p => t.includes(p))) return "adicional";
  return ePedido.some(p => t.includes(p));
}

// Palavras genéricas demais para identificar um veículo específico (conectivos comuns em
// português + termos de vistoria/ficha técnica que aparecem em qualquer anúncio/laudo).
// Adicionado 2026-09-02: sem esse filtro, "com"/"carroceria" (presentes na versão de um
// anúncio qualquer, ex: Kia Bongo "...RD com carroceria") batiam com o texto genérico que a
// própria Sara gera ao analisar fotos de avaliação de troca ("Carroceria limpa... com pintura
// preservada..."), fazendo o sistema "confirmar" um veículo errado no CRM (caso Humberto
// Juncal, 2026-09-01: veiculo_interesse virou "Kia Bongo..." numa conversa 100% sobre Prisma).
const STOPWORDS_VEICULO = new Set([
  "com", "para", "sem", "dos", "das", "por", "que", "uma", "umas", "uns", "dois", "duas",
  "dele", "dela", "seu", "sua", "seus", "suas", "este", "esta", "esse", "essa", "isso",
  "muito", "pouco", "mais", "menos", "bem", "mal", "tudo", "nada", "aqui", "ali", "onde",
  "quando", "como", "porque", "porem", "porém", "mas", "também", "tambem", "ainda",
  "depois", "antes", "agora", "carroceria", "completo", "completa", "original", "originais",
  "conservado", "conservada", "estado", "geral", "bom", "boa", "otimo", "ótimo", "excelente",
  "novo", "nova", "usado", "usada", "simples", "cabine", "flex", "gasolina", "alcool",
  "álcool", "diesel", "manual", "automatico", "automático", "aut", "mec", "top", "full",
  "plus", "comfort", "confort", "cvt", "turbo", "dlx", "glx", "gls", "exl", "ltz", "lt",
  "ls", "sel", "cli", "cd"
]);

function extrairPalavrasRelevantes(texto) {
  return limparTexto(texto || "").toLowerCase().split(/\s+/)
    .filter(p => p.length >= 3 && !/^\d+([.,]\d+)?$/.test(p) && !STOPWORDS_VEICULO.has(p));
}

// Checa se `palavra` aparece no texto como PALAVRA INTEIRA (respeitando \b), nunca como
// substring de outra palavra. Adicionado 2026-10-26: antes disso, o match usava
// texto.includes(palavra), e isso fez o sistema confundir "crossfox" (carro antigo que a
// cliente estava trocando/vendendo) com o "Fox" do estoque, trocando o veiculo_interesse no
// meio de uma negociação que era sobre a Meriva (caso Vilma Gialdi, 5567996050485, 2026-10-26).
function contemPalavraInteira(texto, palavra) {
  const escapada = String(palavra).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}\\b`, "i").test(texto);
}

function encontrarVeiculoNoContexto(texto, historicoConversa, estoque) {
  const mensagensRecentes = [
    { role: "user", content: texto },
    ...(historicoConversa || []).slice().reverse()
  ];

  // Palavras "fortes" (marca/modelo) precisam bater pelo menos uma vez — palavras da versão
  // ("simples", "4x2", etc, já filtradas de termos genéricos acima) só reforçam o placar,
  // nunca decidem sozinhas. Isso evita que termos soltos e genéricos da versão de UM anúncio
  // (ex: "carroceria") sejam confundidos com o veículo que o cliente está falando de verdade.
  function pontuarVeiculo(v, textoAlvo) {
    const palavrasFortes = extrairPalavrasRelevantes(`${v.marca || ""} ${v.modeloBase || v.modelo || ""}`);
    if (!palavrasFortes.length) return 0;
    const acertosFortes = palavrasFortes.filter(p => contemPalavraInteira(textoAlvo, p)).length;
    if (acertosFortes === 0) return 0;
    const palavrasFracas = extrairPalavrasRelevantes(v.versaoTexto || "");
    const acertosFracos = palavrasFracas.filter(p => contemPalavraInteira(textoAlvo, p)).length;
    let score = acertosFortes * 2 + acertosFracos;
    if (v.ano && contemPalavraInteira(textoAlvo, String(v.ano))) score += 1;
    return score;
  }

  for (const msg of mensagensRecentes.slice(0, 12)) {
    const textoMsg = (msg.content || "").toLowerCase();
    if (!textoMsg.trim()) continue;
    let melhorMatch = null, melhorScore = 0;
    for (const v of estoque) {
      const score = pontuarVeiculo(v, textoMsg);
      if (score > melhorScore) { melhorScore = score; melhorMatch = v; }
    }
    if (melhorMatch && melhorScore >= 2) return melhorMatch;
  }

  const todosTextos = mensagensRecentes.map(m => (m.content || "").toLowerCase()).join(" ");
  let melhorMatchGeral = null, melhorScoreGeral = 0;
  for (const v of estoque) {
    const score = pontuarVeiculo(v, todosTextos);
    if (score > melhorScoreGeral) { melhorScoreGeral = score; melhorMatchGeral = v; }
  }
  if (melhorMatchGeral && melhorScoreGeral >= 2) return melhorMatchGeral;

  return null;
}

function contarVeiculosAmbiguos(texto, estoque) {
  const t = texto.toLowerCase();
  function pontuar(v) {
    const palavrasFortes = extrairPalavrasRelevantes(`${v.marca || ""} ${v.modeloBase || v.modelo || ""}`);
    if (!palavrasFortes.length) return 0;
    return palavrasFortes.filter(p => contemPalavraInteira(t, p)).length;
  }
  const candidatos = estoque.filter(v => pontuar(v) >= 1);
  return candidatos;
}

async function obterVeiculoAtualConversa(from, texto, historicoConversa) {
  const encontrado = encontrarVeiculoNoContexto(texto, historicoConversa, estoqueAtual);
  if (encontrado) {
    veiculoAtualCache[from] = encontrado;
    salvarVeiculoAtualPersistido(from, encontrado).catch(() => {});
    return encontrado;
  }
  if (veiculoAtualCache[from]) return veiculoAtualCache[from];
  const persistido = await carregarVeiculoAtualPersistido(from);
  if (persistido) veiculoAtualCache[from] = persistido;
  return persistido;
}

async function salvarVeiculoAtualPersistido(telefone, veiculo) {
  try {
    const nome = `${limparTexto(veiculo.modelo || "")} ${veiculo.ano || ""}`.trim().slice(0, 100);
    if (!nome) return;
    await supabase.from("clientes").upsert({ telefone, veiculo_interesse: nome }, { onConflict: "telefone" });
  } catch (e) { console.error("[VeiculoAtual] Erro ao persistir:", e.message); }
}

async function carregarVeiculoAtualPersistido(telefone) {
  try {
    const { data } = await supabase.from("clientes").select("veiculo_interesse").eq("telefone", telefone).limit(1);
    const nome = data?.[0]?.veiculo_interesse;
    if (!nome) return null;
    const nomeLower = String(nome).toLowerCase();
    return estoqueAtual.find(v => {
      const modelo = limparTexto(v.modelo || "").toLowerCase();
      return modelo && (nomeLower.includes(modelo) || modelo.includes(nomeLower));
    }) || null;
  } catch (e) { return null; }
}

async function enviarFotosVeiculo(to, veiculo) {
  const fotos = (veiculo.fotos || []).slice(0, 10);
  if (!fotos.length) return false;
  let sucessos = 0;
  const fotosEnviadas = [];
  for (const url of fotos) {
    try {
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to, type: "image", image: { link: url } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      sucessos++;
      fotosEnviadas.push(url);
      await new Promise(r => setTimeout(r, 600));
    } catch (e) { console.error(`Erro foto: ${e.message}`); }
  }
  console.log(`[Fotos] Enviadas: ${sucessos}/${fotos.length}`);
  if (fotosEnviadas.length > 0) {
    await salvarMensagem(to, "sara_fotos", JSON.stringify({
      modelo: limparTexto(veiculo.modelo || ""),
      fotos: fotosEnviadas
    }));
  }
  return sucessos > 0;
}

function formatarEstoque(modeloFiltro = null) {
  if (!estoqueAtual.length) return "Estoque sendo carregado.";
  if (modeloFiltro) {
    const termos = modeloFiltro.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
    const relevantes = estoqueAtual.filter(v => {
      const modelo = limparTexto(v.modelo || "").toLowerCase();
      return termos.some(t => modelo.includes(t));
    });
    const lista = relevantes.length > 0 ? relevantes : estoqueAtual;
    return lista.map(v => {
      const cabecalho = `${limparTexto(v.modelo || "")} ${v.ano || ""} - ${Number(v.km || 0).toLocaleString("pt-BR")} km - R$ ${Number(v.preco || 0).toLocaleString("pt-BR")}`;
      const descricaoCompleta = limparTexto(v.descricao || "").substring(0, 500);
      return descricaoCompleta ? `${cabecalho}\n Detalhes do anúncio: ${descricaoCompleta}` : cabecalho;
    }).join("\n\n");
  }
  return estoqueAtual.map(v =>
    `${limparTexto(v.modelo || "")} ${v.ano || ""} - ${Number(v.km || 0).toLocaleString("pt-BR")} km - R$ ${Number(v.preco || 0).toLocaleString("pt-BR")}`
  ).join("\n");
}

// Bug (06/11): a Sara prometia "vou te avisar quando chegar [X]" sem nenhuma fonte real de
// dados sobre reposição de estoque/pedidos futuros (não existe tabela pra isso no Supabase).
// Trava de código, além da instrução de prompt: se a resposta sair com essa promessa mesmo
// assim, ela é substituída por uma resposta honesta (sem previsão confirmada).
function bloquearPromessaEstoqueFuturo(reply) {
  const padroesProibidos = [
    /vou\s+(te\s+)?avisar\s+quando\s+(chegar|tiver|houver)/i,
    /te\s+avis[oa]\s+quando\s+chegar/i,
    /vou\s+verificar\s+(a\s+)?disponibilidade\s+futura/i,
    /assim\s+que\s+chegar.{0,20}aviso/i,
    /avis[oa]\s+quando\s+tivermos/i
  ];
  if (padroesProibidos.some(p => p.test(reply))) {
    return "Não tenho uma previsão de chegada confirmada disso no estoque no momento. Posso anotar seu interesse pro nosso consultor te avisar se algo compatível aparecer, mas sem garantir prazo — quer que eu faça isso? 😊";
  }
  return reply;
}

function extrairKmDoTexto(texto) {
  const t = (texto || "").toLowerCase();
  let m = t.match(/(\d{2,3})\s*mil\s*km/);
  if (m) return parseInt(m[1], 10) * 1000;
  m = t.match(/(\d{1,3}(?:\.\d{3})+)\s*km/);
  if (m) return parseInt(m[1].replace(/\./g, ""), 10);
  m = t.match(/(\d{4,6})\s*km/);
  if (m) return parseInt(m[1], 10);
  return null;
}

// Bug (06/11): num caso real, a Sara se corrigiu de uma análise de foto errada chamando o
// carro de "zerado" — mesmo ele tendo 110 mil km. Trava de código: se a resposta final usa
// "zerado" e o histórico recente menciona uma quilometragem alta, troca por linguagem neutra.
function bloquearAdjetivoZeradoComKmAlto(reply, historicoTexto) {
  if (!/\bzerad[oa]\b/i.test(reply)) return reply;
  const km = extrairKmDoTexto(historicoTexto);
  if (km !== null && km > 20000) {
    return reply.replace(/\bzerad[oa]\b/gi, "em bom estado");
  }
  return reply;
}

const SYSTEM_PROMPT = (fipeInfo, aprendizadosExtra = "", carroNaoDisponivel = null, descontoPendenteAtivo = false, veiculosAmbiguos = null, modeloMencionado = null, versaoIncerta = null, veiculoAtual = null) => {
  const agora = new Date();
  const dataHoraAtual = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}, revendedora de veículos usados em Porto Alegre/RS.

DATA E HORA ATUAL: ${dataHoraAtual} (horário de Porto Alegre/RS)
- Use essa informação para saber se é manhã, tarde, noite, ou outro dia.
- Se um compromisso combinado anteriormente (ex: "vir de manhã") já passou do horário, NÃO repita a mesma combinação como se ainda fosse válida — pergunte se ainda está de pé ou se precisa reagendar.
- Nunca presuma que "hoje" na conversa atual é o mesmo dia de mensagens antigas do histórico sem checar a data.

EMPRESA: Av. Aparício Borges, 931 | Seg-Sex 8h-18h, Sáb 8h-12h | Consultor: (51) 99364-2476
- BAIRRO/PONTO DE REFERÊNCIA: os dados fixos da empresa acima NÃO incluem o bairro. Se o cliente perguntar em que bairro fica a loja ou pedir um ponto de referência, informe apenas o endereço (Av. Aparício Borges, 931) e sugira usar esse endereço no GPS/Maps. NUNCA invente ou chute o nome de um bairro, região ou ponto de referência que não esteja escrito neste prompt — se não tiver certeza, diga que vai confirmar com a equipe em vez de arriscar um nome errado.
FINANCEIRAS: Trabalhamos com BV, Santander, Itaú, Bradesco, C6, Daycoval e Pan. Quando o cliente perguntar sobre bancos ou financeiras, informe essas opções diretamente — mesmo que esteja no meio da coleta de dados de crédito. Responda a pergunta e depois continue a coleta naturalmente.

${!estaNoHorarioComercial() ? `⚠️ FORA DO HORÁRIO COMERCIAL: Você pode continuar atendendo e qualificando o cliente normalmente (perguntar sobre veículo, coletar dados para simulação, pedir fotos do carro de troca), mas ao final de cada resposta avise de forma natural que "${avisoForaDoHorario()}" para dar a resposta definitiva. Se o cliente fornecer dados de CPF para simulação, diga que os dados foram recebidos e que o consultor vai processar a simulação e retornar no próximo horário comercial. Não prometa coisas que dependem do consultor (preço especial, autorização de desconto, simulação aprovada) para entregar agora.` : ""}

HISTÓRICO DO VEÍCULO: Quando o cliente perguntar sobre batidas, sinistros, histórico ou procedência, responda que o veículo não consta com histórico de batidas ou sinistros — A MENOS que isso esteja explicitamente descrito na descrição do anúncio. Nunca invente problemas que não estão no anúncio, mas também nunca afirme garantias que não pode dar (como "nunca bateu" — use "não consta histórico de sinistros"). Para mais detalhes, ofereça vistoria presencial ou consulta ao histórico via Detran/Fipe.

PERFIL: Simpática, descontraída e profissional. Máximo 4 linhas por resposta — exceto quando precisar listar opções ou responder perguntas que exijam mais detalhes. NUNCA repita a saudação após a primeira mensagem. SEMPRE mantenha o contexto da conversa. NUNCA faça a mesma pergunta duas vezes — se você já perguntou algo (ex: "vai dar carro na troca?", "vai financiar ou à vista?") e o cliente não respondeu ainda, NÃO repita essa pergunta na próxima mensagem. Avance a conversa com outra informação ou pergunta diferente. Se o cliente demonstrar irritação, impaciência ou desistência durante qualquer processo (incluindo coleta de dados), reconheça e adapte — nunca insista mecanicamente no próximo passo.

REGRA CRÍTICA — NÃO ATENDE LIGAÇÕES: Este é um número de WhatsApp Business (API), não uma linha telefônica normal — NÃO recebe chamadas de voz nem chamadas de WhatsApp. NUNCA diga "pode me ligar", "pode ligar sim", "sem problema" ou qualquer frase que sugira que você atende ligações. Se o cliente disser que ligou e não conseguiu, ou perguntar se pode ligar, explique com naturalidade que esse número só atende por mensagem de texto/áudio aqui pelo WhatsApp, e que para falar direto por voz ele pode ligar para o consultor: (51) 99364-2476. Isso vale mesmo se a mensagem parecer ser de alguém que não é um cliente comum (ex: outro vendedor, prestador de serviço, ou mensagem endereçada a outro nome) — nunca ofereça ou confirme uma ligação de voz com você.

REGRA CRÍTICA — NUNCA MENCIONAR NOMES: Nunca cite "Augusto" ou qualquer nome pessoal. Use sempre "nosso consultor" ou "nossa equipe".

${veiculoAtual ? `🚨 VEICULO EM DISCUSSAO NESTA CONVERSA: ${limparTexto(veiculoAtual.modelo || "")} ${veiculoAtual.ano || ""} - R$ ${Number(veiculoAtual.preco || 0).toLocaleString("pt-BR")}
Este ja foi identificado como o veiculo em discussao nesta conversa (citado pelo cliente ou pelo anuncio de origem). Continue falando SOBRE ELE mesmo que o cliente mande uma mensagem curta, vaga ou generica ("vi agora", "e ai?", "qual cidade?", so um valor em R$, etc.) - mensagens vagas sao SEMPRE sobre este veiculo, nunca um convite pra trocar de assunto. So troque de veiculo se o cliente citar EXPLICITAMENTE outro modelo/marca pelo nome.` : ""}

ESTOQUE ATUAL (${ultimaAtualizacao || "carregando..."}):
${formatarEstoque(veiculoAtual ? limparTexto(veiculoAtual.modelo || "") : modeloMencionado)}

🚨 REGRA CRÍTICA DE PREÇOS — ABSOLUTA, SEM EXCEÇÕES:
- Use EXATAMENTE os preços do estoque acima, caractere por caractere. NUNCA invente, estime, arredonde ou "lembre de cabeça" um valor.
- Antes de escrever qualquer preço na resposta, releia a linha exata do estoque correspondente ao veículo. Copie o valor dali.
- Se o veículo mencionado pelo cliente NÃO aparecer claramente no estoque acima, NÃO cite nenhum valor — diga que vai confirmar com a equipe.
- Se você não tiver 100% de certeza de qual linha do estoque corresponde ao veículo, pergunte para o cliente confirmar o modelo/ano em vez de chutar um preço aproximado.
- JAMAIS informe um preço diferente do que está listado acima, mesmo que pareça "razoável" ou "parecido" com outros veículos.

🚨 REGRA CRÍTICA — NUNCA INVENTE VEÍCULOS QUE NÃO ESTÃO NO ESTOQUE:
- O estoque listado acima é COMPLETO e DEFINITIVO. Se uma marca ou modelo não aparece nessa lista, NÃO EXISTE na loja neste momento.
- Quando o cliente perguntar por uma marca/modelo que NÃO está no estoque, NUNCA invente modelos, preços ou disponibilidade. Em vez disso, diga que vai verificar com a equipe e que o consultor vai entrar em contato — o sistema vai notificar o consultor automaticamente.
- VARIAÇÕES DE NOMES: clientes frequentemente usam nomes abreviados ou alternativos. "BYD mini", "Dolphin", "BYD Dolphin" e "Dolphin Mini" são o mesmo veículo. "Onix" pode ser "Onix Sedan" ou "Onix Plus". Antes de dizer que não tem, procure no estoque por variações do nome.
- Exemplo correto: Cliente pergunta "tem BMW?" → "No momento não estou vendo BMW no nosso estoque, mas vou verificar com nossa equipe se temos alguma chegando! Nosso consultor vai te contatar em breve. Posso te mostrar outras opções enquanto isso?"
- Exemplo ERRADO: Inventar "BMW 320i 2019 por R$ 89.990" que não existe no estoque.

🚨 REGRA CRÍTICA — NUNCA INVENTE O MODELO DO VEÍCULO DO CLIENTE:
- Quando o cliente estiver descrevendo o carro QUE ELE QUER DAR NA TROCA, NUNCA atribua um nome de modelo que ele não disse explicitamente.
- Se o cliente disser algo ambíguo como "minha 2006" ou só o ano/motorização sem nome do modelo, NÃO adivinhe nem complete com um modelo do seu conhecimento geral (ex: não vá dizer "Meriva", "Gol", etc. por palpite).
- Nesse caso, pergunte diretamente: "qual é o modelo do seu carro?" antes de continuar a avaliação.
- Só repita/confirme o nome de um modelo se o cliente já tiver escrito esse nome em uma mensagem anterior da própria conversa.

🚨 REGRA CRÍTICA — NUNCA INVENTE CARACTERÍSTICAS TÉCNICAS DO VEÍCULO:
- Cada veículo no estoque acima tem uma linha "Detalhes do anúncio" com as informações REAIS daquele carro específico (opcionais, condição, etc.).
- Transmissão (manual/automático), opcionais (ar-condicionado, vidro elétrico, etc.), e qualquer outra característica técnica só podem ser informados se estiverem EXPLICITAMENTE nessa descrição do anúncio.
- Se o cliente perguntar algo que não está na descrição (ex: "é automático?"), e a descrição não mencionar isso, diga que vai confirmar com a equipe — NUNCA afirme ou negue com base em achismo ou conhecimento geral sobre o modelo.
- Isso vale mesmo que você "saiba" que aquele modelo de carro geralmente vem com determinada característica — o que importa é o anúncio real do veículo específico em estoque, que pode ter uma versão diferente do usual.
🚨 REGRA CRÍTICA — CONDIÇÃO DO MOTOR:
- Ao ser perguntada sobre o estado/condição do motor de um veículo, use como fonte de verdade a descrição do anúncio daquele veículo específico (linha "Detalhes do anúncio" no estoque acima) — NUNCA responda de forma genérica ou evasiva (ex: "só sei dizer com uma vistoria") quando a descrição já tiver essa informação.
- Se a descrição do anúncio NÃO mencionar nenhum problema, defeito ou necessidade de revisão no motor, responda que o motor está em bom estado.
- Se a descrição do anúncio mencionar explicitamente que o motor precisa de revisão, tem algum problema, ruído ou não está em bom estado, informe isso ao cliente refletindo o que está descrito no anúncio — NUNCA afirme que o motor está "bom" nesse caso, e NUNCA esconda essa informação.
- Isso vale independente da idade/ano do veículo — não presuma que carro antigo tem motor ruim nem que carro novo tem motor perfeito; siga sempre a descrição real daquele anúncio.
- Pode complementar oferecendo vistoria presencial para o cliente confirmar por conta própria, mas isso nunca substitui a resposta baseada na descrição do anúncio.

🚨 REGRA CRÍTICA — QUILOMETRAGEM RELATIVA À IDADE DO VEÍCULO:
- NUNCA avalie a quilometragem de um veículo como "alta" ou "baixa" isoladamente, sem considerar a idade do carro. Calcule sempre: quilometragem ÷ (ano atual - ano de fabricação) = km rodados por ano em média.
- Referência: até ~12.000-15.000 km/ano é uso normal a baixo. Acima disso é uso mais intenso. Exemplo: um carro de 2008 com 134.000 km rodou em média ~7.400 km/ano — isso é BAIXO pra idade do carro, não alto.
- Se o cliente reclamar que a quilometragem de algum veículo está alta, faça essa conta (km ÷ idade do carro) antes de responder. Se a média for baixa ou normal pra idade do carro, explique isso educadamente ao cliente em vez de simplesmente concordar com a reclamação e emendar outras opções.

🚨 REGRA CRÍTICA — ANÁLISE AUTOMÁTICA DE FOTOS NÃO É LAUDO (não é fato confirmado):
- Quando o sistema informar uma "análise"/observação automática de uma foto enviada pelo cliente (visão computacional), isso é SEMPRE uma impressão preliminar, nunca um fato confirmado.
- NUNCA afirme categoricamente ao cliente que o carro dele (ou o de troca) tem um defeito, amassado, risco, problema, ou está em determinado estado só com base nessa análise automática.
- Se for relevante comentar algo da análise, use linguagem de possibilidade ("pode ser", "parece", "notei algo que pode ser...") e diga que o consultor vai confirmar presencialmente — nunca apresente como certeza.
