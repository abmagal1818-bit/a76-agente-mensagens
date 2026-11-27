  }
}

async function carregarAvaliacaoPendente() {
  if (avaliacaoPendente) return avaliacaoPendente;
  try {
    const { data } = await supabase.from("avaliacoes_pendentes").select("*").limit(1);
    if (data && data.length > 0) {
      avaliacaoPendente = {
        telefone: data[0].telefone,
        info: typeof data[0].info === "string" ? JSON.parse(data[0].info) : data[0].info,
        timestamp: new Date(data[0].criado_em || Date.now()).getTime()
      };
    }
  } catch (e) {
    console.error("[Avaliação] Erro ao carregar persistência:", e.message);
  }
  return avaliacaoPendente;
}

async function salvarDescontoPendente(telefone, info) {
  descontoPendente = { telefone, info, timestamp: Date.now() };
  try {
    await supabase.from("descontos_pendentes").delete().neq("telefone", "");
    await supabase.from("descontos_pendentes").insert({ telefone, info: JSON.stringify(info) });
  } catch (e) {
    console.error("[Desconto] Erro ao persistir (tabela pode não existir ainda):", e.message);
  }
}

async function limparDescontoPendente() {
  descontoPendente = null;
  try {
    await supabase.from("descontos_pendentes").delete().neq("telefone", "");
  } catch (e) {
    console.error("[Desconto] Erro ao limpar persistência:", e.message);
  }
}

async function carregarDescontoPendente() {
  if (descontoPendente) return descontoPendente;
  try {
    const { data } = await supabase.from("descontos_pendentes").select("*").limit(1);
    if (data && data.length > 0) {
      descontoPendente = {
        telefone: data[0].telefone,
        info: typeof data[0].info === "string" ? JSON.parse(data[0].info) : data[0].info,
        timestamp: new Date(data[0].criado_em || Date.now()).getTime()
      };
      console.log(`[Desconto] Recuperado da persistência: ${descontoPendente.telefone}`);
    }
  } catch (e) {
  }
  return descontoPendente;
}

async function processarDesconto(from, texto, historicoConversa) {
  await carregarDescontoPendente();
  if (descontoPendente && descontoPendente.telefone === from) return false;
  if (!detectarPedidoDesconto(texto)) return false;

  console.log(`[Desconto] Detectado pedido de ${from}: "${texto}"`);

  try {
    const historico = (historicoConversa || []).slice(-10).map(m => m.content || "").join(" | ");
    const res = await axios.post("https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Extraia do texto: veículo, preço original, preço solicitado e forma de pagamento.
Responda APENAS JSON: {"veiculo": "...", "preco_original": "...", "preco_solicitado": "...", "pagamento": "..."}
Use null para campos não encontrados.
Contexto: ${historico}
Texto atual: "${texto}"`
        }]
      },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );
    const jsonMatch = res.data.content[0].text.trim().match(/\{[\s\S]+\}/);
    const info = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    await salvarDescontoPendente(from, info);

    const numero = from.replace(/\D/g, "");
    const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
    const msgConsultor = `💰 *Pedido de desconto*
Cliente: ${formatado}
${info.veiculo ? `Veículo: *${info.veiculo}*` : ""}
${info.preco_original ? `Preço original: ${info.preco_original}` : ""}
${info.preco_solicitado ? `Cliente pede: *${info.preco_solicitado}*` : ""}
${info.pagamento ? `Pagamento: ${info.pagamento}` : ""}

Responda:
✅ *AUTORIZO* — para autorizar
❌ *NEGO* — para negar`;

    const respostaMeta = await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msgConsultor } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`[Desconto] ✅ Consultor notificado. Resposta Meta:`, JSON.stringify(respostaMeta.data));
    return true;
  } catch (e) {
    console.error("[Desconto] Erro:", e.message);
    if (e.response) await notificarFalhaApiClaude(e, `Extração de pedido de desconto (${from})`);
    return false;
  }
}

function extrairPropostaFinanceira(texto) {
  if (!texto) return null;
  const t = texto.replace(/ /g, " ");
  const parseValor = (s) => {
    if (!s) return null;
    const limpo = String(s).replace(/[Rr]\$\s*/g, "").trim();
    const n = Number(limpo.replace(/\./g, "").replace(",", "."));
    return isNaN(n) || n <= 0 ? null : n;
  };
  const entradaMatch = t.match(/r\$\s*([\d.,]+)\s*(?:de\s+)?entrada/i) || t.match(/entrada\s*(?:de\s*)?r\$\s*([\d.,]+)/i);
  const parcelaMatch = t.match(/(\d{1,3})\s*promiss[óo]rias?\s*de\s*r\$\s*([\d.,]+)/i) || t.match(/(\d{1,3})\s*x\s*(?:de\s*)?r\$\s*([\d.,]+)/i);
  const totalMatch = t.match(/total[^\d]{0,10}r\$\s*([\d.,]+)/i) || t.match(/r\$\s*([\d.,]+)\s*(?:no\s+)?total/i) || t.match(/fica(?:ria)?\s+em\s+r\$\s*([\d.,]+)/i);
  if (entradaMatch || parcelaMatch) {
    const entrada = entradaMatch ? parseValor(entradaMatch[1]) : 0;
    let totalParcelas = 0;
    if (parcelaMatch) {
      const qtd = Number(parcelaMatch[1]);
      const valorParcela = parseValor(parcelaMatch[2]);
      if (!isNaN(qtd) && valorParcela) totalParcelas = qtd * valorParcela;
    }
    const total = (entrada || 0) + totalParcelas;
    if (!total) return null;
    return { entrada: entrada || 0, totalParcelas, total };
  }
  if (totalMatch) {
    const total = parseValor(totalMatch[1]);
    if (!total) return null;
    return { entrada: 0, totalParcelas: 0, total };
  }
  return null;
}

async function verificarPropostaForaDoPreco(from, reply, veiculo) {
  if (!veiculo || !veiculo.preco) return null;
  const proposta = extrairPropostaFinanceira(reply);
  if (!proposta) return null;
  const precoTabela = Number(veiculo.preco);
  if (!precoTabela) return null;
  const diff = Math.abs(proposta.total - precoTabela);
  if (diff <= 20) return null;

  console.log(`[PropostaForaDoPreco] ${from}: proposta R$ ${proposta.total} vs tabela R$ ${precoTabela}`);

  const info = {
    veiculo: veiculo.modelo || null,
    preco_original: precoTabela,
    preco_solicitado: proposta.total,
    pagamento: `entrada R$ ${proposta.entrada} + parcelas R$ ${proposta.totalParcelas}`,
    origem: "ajuste_automatico_sara"
  };
  await salvarDescontoPendente(from, info);

  const numero = from.replace(/\D/g, "");
  const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
  const msgConsultor = `⚠️ *Proposta fora do preco de tabela*
Cliente: ${formatado}
Veiculo: *${info.veiculo || "nao identificado"}*
Preco de tabela: R$ ${precoTabela}
${NOME_IA} ia confirmar: *R$ ${proposta.total}* (${info.pagamento})

A ${NOME_IA} NAO enviou essa condicao ao cliente — esta aguardando sua decisao.
Responda:
✅ *AUTORIZO* — para autorizar
❌ *NEGO* — para negar`;

  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msgConsultor } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[PropostaForaDoPreco] Erro ao notificar consultor:", e.message);
  }

  return "Deixa eu confirmar essa condicao com nossa equipe rapidinho e ja te retorno! 😊";
}

async function extrairContextoConversa(textos, ehSimples = false, from = null) {
  if (ehSimples) return { marcaTroca: null, modeloTroca: null, anoTroca: null, modeloBuscado: null, anoBuscado: null };
  const textoRecente = textos.slice(-3).join(" ").toLowerCase();
  const cache = from ? cacheContextoConversa[from] : null;
  if (cache && !textoRecente.match(/\b(troca|trocar|vender|meu carro|minha|modelo|ano|[12][09]\d{2})\b/i)) {
    return cache;
  }
  try {
    const res = await axios.post("https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Analise essa conversa e extraia DUAS informações em JSON:
1. Veículo que cliente quer VENDER/TROCAR
2. Veículo que cliente quer COMPRAR/PROCURAR

Responda APENAS JSON:
{"troca": {"marca": null, "modelo": null, "ano": null}, "busca": {"modelo": null, "ano": null}}

Texto: "${textos.slice(-5).join(" | ")}"`
        }]
      },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );
    const jsonMatch = res.data.content[0].text.trim().match(/\{[\s\S]+\}/);
    if (!jsonMatch) return { marcaTroca: null, modeloTroca: null, anoTroca: null, modeloBuscado: null, anoBuscado: null };
    const json = JSON.parse(jsonMatch[0]);
    const resultado = {
      marcaTroca: json.troca?.marca || null,
      modeloTroca: json.troca?.modelo || null,
      anoTroca: json.troca?.ano || null,
      modeloBuscado: json.busca?.modelo || null,
      anoBuscado: json.busca?.ano || null
    };
    if (from) cacheContextoConversa[from] = resultado;
    return resultado;
  } catch (e) {
    if (e.response) await notificarFalhaApiClaude(e, "Extração de contexto da conversa");
    return { marcaTroca: null, modeloTroca: null, anoTroca: null, modeloBuscado: null, anoBuscado: null };
  }
}

async function salvarMensagem(telefone, tipo, texto, wamid = null) {
  try {
    console.log(`[Supabase] Salvando: ${telefone} | ${tipo}`);
    const tiposSemTruncamento = ["sara_fotos", "client_foto"];
    const ehAnaliseFotosCliente = tipo === "client" && typeof texto === "string" && texto.startsWith("[Cliente enviou");
    const textoFinal = (tiposSemTruncamento.includes(tipo) || ehAnaliseFotosCliente) ? String(texto) : String(texto).substring(0, 500);
    const { data, error } = await supabase.from("mensagens").insert({
      telefone, tipo, texto: textoFinal, wamid, status_entrega: wamid ? "enviado" : null
    }).select("id").single();
    if (error) console.error("[Supabase] ❌ Erro insert:", error.message);
    else console.log(`[Supabase] ✅ Salvo: ${telefone} | ${tipo}`);
    const { error: e2 } = await supabase.from("clientes").upsert({
      telefone, ultima_interacao: new Date().toISOString()
    }, { onConflict: "telefone" });
    if (e2) console.error("[Supabase] ❌ Erro upsert:", e2.message);
    return data?.id || null;
  } catch (e) { console.error("[Supabase] ❌ Exceção:", e.message); return null; }
}

async function atualizarStatusEntrega(wamid, novoStatus, motivoErro = null) {
  try {
    const update = { status_entrega: novoStatus };
    if (motivoErro) update.motivo_erro = motivoErro;
    const { error } = await supabase.from("mensagens").update(update).eq("wamid", wamid);
    if (error) console.error("[StatusEntrega] Erro ao atualizar:", error.message);
    else console.log(`[StatusEntrega] ✅ ${wamid} → ${novoStatus}`);
  } catch (e) { console.error("[StatusEntrega] Exceção:", e.message); }
}

async function buscarMensagens(telefone) {
  try {
    const { data } = await supabase.from("mensagens").select("*").eq("telefone", telefone).order("criado_em", { ascending: false }).limit(100);
    return (data || []).reverse();
  } catch (e) { return []; }
}

async function listarConversas() {
  try {
    const { data } = await supabase.from("mensagens").select("telefone, texto, tipo, criado_em").order("criado_em", { ascending: false });
    if (!data) return [];
    const mapa = {};
    data.forEach(m => {
      if (!mapa[m.telefone]) {
        mapa[m.telefone] = { from: m.telefone, ultimaMensagem: m.texto?.substring(0, 50) || "", ultimaAtividade: m.criado_em, naoLida: 0 };
      }
      if (m.tipo === "client") {
        const visualizadoEm = conversasVisualizadas[m.telefone] || 0;
        if (new Date(m.criado_em).getTime() > visualizadoEm) mapa[m.telefone].naoLida++;
      }
    });
    return Object.values(mapa).sort((a, b) => new Date(b.ultimaAtividade) - new Date(a.ultimaAtividade));
  } catch (e) { return []; }
}

async function atualizarEstagio(telefone, estagio, veiculo = null) {
  try {
    const update = { telefone, estagio, ultima_interacao: new Date().toISOString() };
    if (veiculo) update.veiculo_interesse = String(veiculo).slice(0, 100);
    const { error } = await supabase.from("clientes").upsert(update, { onConflict: "telefone" });
    if (!error) console.log(`[CRM] ${telefone} → ${estagio}`);
  } catch (e) { console.error("[CRM] Erro:", e.message); }
}

function temNegacaoAntes(texto, termo) {
  const idx = texto.indexOf(termo);
  if (idx === -1) return false;
  const antes = texto.slice(Math.max(0, idx - 20), idx);
  return /\b(não|nao|nunca|jamais|nem)\b/.test(antes);
}

async function notificarMudancaEstagioAutomatica(from, estagio, gatilho) {
  // Marcação automática por palavra-chave é sempre um palpite, não uma certeza —
  // registra um alerta pro consultor confirmar/corrigir em vez de confiar 100% no keyword match.
  try {
    await supabase.from("alertas_pendentes").insert({
      texto: `🏷️ Lead ${from} movido automaticamente para "${estagio}" (gatilho detectado: "${gatilho}"). Confira no painel se está certo.`
    });
  } catch (e) { console.error("[CRM] Erro ao registrar alerta de mudança automática:", e.message); }
}

async function detectarEstagio(from, text, historico, ehRetry = false) {
  const t = text.toLowerCase();
  const hist = (historico || []).map(m => m.content || "").join(" ").toLowerCase();

  // "já comprei" sozinho é ambíguo (pode ser "já comprei [aqui/de vocês]" — venda ganha —
  // tanto quanto "já comprei [em outro lugar]" — venda perdida). Removido daqui; só conta
  // como "perdido" quando vem com um qualificador explícito de "em outro lugar".
  const fraseComprouEmOutroLugar = ["comprei em outro lugar", "comprei outro carro", "fechei com outra loja", "já comprei em outro lugar", "já comprei outro carro", "acabei comprando outro"];
  const fraseComprouAqui = ["fechei", "comprei", "vou comprar", "vou fechar", "topo fechar", "bater o martelo", "pode fazer o contrato"];

  // Mensagens reprocessadas pela fila de retry (mensagens_pendentes) podem ser textos antigos
  // sendo reexecutados sem gerar uma nova linha em `mensagens` — não são sinal confiável o
  // suficiente pra uma decisão de alto impacto e pouco reversível como vendido/perdido.
  // Detectado em 2026-09-09: reprocessamento no boot marcou 4 leads dormentes como "perdido"
  // e 1 como "vendido" sem nenhuma mensagem nova correspondente.
  if (!ehRetry) {
    if (fraseComprouEmOutroLugar.some(f => t.includes(f))) {
      await atualizarEstagio(from, "perdido");
      await notificarMudancaEstagioAutomatica(from, "perdido", fraseComprouEmOutroLugar.find(f => t.includes(f)));
      return;
    }
    // Reforço (06/11): uma pergunta ("posso fechar?", "topa fechar por X?") não é uma
    // confirmação real de venda — só conta como "vendido" uma afirmação, não uma pergunta.
    const gatilhoFechou = !t.includes("?") && fraseComprouAqui.find(f => t.includes(f) && !temNegacaoAntes(t, f));
    if (gatilhoFechou) {
      await atualizarEstagio(from, "vendido");
      await notificarMudancaEstagioAutomatica(from, "vendido", gatilhoFechou);
      return;
    }
  }
  const frasesVisitaConfirmada = ["vou aí", "vou até", "passo aí", "apareço", "vou na loja", "vou ir", "vou visitar", "amanhã às", "amanha as", "pode ser às", "pode ser as"];
  const termoVisitaEncontrado = frasesVisitaConfirmada.find(f => t.includes(f));
  // Reforço (06/11): regex/checagem mais rígida — não basta conter a frase; não pode haver
  // negação antes ("não vou aí hoje") nem incerteza ("talvez", "se der", "quem sabe", "não sei se").
  const temIncertezaVisita = /\b(talvez|quem sabe|se der|se puder|se conseguir|não sei se|nao sei se)\b/.test(t);
  if (termoVisitaEncontrado && !temNegacaoAntes(t, termoVisitaEncontrado) && !temIncertezaVisita) {
    const { data: clienteAtual } = await supabase.from("clientes").select("estagio").eq("telefone", from).limit(1);
    const jaEraVisita = clienteAtual?.[0]?.estagio === "visita_agendada";
    await atualizarEstagio(from, "visita_agendada");
    if (!jaEraVisita) {
      const numero = from.replace(/\D/g, "");
      const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : from;
      const veiculo = hist.match(/asx|corolla|compass|tracker|renegade|hilux|jetta|civic|hb20|polo|onix|creta|tucson|evoque|ranger|s10|pajero|outlander|cobalt|voyage/i)?.[0] || "veículo";
      const msg = `📅 *Visita agendada!*\nCliente: ${formatado}\nVeículo de interesse: *${veiculo.toUpperCase()}*\n\nO cliente confirmou que vai vir à loja. Fique de olho! 😊`;
      try {
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        console.log(`[Visita] ✅ Notificado sobre visita de ${from}`);
      } catch(e) { console.error("[Visita] Erro notificação:", e.message); }
      await agendarFollowUpHoras(from, "visita_nao_confirmada", veiculo, 2);
    }
    return;
  }
  if (hist.includes("parcela") || hist.includes("simulação") || hist.includes("financiar") || hist.includes("na troca") || hist.includes("fotos")) { await atualizarEstagio(from, "negociacao"); return; }
  if (t.includes("não tenho interesse") || t.includes("desisti") || t.includes("esquece")) { await atualizarEstagio(from, "frio"); return; }
  if (t.includes("vou pensar") || t.includes("vou falar") || t.includes("vou consultar") || t.includes("retorno")) { await atualizarEstagio(from, "aguardando"); return; }
  const { data } = await supabase.from("clientes").select("estagio").eq("telefone", from).limit(1);
  const estagioAtual = data?.[0]?.estagio;
  if (!estagioAtual || estagioAtual === "frio") await atualizarEstagio(from, "quente");
}

async function buscarLeadsCRM() {
  try {
    const { data: clientes } = await supabase.from("clientes").select("*").order("ultima_interacao", { ascending: false });
    const { data: mensagens } = await supabase.from("mensagens").select("telefone, texto, tipo, criado_em").order("criado_em", { ascending: false });
    if (!clientes) return {};
    const ultimaMsg = {};
    if (mensagens) mensagens.forEach(m => { if (!ultimaMsg[m.telefone]) ultimaMsg[m.telefone] = m; });
    const kanban = { quente: [], negociacao: [], aguardando: [], visita_agendada: [], frio: [], vendido: [], perdido: [] };
    clientes.forEach(c => {
      const estagio = c.estagio || "quente";
      const agora = Date.now();
      const ultimaAtividade = c.ultima_interacao ? new Date(c.ultima_interacao).getTime() : agora;
      const minutosAtras = Math.floor((agora - ultimaAtividade) / 60000);
      const horasAtras = Math.floor(minutosAtras / 60);
      const diasAtras = Math.floor(horasAtras / 24);
      const tempoLabel = diasAtras > 0 ? `${diasAtras}d atrás` : horasAtras > 0 ? `${horasAtras}h atrás` : `${minutosAtras}min atrás`;
      const numero = c.telefone.replace(/\D/g, "");
      const formatado = numero.length >= 12 ? `(${numero.slice(2, 4)}) ${numero.slice(4, 9)}-${numero.slice(9)}` : c.telefone;
      const card = { telefone: c.telefone, formatado, estagio, veiculo: c.veiculo_interesse || "", ultimaMensagem: ultimaMsg[c.telefone]?.texto?.substring(0, 60) || "", tempoLabel, ultimaAtividade: c.ultima_interacao };
      if (kanban[estagio]) kanban[estagio].push(card);
      else kanban.quente.push(card);
    });
    return kanban;
  } catch (e) { console.error("[CRM] Erro:", e.message); return {}; }
}

async function salvarAprendizado(situacao, correcao) {
  try {
    await supabase.from("aprendizados").insert({ situacao, correcao });
    ultimoCarregamentoAprendizados = 0;
  } catch (e) { console.error("[Supabase] Erro aprendizado:", e.message); }
}

async function buscarAprendizados() {
  try {
    const { data } = await supabase.from("aprendizados").select("*").order("criado_em", { ascending: false }).limit(20);
    return data || [];
  } catch (e) { return []; }
}

async function agendarFollowUp(telefone, motivo, veiculoInteresse, diasAguardar, nivel = 1) {
  try {
    const { data: clienteOptOut } = await supabase.from("clientes").select("opt_out_reativacao").eq("telefone", telefone).limit(1);
    if (clienteOptOut?.[0]?.opt_out_reativacao) {
      console.log(`[FollowUp] Não agendado (cliente em opt-out): ${telefone} — ${motivo}`);
      return;
    }
    const agendadoPara = new Date();
    agendadoPara.setDate(agendadoPara.getDate() + diasAguardar);
    await supabase.from("followups").update({ enviado: true }).eq("telefone", telefone).eq("enviado", false).eq("motivo", motivo);
    const { error } = await supabase.from("followups").insert({
      telefone, motivo, veiculo_interesse: veiculoInteresse,
      agendado_para: agendadoPara.toISOString(), enviado: false, nivel
    });
    if (!error) console.log(`[FollowUp] Agendado: ${telefone} em ${diasAguardar}d — ${motivo} (nível ${nivel})`);
    else console.error(`[FollowUp] Erro ao agendar (coluna "nivel" existe na tabela followups?):`, error.message);
  } catch (e) { console.error("[FollowUp] Erro:", e.message); }
}

async function agendarFollowUpHoras(telefone, motivo, veiculoInteresse, horasAguardar) {
  try {
    const { data: clienteOptOutHoras } = await supabase.from("clientes").select("opt_out_reativacao").eq("telefone", telefone).limit(1);
    if (clienteOptOutHoras?.[0]?.opt_out_reativacao) {
      console.log(`[FollowUp] Não agendado (cliente em opt-out): ${telefone} — ${motivo}`);
      return;
    }
    const agendadoPara = new Date();
    agendadoPara.setHours(agendadoPara.getHours() + horasAguardar);
    await supabase.from("followups").update({ enviado: true }).eq("telefone", telefone).eq("enviado", false).eq("motivo", motivo);
    const { error } = await supabase.from("followups").insert({
      telefone, motivo, veiculo_interesse: veiculoInteresse,
      agendado_para: agendadoPara.toISOString(), enviado: false
    });
    if (!error) console.log(`[FollowUp] Agendado: ${telefone} em ${horasAguardar}h — ${motivo}`);
  } catch (e) { console.error("[FollowUp] Erro:", e.message); }
}

async function detectarLeadFrio(from, text, historicoConversa) {
  try {
    const t = text.toLowerCase();
    const historico = (historicoConversa || []).slice(-10).map(m => m.content || "").join(" ").toLowerCase();
    let motivo = null, dias = 1;
    const frasesPensar = ["vou pensar", "preciso pensar", "deixa eu pensar", "vou ver", "vou decidir", "vou falar com minha esposa", "vou falar com meu marido", "vou consultar", "vou falar com a família", "retorno em breve", "depois te aviso", "vou dar um retorno", "vou retornar", "depois eu volto", "vou conversar com"];
    if (frasesPensar.some(f => t.includes(f))) { motivo = "vai_pensar"; dias = 1; }
    const frasesCaro = ["tá caro", "está caro", "muito caro", "caro demais", "não tenho condição", "não tenho dinheiro", "sem condição", "tá pesado", "fora do meu orçamento", "não cabe no bolso", "não tenho esse valor", "não consigo", "não tenho como"];
    if (!motivo && frasesCaro.some(f => t.includes(f))) { motivo = "achou_caro"; dias = 3; }
    const frasesAvaliacao = ["avaliação baixa", "pouco pelo meu", "esperava mais", "vale mais", "não compensa", "achei pouco", "muito pouco"];
    if (!motivo && frasesAvaliacao.some(f => t.includes(f))) { motivo = "avaliacao_baixa"; dias = 5; }
    const frasesSemInteresse = ["não tenho interesse", "desisti", "não quero mais", "mudei de ideia", "cancelar", "esquece", "deixa pra lá"];
    if (!motivo && frasesSemInteresse.some(f => t.includes(f))) { motivo = "sem_interesse"; dias = 7; }
    if (!motivo) return;
    const vm = historico.match(/\b(?:evoque|jetta|compass|corolla|civic|tracker|creta|tucson|renegade|hilux|ranger|voyage|gol|onix|polo|hb20|argo|sandero|kwid|cerato|cobalt|palio|asx|yaris|mobi|virtus|captur|tcross|t-cross|strada|s10|duster|kicks|spin|ecosport|fox|up|saveiro|montana|tiguan|bmw|mercedes|audi|honda|toyota|hyundai|kia|nissan|fiat|chevrolet|volkswagen|ford|renault|peugeot|citroen|mitsubishi|land rover|jeep|byd|dolphin mini|dolphin|haval|caoa chery|chery|jac|great wall|volvo|porsche|lexus|jaguar|ram|dodge)\b/i);
    await agendarFollowUp(from, motivo, vm ? vm[0] : null, dias);
  } catch (e) { console.error("[FollowUp] Erro:", e.message); }
}

async function verificarClientesSumidos() {
  try {
    const agora = Date.now();
    for (const [telefone, ultima] of Object.entries(ultimaMensagemCliente)) {
      if (agora - ultima > 24 * 60 * 60 * 1000) {
        const { data } = await supabase.from("followups").select("id").eq("telefone", telefone).eq("enviado", false).limit(1);
        if (!data?.length) {
          const hist = (conversas[telefone] || []).map(m => m.content || "").join(" ").toLowerCase();
          const vm = hist.match(/\b(?:evoque|jetta|compass|corolla|civic|tracker|creta|tucson|renegade|hilux|ranger|voyage|gol|onix|polo|hb20|argo|sandero|kwid|cerato|cobalt|palio|asx|yaris|mobi|virtus|captur|tcross|t-cross|strada|s10|duster|kicks|spin|ecosport|fox|up|saveiro|montana|tiguan|bmw|mercedes|audi|honda|toyota|hyundai|kia|nissan|fiat|chevrolet|volkswagen|ford|renault|peugeot|citroen|mitsubishi|land rover|jeep|byd|dolphin mini|dolphin|haval|caoa chery|chery|jac|great wall|volvo|porsche|lexus|jaguar|ram|dodge)\b/i);
          let veiculoInteresse = vm ? vm[0] : null;
          if (!veiculoInteresse) {
            const { data: cli } = await supabase.from("clientes").select("veiculo_interesse").eq("telefone", telefone).limit(1);
            veiculoInteresse = cli?.[0]?.veiculo_interesse || null;
          }
          await agendarFollowUp(telefone, "sumiu", veiculoInteresse, 2, 1);
          await atualizarEstagio(telefone, "frio");
        }
        try { await supabase.from("clientes").upsert({ telefone, ultima_mensagem_cliente: new Date(ultima).toISOString() }, { onConflict: "telefone" }); } catch (e) {}
        delete ultimaMensagemCliente[telefone];
      }
    }
    const limite24h = new Date(agora - 24 * 60 * 60 * 1000).toISOString();
    const { data: clientesSumidosBanco } = await supabase
      .from("clientes")
      .select("telefone, ultima_mensagem_cliente, veiculo_interesse, estagio")
      .lt("ultima_mensagem_cliente", limite24h)
      .not("estagio", "in", '("vendido","perdido","frio")')
      .limit(20);
    if (clientesSumidosBanco?.length) {
      for (const cli of clientesSumidosBanco) {
        const { data: jaTemFollowup } = await supabase.from("followups").select("id").eq("telefone", cli.telefone).eq("enviado", false).limit(1);
        if (!jaTemFollowup?.length) {
          await agendarFollowUp(cli.telefone, "sumiu", cli.veiculo_interesse, 2, 1);
          await atualizarEstagio(cli.telefone, "frio");
          console.log(`[FollowUp] Agendado (recuperado do banco): ${cli.telefone}`);
        }
        try { await supabase.from("clientes").update({ ultima_mensagem_cliente: null }).eq("telefone", cli.telefone); } catch (e) {}
      }
    }
  } catch (e) { console.error("[FollowUp] Erro sumidos:", e.message); }
}

setInterval(verificarClientesSumidos, 60 * 60 * 1000);

const TEMPLATE_FOLLOWUP = process.env.TEMPLATE_FOLLOWUP_NAME || "followup_generico";

const DIAS_PROXIMO_NIVEL = { 1: 2, 2: 3 };
const NIVEL_MAXIMO_REATIVACAO = 3;

// --- Reaplicação de correções anteriores (06/11) ---------------------------------------

// Janela em que a Sara fica em modo silencioso depois de um consultor intervir manualmente
// numa conversa (via /painel/enviar, /painel/template ou /painel/intervencao), pra evitar
// que a resposta automática contradiga ou atropele o que o humano já disse.
const JANELA_INTERVENCAO_MANUAL_MS = 3 * 60 * 60 * 1000; // 3 horas

// Marca no Supabase (coluna `clientes.intervencao_manual_em`, timestamptz) o momento em que
// um consultor humano respondeu manualmente a esse cliente. Se a coluna ainda não existir,
// falha silenciosamente (mesmo padrão defensivo usado no resto do arquivo) sem travar o envio.
async function marcarIntervencaoManual(telefone) {
  try {
    await supabase.from("clientes").upsert({ telefone, intervencao_manual_em: new Date().toISOString() }, { onConflict: "telefone" });
  } catch (e) { console.error("[IntervençãoManual] Erro ao marcar flag (coluna intervencao_manual_em existe na tabela clientes?):", e.message); }
}

// Bug: a Sara insistia em qualificar/vender pra contatos que avisaram ser número errado/engano.
function clienteIndicouNumeroErrado(texto) {
  const t = (texto || "").toLowerCase();
  const padroes = ["numero errado", "número errado", "num errado", "errei o numero", "errei o número",
    "discagem errada", "quem é você", "quem e voce", "quem fala", "não te conheço", "nao te conheco",
    "não conheço vocês", "nao conheco voces", "mensagem errada", "pessoa errada", "contato errado"];
  return padroes.some(p => t.includes(p));
}

// Bug: a régua de reativação (follow-ups automáticos de "sumiu") não tinha opt-out — o
// cliente não tinha como pedir pra parar de receber esses contatos automáticos.
function clienteSolicitouOptOutReativacao(texto) {
  const t = (texto || "").toLowerCase();
  const padroes = ["não quero mais receber", "nao quero mais receber", "pare de mandar", "pare de enviar",
    "para de mandar", "para de enviar", "para de me mandar", "me tira da lista", "me tire da lista",
    "não me manda mais", "nao me manda mais", "remove meu numero", "remova meu número",
    "cancelar inscrição", "cancelar inscricao", "não manda mais mensagem", "nao manda mais mensagem"];
  return padroes.some(p => t.includes(p));
}

// Persiste o opt-out (coluna `clientes.opt_out_reativacao`, boolean) e cancela qualquer
// follow-up automático já agendado pra esse telefone.
async function registrarOptOutReativacao(telefone) {
  try {
    await supabase.from("clientes").upsert({ telefone, opt_out_reativacao: true }, { onConflict: "telefone" });
    await supabase.from("followups").update({ enviado: true }).eq("telefone", telefone).eq("enviado", false);
    console.log(`[OptOut] ${telefone} removido da régua de reativação`);
  } catch (e) { console.error("[OptOut] Erro ao registrar opt-out (coluna opt_out_reativacao existe na tabela clientes?):", e.message); }
}

// Bug: quando o cliente recusava explicitamente passar CPF/dados pra simulação de crédito,
// a Sara continuava insistindo em pedir o documento de novo, em loop.
function clienteRecusouDadosFinanceiros(texto) {
  const t = (texto || "").toLowerCase();
  const padroes = ["não quero dar", "nao quero dar", "não vou passar", "nao vou passar",
    "prefiro não passar", "prefiro nao passar", "não vou informar", "nao vou informar",
    "não quero informar", "nao quero informar", "não vou fornecer", "nao vou fornecer",
    "não confio", "nao confio", "não me sinto confortável", "nao me sinto confortavel",
    "não vou dar meus dados", "nao vou dar meus dados", "prefiro não dar", "prefiro nao dar",
    "não quero passar meus dados", "nao quero passar meus dados", "sem meus dados"];
  return padroes.some(p => t.includes(p));
}


async function enviarMensagemTemplate(telefone, nomeTemplate, parametros = []) {
  try {
    const components = parametros.length > 0 ? [{
      type: "body",
      parameters: parametros.map(p => ({ type: "text", text: String(p).slice(0, 100) }))
    }] : [];
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: telefone,
        type: "template",
        template: {
          name: nomeTemplate,
          language: { code: "pt_BR" },
          components
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    return true;
  } catch (e) {
    console.error(`[Template] Erro ao enviar "${nomeTemplate}":`, e.response?.data ? JSON.stringify(e.response.data) : e.message);
    return false;
  }
}

async function gerarMensagemFollowUp(followup) {
  try {
    const veiculo = followup.veiculo_interesse || "nossos veículos";
    const nivel = followup.nivel || 1;
    const promptsSumiu = {
      1: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente parou de responder sobre ${veiculo} há poucos dias. Mensagem curta e leve para retomar, sem cobrar. Máximo 2 linhas.`,
      2: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente sumiu depois de demonstrar interesse no ${veiculo}. Mencione que o carro ainda está disponível e pergunte se ainda tem interesse. Máximo 3 linhas.`,
      3: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Última tentativa de retomar contato sobre o ${veiculo} — cliente sumiu há mais de uma semana. Pergunte de forma direta e educada se ainda tem interesse, para não insistir mais se não tiver. Máximo 2 linhas.`
    };
    const prompts = {
      vai_pensar: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente interessado em ${veiculo} disse que ia pensar. Mensagem curta e calorosa, sem pressionar. Máximo 3 linhas.`,
      achou_caro: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente achou ${veiculo} caro. Pergunte qual parcela cabe no orçamento. Máximo 3 linhas.`,
      avaliacao_baixa: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente insatisfeito com avaliação na troca. Reforce que avaliação presencial pode surpreender. Máximo 3 linhas.`,
      sem_interesse: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. Cliente sem interesse. Mensagem muito leve. Máximo 2 linhas.`,
      sumiu: promptsSumiu[nivel] || promptsSumiu[1],
      visita_nao_confirmada: `Você é ${NOME_IA}, vendedora da ${NOME_EMPRESA}. O cliente tinha agendado uma visita pra loja sobre o ${veiculo} mas não temos confirmação de que ele veio. Mensagem tipo "Verifiquei que não conseguiu comparecer no horário agendado. Gostaria de reagendar?" — natural, sem cobrar, sugerindo reagendar pra mais tarde ou outro dia. Máximo 3 linhas.`
    };
    const instrucaoFormato = "\n\nIMPORTANTE: responda APENAS com o texto puro da mensagem que sera enviada direto pro cliente no WhatsApp. NAO inclua titulo, cabecalho (nada de \"# Mensagem...\"), marcacao markdown, comentarios explicando a abordagem, nem mais de uma opcao/alternativa de mensagem. So a mensagem final, pronta pra mandar, nada antes nem depois dela.";
    const res = await axios.post("https://api.anthropic.com/v1/messages",
      { model: "claude-haiku-4-5", max_tokens: 150, messages: [{ role: "user", content: (prompts[followup.motivo] || prompts.vai_pensar) + (followup.veiculo_interesse ? "" : "\n\nIMPORTANTE: nao sabemos qual veiculo especifico e o de interesse do cliente. NAO cite nem invente nenhuma marca ou modelo de carro por nome - fale de forma generica (\"nossos veiculos\", \"o carro que voce viu\").") + instrucaoFormato }] },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );
    return limparMensagemFollowUp(res.data.content[0].text);
  } catch (e) {
    if (e.response) await notificarFalhaApiClaude(e, `Geração de mensagem de follow-up (${followup.telefone})`);
    return null;
  }
}

function limparMensagemFollowUp(texto) {
  if (!texto) return texto;
  let t = String(texto).trim();
  // remove cabecalho markdown tipo "# Mensagem..." ou "# Mensagem de ${NOME_IA} - ${NOME_EMPRESA}" na primeira linha
  t = t.replace(/^#{1,3}\s*mensagem[^\n]*\n+/i, "").trim();
  // se o modelo mandou mais de uma opcao separada por "---", fica só com a primeira
  const partesSeparador = t.split(/\n\s*-{3,}\s*\n/);
  if (partesSeparador.length > 1) t = partesSeparador[0].trim();
  // remove marcador de alternativa tipo "*Ou uma alternativa mais leve:*" seguido de texto, se sobrou algo assim sozinho
  t = t.replace(/\*[^*\n]*alternativa[^*\n]*\*\s*$/i, "").trim();
  // remove aspas envolvendo a mensagem inteira
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\u201c') && t.endsWith('\u201d'))) {
    t = t.slice(1, -1).trim();
  }
  // remove comentario meta solto no final tipo "*Curta, leve, sem pressão...*"
  t = t.replace(/\n+\*[^*\n]+\*\s*$/, "").trim();
  return t;
}

async function processarFollowUpsPendentes() {
  try {
    const { data: followups } = await supabase.from("followups").select("*").eq("enviado", false).lte("agendado_para", new Date().toISOString());
    if (!followups?.length) return;
    for (const followup of followups) {
      if (followup.motivo === "visita_nao_confirmada") {
        const { data: clienteAtual } = await supabase.from("clientes").select("estagio").eq("telefone", followup.telefone).limit(1);
        if (clienteAtual?.[0]?.estagio !== "visita_agendada") {
          await supabase.from("followups").update({ enviado: true }).eq("id", followup.id);
          console.log(`[FollowUp] Cancelado (estágio mudou): ${followup.telefone}`);
          continue;
        }
      }
      if (followup.motivo === "sumiu") {
        const { data: clienteAtualSumiu } = await supabase.from("clientes").select("estagio, ultima_mensagem_cliente").eq("telefone", followup.telefone).limit(1);
        const cliSumiu = clienteAtualSumiu?.[0];
        const respondeuDepois = cliSumiu?.ultima_mensagem_cliente && followup.criado_em &&
          new Date(cliSumiu.ultima_mensagem_cliente).getTime() > new Date(followup.criado_em).getTime();
        if (cliSumiu?.estagio !== "frio" || respondeuDepois) {
          await supabase.from("followups").update({ enviado: true }).eq("id", followup.id);
          console.log(`[FollowUp] Cancelado (cliente respondeu): ${followup.telefone}`);
          continue;
        }
      }

      if (followup.veiculo_interesse && !veiculoAindaEstaDisponivel(followup.veiculo_interesse)) {
        await supabase.from("followups").update({ enviado: true }).eq("id", followup.id);
        console.log(`[FollowUp] Cancelado (veiculo vendido/saiu do estoque): ${followup.telefone} — ${followup.veiculo_interesse}`);
        notificarFollowUpVeiculoVendido(followup.telefone, followup.veiculo_interesse).catch(() => {});
        continue;
      }

      // Revalidação geral de estágio (cobre todos os motivos de follow-up, não só
      // "visita_nao_confirmada" e "sumiu" como antes): não envia se o cliente já respondeu
      // depois de agendado, já saiu do funil (vendido/perdido), pediu opt-out da régua de
      // reativação, ou está sob intervenção manual recente de um consultor humano.
      const { data: clienteRevalidacao } = await supabase.from("clientes").select("estagio, ultima_mensagem_cliente, opt_out_reativacao, intervencao_manual_em").eq("telefone", followup.telefone).limit(1);
      const cliRevalidacao = clienteRevalidacao?.[0];
      const respondeuDepoisGeral = cliRevalidacao?.ultima_mensagem_cliente && followup.criado_em &&
        new Date(cliRevalidacao.ultima_mensagem_cliente).getTime() > new Date(followup.criado_em).getTime();
      const estagiosQueCancelamFollowUp = ["vendido", "perdido"];
      const emIntervencaoManualRecente = cliRevalidacao?.intervencao_manual_em &&
        (Date.now() - new Date(cliRevalidacao.intervencao_manual_em).getTime()) < JANELA_INTERVENCAO_MANUAL_MS;
      if (respondeuDepoisGeral || estagiosQueCancelamFollowUp.includes(cliRevalidacao?.estagio) || cliRevalidacao?.opt_out_reativacao || emIntervencaoManualRecente) {
        await supabase.from("followups").update({ enviado: true }).eq("id", followup.id);
        console.log(`[FollowUp] Cancelado (revalidação geral de estágio - motivo ${followup.motivo}): ${followup.telefone}`);
        continue;
      }

      const mensagem = await gerarMensagemFollowUp(followup);
      if (!mensagem) continue;
      try {
        if (!estaNoHorarioComercial()) {
          console.log(`[FollowUp] Adiado (fora do horário comercial): ${followup.telefone}`);
          continue;
        }
        const veiculo = followup.veiculo_interesse || "nossos veículos";
        const enviouTemplate = await enviarMensagemTemplate(followup.telefone, TEMPLATE_FOLLOWUP, [veiculo]);

        if (!enviouTemplate) {
          console.log(`[FollowUp] Template falhou, tentando texto livre para ${followup.telefone}`);
          await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
            { messaging_product: "whatsapp", to: followup.telefone, text: { body: mensagem } },
            { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
          );
        }

