    await salvarMensagem(from, "sara", msgFotos);

    const temOutroAssunto = detectarInteresseFinanciamento(text, conversas[from]) || /\btroca\b|\btrocar\b/i.test(text) || text.includes("?");
    if (!temOutroAssunto) return;
    conversas[from].push({ role: "user", content: `[Sistema: a confirmação de envio de fotos já foi feita automaticamente na mensagem anterior. NÃO mencione fotos de novo nem repita essa confirmação. Responda apenas a outra parte da mensagem do cliente (financiamento, troca, preço, ou o que mais ele perguntou).]` });
  }

  if (!coletaCredito[from] && !clientePedindoFotos && detectarInteresseFinanciamento(text, conversas[from])) {
    const veiculoParaFinanciar = encontrarVeiculoNoContexto(text, conversas[from], estoqueAtual);
    coletaCredito[from] = veiculoParaFinanciar
      ? { etapa: "nome", veiculo: `${limparTexto(veiculoParaFinanciar.modelo)} ${veiculoParaFinanciar.ano || ""}`.trim() }
      : { etapa: "aguardando_veiculo" };
    await salvarColetaCreditoPendente(from, coletaCredito[from]);
    const msg = veiculoParaFinanciar
      ? "Posso fazer uma simulação de crédito pra você! 😊 Pra isso preciso de alguns dados rapidinho. Primeiro, qual seu nome completo?"
      : "Posso fazer uma simulação de crédito sim! 😊 Só me confirma antes: qual carro do nosso estoque você quer financiar?";
    conversas[from].push({ role: "assistant", content: msg });
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: from, text: { body: msg } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    await salvarMensagem(from, "sara", msg);
    return;
  }

  await carregarDescontoPendente();
  const clienteTemDescontoPendente = descontoPendente && descontoPendente.telefone === from;
  if (!clienteTemDescontoPendente) {
    const ehDesconto = await processarDesconto(from, text, conversas[from]);
    if (ehDesconto) {
      conversas[from].push({ role: "user", content: `[Sistema: cliente pediu desconto. Já notificamos nosso consultor. Informe que está verificando e continue a conversa normalmente.]` });
    }
  }

  const isSimples = ehMensagemSimples(text);
  const todosTextos = conversas[from].filter(m => m.role === "user").map(m => m.content);
  const { marcaTroca, modeloTroca, anoTroca, modeloBuscado, anoBuscado } = await extrairContextoConversa(todosTextos, isSimples, from);
  const veiculoAtual = await obterVeiculoAtualConversa(from, text, conversas[from]);

  let carroNaoDisponivel = null;
  if (modeloBuscado) {
    const normalizarPalavras = (str) => limparTexto(str || "").toLowerCase().split(/\s+/).filter(p => p.length >= 3 && !/^\d+([.,]\d+)?$/.test(p));
    const palavrasBuscadas = normalizarPalavras(modeloBuscado);
    const encontrado = estoqueAtual.some(v => {
      const modeloEstoque = limparTexto(v.modelo || "").toLowerCase();
      const palavrasEstoque = normalizarPalavras(v.modelo);
      return modeloEstoque.includes(modeloBuscado.toLowerCase()) ||
        modeloBuscado.toLowerCase().includes(modeloEstoque) ||
        palavrasBuscadas.some(p => palavrasEstoque.includes(p));
    });
    if (!encontrado) {
      const descricao = `${modeloBuscado}${anoBuscado ? ` ${anoBuscado}` : ""}`;
      carroNaoDisponivel = descricao;
      const jaNotificou = conversas[from].some(m => m.content?.includes("[Sistema: cliente buscou"));
      if (!jaNotificou) {
        notificarCarroNaoDisponivel(from, descricao, todosTextos.slice(-3).join(" | ")).catch(() => {});
        conversas[from].push({ role: "user", content: `[Sistema: cliente buscou ${descricao} que não está no estoque. Consultor foi notificado. Qualifique o cliente.]` });
        atualizarEstagio(from, "quente", descricao).catch(() => {});
      }
    }
  }

  let veiculosAmbiguos = null;
  if (modeloBuscado) {
    const candidatos = contarVeiculosAmbiguos(modeloBuscado, estoqueAtual);
    if (candidatos.length > 1) veiculosAmbiguos = candidatos;
  }

  let fipeInfo = null;
  let versaoIncerta = null;
  if (marcaTroca && modeloTroca && anoTroca) {
    fipeInfo = await consultarFipe(marcaTroca, modeloTroca, anoTroca);
    if (fipeInfo && fipeInfo._incerto) {
      versaoIncerta = { modelo: modeloTroca, candidatos: fipeInfo._candidatos || [] };
      fipeInfo = null;
    }
  }

  await carregarAvaliacaoPendente();

  if (fipeInfo && !versaoIncerta) {
    const jaTemPendenteMesmoCliente = avaliacaoPendente && avaliacaoPendente.telefone === from;
    const jaAvisouConsultor = conversas[from] && conversas[from].some(m => m.content && m.content.includes("[Sistema: avaliação de troca enviada ao consultor"));
    if (!jaTemPendenteMesmoCliente && !jaAvisouConsultor) {
      const vTroca = calcularValoresTroca(fipeInfo.Valor);
      await salvarAvaliacaoPendente(from, {
        marca: marcaTroca, modelo: modeloTroca, ano: anoTroca,
        modeloFipe: fipeInfo.Modelo, valorFipe: fipeInfo.Valor,
        minimo: vTroca.minimoFormatado, maximo: vTroca.maximoFormatado
      });
      const msgConsultor = `🚗 *Avaliação de troca pendente*\nCliente: ${from}\nCarro do cliente: ${marcaTroca} ${modeloTroca} (${anoTroca})\nModelo usado na FIPE: ${fipeInfo.Modelo}\nValor FIPE: ${fipeInfo.Valor}\nFaixa sugerida (80-85%): R$ ${vTroca.minimoFormatado} a R$ ${vTroca.maximoFormatado}\n\nResponda:\nTROCA [valor] — pra usar esse valor na troca\nDEVOLVER — pra eu perguntar ao cliente quanto ele quer de volta`;
      await enviarTexto(NUMERO_AUGUSTO, msgConsultor);
      const msgEspera = "Deixa eu confirmar uma coisa aqui rapidinho e já te retorno! 😊";
      await enviarTexto(from, msgEspera);
      await salvarMensagem(from, "sara", msgEspera);
      conversas[from].push({ role: "assistant", content: msgEspera });
      conversas[from].push({ role: "user", content: "[Sistema: avaliação de troca enviada ao consultor, aguardando confirmação dele. Não dê nenhum valor de troca até ele responder.]" });
      return;
    }
  }

  fipeInfo = null;

  const aprendizadosExtra = await obterAprendizados();
  const clienteAindaTemPendente = descontoPendente && descontoPendente.telefone === from;

  try {
    const claude = await axios.post("https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: SYSTEM_PROMPT(fipeInfo, aprendizadosExtra, carroNaoDisponivel, clienteAindaTemPendente, veiculosAmbiguos, modeloBuscado, versaoIncerta, veiculoAtual),
        messages: conversas[from].slice(-30)
      },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );

    const replyRaw = claude.data.content[0].text;
    let reply = limparRespostaIA(replyRaw);
    if (!clienteAindaTemPendente) {
      const veiculoDaProposta = encontrarVeiculoNoContexto(text, conversas[from], estoqueAtual);
      const respostaBloqueada = await verificarPropostaForaDoPreco(from, reply, veiculoDaProposta);
      if (respostaBloqueada) reply = respostaBloqueada;
    }
    reply = await bloquearSeParcelaSemSimulacaoReal(from, reply);
    reply = bloquearPromessaEstoqueFuturo(reply);
    reply = bloquearAdjetivoZeradoComKmAlto(reply, todosTextos.join(" "));
    conversas[from].push({ role: "assistant", content: reply });

    const respMeta = await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: from, text: { body: reply } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    const wamidReply = respMeta.data?.messages?.[0]?.id || null;

    console.log(`Resposta para ${from}: ${reply}`);
    await salvarMensagem(from, "sara", reply, wamidReply);
  } catch (e) {
    console.error(`[Resposta principal] Erro ao gerar/enviar resposta para ${from}:`, e.message);
    if (e.response) {
      console.error("Detalhe:", JSON.stringify(e.response.data));
      await notificarFalhaApiClaude(e, `Resposta principal ao cliente (${from})`);
    }
    const tentativas = (tentativasAnteriores || 0) + 1;
    if (tentativas <= MAX_TENTATIVAS_PENDENTE) {
      try {
        await supabase.from("mensagens_pendentes").insert({ telefone: from, texto: text, tentativas });
        console.log(`[Retry] Mensagem de ${from} re-agendada para retry (tentativa ${tentativas}/${MAX_TENTATIVAS_PENDENTE})`);
      } catch (e2) {
        console.error("[Retry] Erro ao salvar pendente:", e2.message);
      }
      if (conversas[from]?.length) conversas[from].pop();
    } else {
      console.error(`[Retry] Desistindo após ${tentativas} tentativas para ${from}`);
    }
  }
}

function agendarFechamentoGrupoFotos(from, caption) {
  const grupo = filaFotos[from];
  if (!grupo) return;
  if (grupo.timer) clearTimeout(grupo.timer);
  grupo.timer = setTimeout(async () => {
    const g = filaFotos[from];
    if (!g) return;
    if (g.pendentes > 0) {
      agendarFechamentoGrupoFotos(from, caption);
      return;
    }
    const analises = [...g.analises];
    delete filaFotos[from];
    if (analises.length > 0) await processarFotosAgrupadas(from, analises);
    else await processarMensagemNaFila(from, `[Cliente enviou foto${caption ? `: ${caption}` : ""}]`);
  }, 3000);
}
async function processarFotosAgrupadas(from, analises) {
  // Bug (06/11): a Sara repassava a "análise" automática de visão computacional como fato
  // garantido (ex: afirmou "amassamento" que o cliente negou). A análise de foto é SEMPRE
  // uma observação preliminar, nunca um laudo — por isso ela entra na conversa já marcada
  // como tal, com instrução explícita de nunca ser repetida ao cliente como certeza.
  const disclaimer = "[Sistema: a 'análise' abaixo é uma observação PRELIMINAR e AUTOMÁTICA de visão computacional sobre a foto — NÃO é um laudo confirmado nem um fato certo. NUNCA repita isso ao cliente como certeza (ex: não diga 'notei um amassado' de forma afirmativa). Se for mencionar algo da análise, deixe claro que é uma impressão inicial sujeita a confirmação do consultor presencialmente, usando linguagem como 'pode ser' ou 'pareceu'. Se o cliente negar/contestar, NÃO insista — peça desculpas, trate como possível erro da análise automática (reflexo, sombra, ângulo) e diga que o consultor vai confirmar pessoalmente. NUNCA use adjetivos absolutos como 'zerado', 'impecável' ou 'perfeito' com base só em foto.]";
  const texto = analises.length === 1
    ? `${disclaimer}\n[Cliente enviou foto. Observação preliminar automática: ${analises[0]}]`
    : `${disclaimer}\n[Cliente enviou ${analises.length} fotos. Observações preliminares automáticas:\n${analises.map((a, i) => `Foto ${i+1}: ${a}`).join("\n")}]`;
  await processarMensagemNaFila(from, texto);
}

app.get("/", (req, res) => res.send(`${NOME_IA} CRM funcionando! ✅`));
app.get("/estoque", (req, res) => res.json({ total: estoqueAtual.length, ultimaAtualizacao, veiculos: estoqueAtual }));
app.get("/sincronizar", async (req, res) => { res.send("Iniciado!"); await sincronizarEstoque(); });
app.get("/testar-supabase", async (req, res) => {
  try {
    const { error } = await supabase.from("mensagens").select("count").limit(1);
    if (error) return res.json({ ok: false, erro: error.message });
    res.json({ ok: true, mensagem: "Supabase conectado!" });
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});
app.get("/diagnostico", async (req, res) => {
  try {
    const { data } = await supabase.from("clientes").select("count").limit(1);
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#fff;font-family:monospace;padding:20px">
<h2 style="color:#f0a500">Diagnóstico ${NOME_IA} CRM</h2>
<p>Supabase: ✅ OK</p>
<p id="r">Testando fetch...</p>
<script>
fetch('${BASE_URL}/crm')
.then(r => { document.getElementById('r').textContent = 'Fetch /crm: ✅ HTTP ' + r.status; return r.json(); })
.then(d => {
const total = Object.values(d).reduce((a,b) => a + b.length, 0);
document.getElementById('r').textContent += ' — ' + total + ' leads carregados ✅';
})
.catch(e => { document.getElementById('r').textContent = 'Fetch ERRO: ' + e.message; });
</script>
</body></html>`);
  } catch(e) { res.send('Erro Supabase: ' + e.message); }
});
app.get("/crm", async (req, res) => {
  try { res.json(await buscarLeadsCRM()); } catch (e) { res.json({}); }
});
app.post("/crm/mover", async (req, res) => {
  const { telefone, estagio } = req.body;
  if (!telefone || !estagio) return res.status(400).json({ erro: "Dados inválidos" });
  try { await atualizarEstagio(telefone, estagio); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get("/followups", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { data: followups } = await supabase.from("followups").select("*").order("criado_em", { ascending: false }).limit(100);
    const lista = followups || [];

    const motivoLabel = { sumiu: "😶 Sumiu", achou_caro: "💰 Achou caro", vai_pensar: "🤔 Vai pensar", sem_interesse: "❌ Sem interesse", visita_nao_confirmada: "📅 Visita não confirmada" };
    const motivoCor = { sumiu: "#64b5f6", achou_caro: "#f0a500", vai_pensar: "#81c784", sem_interesse: "#ef5350", visita_nao_confirmada: "#ce93d8" };

    const agora = new Date();
    const itensHtml = lista.map(f => {
      const numero = String(f.telefone || "").replace(/\D/g, "");
      const formatado = numero.length >= 12 ? `(${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : f.telefone;
      const agendado = f.agendado_para ? new Date(f.agendado_para) : null;
      const venceu = agendado && agendado <= agora;
      const cor = motivoCor[f.motivo] || "#888";
      const labelBase = motivoLabel[f.motivo] || f.motivo;
      const label = (f.motivo === "sumiu" && f.nivel) ? `${labelBase} (nível ${f.nivel})` : labelBase;
      const statusBadge = f.enviado
        ? '<span style="background:#1e3a1e;color:#81c784;padding:2px 8px;border-radius:10px;font-size:10px">✅ Enviado</span>'
        : venceu
        ? '<span style="background:#3a1a1a;color:#ef5350;padding:2px 8px;border-radius:10px;font-size:10px">⚠️ Vencido</span>'
        : '<span style="background:#1a1a2e;color:#64b5f6;padding:2px 8px;border-radius:10px;font-size:10px">⏳ Pendente</span>';

      return `<div style="background:#161616;border:1px solid #222;border-left:3px solid ${cor};border-radius:8px;padding:12px;margin-bottom:10px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
<div>
<a href="/painel/chat/${f.telefone}" style="color:#fff;font-weight:600;font-size:13px;text-decoration:none">${formatado}</a>
${f.veiculo_interesse ? `<span style="color:#f0a500;font-size:11px;margin-left:8px">🚗 ${f.veiculo_interesse}</span>` : ""}
</div>
${statusBadge}
</div>
<div style="font-size:11px;color:${cor};margin-bottom:4px">${label}</div>
<div style="font-size:10px;color:#555">
Agendado: ${agendado ? agendado.toLocaleString("pt-BR") : "—"} |
Criado: ${new Date(f.criado_em).toLocaleString("pt-BR")}
</div>
${!f.enviado ? `
<form action="/followups/disparar" method="POST" style="margin-top:8px;display:flex;gap:6px">
<input type="hidden" name="id" value="${f.id}">
<input type="hidden" name="telefone" value="${f.telefone}">
<input type="hidden" name="veiculo" value="${f.veiculo_interesse || ""}">
<button type="submit" style="background:#f0a500;color:#000;border:none;border-radius:5px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">📤 Disparar agora</button>
</form>` : ""}
</div>`;
    }).join("");

    const veiculosOpts = estoqueAtual.map(v => `<option value="${limparTexto(v.modelo || "")} ${v.ano || ""}">${limparTexto(v.modelo || "")} ${v.ano || ""}</option>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Follow-ups — ${NOME_IA} CRM</title>
<style>body{margin:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0}
header{background:#111;border-bottom:1px solid #222;padding:12px 16px;position:sticky;top:0;display:flex;align-items:center;gap:10px;z-index:10}
</style></head><body>
<header>
<a href="/painel" style="color:#f0a500;text-decoration:none;font-size:20px">←</a>
<h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">📅 Follow-ups</h1>
<button onclick="document.getElementById('form-novo').style.display=document.getElementById('form-novo').style.display==='none'?'block':'none'" style="margin-left:auto;background:#f0a500;color:#000;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">+ Novo</button>
</header>

<div id="form-novo" style="display:none;padding:12px 16px;background:#1a1500;border-bottom:1px solid #f0a500">
<form action="/followups/criar" method="POST" style="display:flex;flex-direction:column;gap:8px">
<input type="text" name="telefone" placeholder="Telefone (ex: 5551999999999)" required style="background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">
<select name="motivo" style="background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">
<option value="sumiu">😶 Sumiu</option>
<option value="achou_caro">💰 Achou caro</option>
<option value="vai_pensar">🤔 Vai pensar</option>
<option value="sem_interesse">❌ Sem interesse</option>
</select>
<select name="veiculo" style="background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">
<option value="">-- Veículo (opcional) --</option>
${veiculosOpts}
</select>
<input type="number" name="dias" value="3" min="1" max="30" placeholder="Dias para disparar" style="background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">
<button type="submit" style="background:#f0a500;color:#000;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Agendar follow-up</button>
</form>
</div>

<div style="padding:14px">
<div style="font-size:11px;color:#555;margin-bottom:10px">${lista.length} follow-up(s) | ${lista.filter(f=>f.enviado).length} enviados | ${lista.filter(f=>!f.enviado).length} pendentes</div>
${itensHtml || '<p style="color:#555;text-align:center;padding:20px">Nenhum follow-up cadastrado ainda</p>'}
</div>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.send(`<html><body style="background:#000;color:#f44;padding:20px">Erro: ${e.message}</body></html>`);
  }
});

app.post("/followups/disparar", async (req, res) => {
  const { id, telefone, veiculo } = req.body;
  try {
    const veiculoTexto = veiculo || "nossos veículos";
    const enviou = await enviarMensagemTemplate(telefone, TEMPLATE_FOLLOWUP, [veiculoTexto]);
    if (enviou) {
      await supabase.from("followups").update({ enviado: true }).eq("id", id);
      console.log(`[FollowUp] ✅ Disparado manualmente: ${telefone}`);
    }
  } catch(e) { console.error("[FollowUp] Erro disparo manual:", e.message); }
  res.redirect("/followups");
});

app.post("/followups/criar", async (req, res) => {
  const { telefone, motivo, veiculo, dias } = req.body;
  if (!telefone || !motivo) return res.redirect("/followups");
  try {
    await agendarFollowUp(telefone, motivo, veiculo || null, parseInt(dias) || 3);
    console.log(`[FollowUp] ✅ Criado manualmente: ${telefone} — ${motivo}`);
  } catch(e) { console.error("[FollowUp] Erro criação manual:", e.message); }
  res.redirect("/followups");
});

app.get("/testar-notificacao", async (req, res) => {
  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: `✅ ${NOME_IA} funcionando!` } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});
app.get("/testar-alerta-api", async (req, res) => {
  try {
    const erroFake = { response: { status: 400, data: { error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits." } } } };
    ultimoAlertaApiFalha = 0;
    await notificarFalhaApiClaude(erroFake, "Teste manual via /testar-alerta-api");
    res.json({ ok: true, mensagem: "Alerta de teste enviado ao WhatsApp do consultor" });
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});
app.get("/painel/pendentes", async (req, res) => {
  try {
    const { data } = await supabase.from("mensagens_pendentes").select("*").order("criado_em", { ascending: false }).limit(50);
    res.json({ pendentes: data || [] });
  } catch (e) { res.json({ pendentes: [], erro: e.message }); }
});
app.get("/testar-retry", async (req, res) => {
  try {
    await processarMensagensPendentes();
    res.json({ ok: true, mensagem: "Job de retry executado manualmente" });
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) res.send(req.query["hub.challenge"]);
  else res.sendStatus(403);
});

const webhookRateLimit = {};
const webhookRateLimitTel = {};
const WEBHOOK_LIMITE_POR_MINUTO = 60;
const WEBHOOK_LIMITE_TEL_POR_MINUTO = 20;

app.post("/webhook", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const agora = Date.now();
  if (!webhookRateLimit[ip]) webhookRateLimit[ip] = { count: 0, reset: agora + 60000 };
  if (agora > webhookRateLimit[ip].reset) webhookRateLimit[ip] = { count: 0, reset: agora + 60000 };
  webhookRateLimit[ip].count++;
  if (webhookRateLimit[ip].count > WEBHOOK_LIMITE_POR_MINUTO) {
    console.error(`[Webhook] Rate limit IP excedido: ${ip}`);
    return res.sendStatus(429);
  }

  const telMsg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  if (telMsg) {
    if (!webhookRateLimitTel[telMsg]) webhookRateLimitTel[telMsg] = { count: 0, reset: agora + 60000 };
    if (agora > webhookRateLimitTel[telMsg].reset) webhookRateLimitTel[telMsg] = { count: 0, reset: agora + 60000 };
    webhookRateLimitTel[telMsg].count++;
    if (webhookRateLimitTel[telMsg].count > WEBHOOK_LIMITE_TEL_POR_MINUTO) {
      console.error(`[Webhook] Rate limit telefone excedido: ${telMsg}`);
      return res.sendStatus(429);
    }
  }

  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature) {
      console.error("[Webhook] Requisição sem assinatura rejeitada");
      return res.sendStatus(403);
    }
    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        console.error("[Webhook] rawBody não disponível — verificar configuração do express.json verify");
        return res.sendStatus(500);
      }
      const expected = "sha256=" + nodeCrypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      if (signature.length !== expected.length) {
        console.error("[Webhook] Tamanho de assinatura diferente — rejeitado");
        return res.sendStatus(403);
      }
      if (!nodeCrypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.error("[Webhook] Assinatura HMAC inválida — possível requisição forjada");
        return res.sendStatus(403);
      }
      console.log("[Webhook] ✅ HMAC válido");
    } catch (e) {
      console.error("[Webhook] Erro na validação HMAC:", e.message);
      return res.sendStatus(403);
    }
  }

  const body = req.body;
  res.sendStatus(200);
  if (body.object === "whatsapp_business_account") {
    const statusEvent = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
    if (statusEvent) {
      const wamid = statusEvent.id;
      const status = statusEvent.status;
      let motivoErro = null;
      if (status === "failed" && statusEvent.errors?.length) {
        motivoErro = statusEvent.errors.map(e => `${e.code}: ${e.title}`).join(" | ");
        console.error(`[StatusEntrega] ❌ Falha em ${wamid}:`, motivoErro);
      }
      atualizarStatusEntrega(wamid, status, motivoErro).catch(() => {});
      return;
    }
    const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;
    const msgId = msg.id;
    if (mensagensProcessadas.has(msgId)) return;
    mensagensProcessadas.add(msgId);
    setTimeout(() => mensagensProcessadas.delete(msgId), 60000);
    let from = msg.from;
    if (from && from.startsWith("55") && from.length === 12) {
      from = "55" + from.slice(2, 4) + "9" + from.slice(4);
    }
    const referral = msg.referral;
    let textoReferral = null;
    if (referral) {
      const headline = referral.headline || "";
      const body = referral.body || "";
      const fonte = referral.source_type === "ad" ? "anúncio patrocinado" : "publicação";
      const resumoReferral = `${fonte}${headline ? `: "${headline}"` : ""}${body ? ` — ${body}` : ""}`;
      textoReferral = `[Sistema: este cliente chegou via ${fonte} do Instagram/Facebook. ` +
        (headline ? `Título do anúncio: "${headline}". ` : "") +
        (body ? `Descrição: "${body}". ` : "") +
        `Use essas informações para identificar qual veículo do estoque corresponde a esse anúncio e já mencione ele na sua resposta, sem precisar perguntar qual carro o cliente viu.]`;
      console.log(`[Referral] Anúncio detectado de ${from}: ${headline || body || "sem título"}`);
      try {
        await supabase.from("clientes").upsert({ telefone: from, anuncio_referral: resumoReferral }, { onConflict: "telefone" });
      } catch (e) { console.error("[Referral] Erro ao salvar:", e.message); }
    }
    try {
      if (msg.type === "text") {
        const text = msg.text?.body;
        if (!text) return;
        console.log(`Texto de ${from}: ${text}`);
        if (textoReferral) {
          if (!conversas[from]) {
            const msgsExistentesReferral = await buscarMensagens(from);
            conversas[from] = msgsExistentesReferral.length > 0
              ? msgsExistentesReferral.slice(-20).map(m => ({ role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant", content: m.texto || "" }))
              : [];
          }
          if (conversas[from].length === 0) {
            conversas[from].push({ role: "user", content: textoReferral });
            await salvarMensagem(from, "sistema", textoReferral);
          }
        }
        await processarMensagemNaFila(from, text);
      } else if (msg.type === "audio") {
        const texto = await transcreverAudio(msg.audio.id);
        if (texto) await processarMensagemNaFila(from, `[Áudio]: ${texto}`);
        else await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: "Não consegui entender o áudio. Pode digitar?" } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
      } else if (msg.type === "image") {
        const caption = msg.image?.caption || "";
        if (!filaFotos[from]) filaFotos[from] = { analises: [], pendentes: 0, timer: null };
        filaFotos[from].pendentes++;
        const mediaId = msg.image.id;
        const mimeType = msg.image.mime_type || "image/jpeg";
        try {
          const mediaRes = await axios.get(`https://graph.facebook.com/v25.0/${mediaId}`, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
          const urlTemporaria = mediaRes.data?.url || null;
          const urlPermanente = urlTemporaria ? await arquivarFotoCliente(urlTemporaria, mediaId, mimeType) : null;
          await salvarMensagem(from, "client_foto", JSON.stringify({ mediaId, url: urlPermanente || urlTemporaria, arquivada: !!urlPermanente, caption, mimeType }));
        } catch (e) {
          await salvarMensagem(from, "client_foto", JSON.stringify({ mediaId, url: null, caption, mimeType }));
        }
        const analise = await analisarImagem(mediaId, caption, from);
        if (!filaFotos[from]) filaFotos[from] = { analises: [], pendentes: 0, timer: null };
        if (analise) filaFotos[from].analises.push(analise);
        filaFotos[from].pendentes = Math.max(0, (filaFotos[from].pendentes || 1) - 1);
        agendarFechamentoGrupoFotos(from, caption);
      }
    } catch (e) {
      console.error("Erro:", e.message);
      if (e.response) console.error("Detalhe:", JSON.stringify(e.response.data));
    }
  }
});

app.get("/registrar", async (req, res) => {
  try {
    const result = await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/register`,
      { messaging_product: "whatsapp", pin: process.env.WHATSAPP_REGISTER_PIN || "123456" },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    res.send("Registrado! " + JSON.stringify(result.data));
  } catch (e) { res.send("Erro: " + JSON.stringify(e.response?.data)); }
});

app.get("/painel", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const kanban = await buscarLeadsCRM();
    const pendente = descontoPendente;
    let alertasPendentesCount = 0;
    try {
      const { count } = await supabase.from("alertas_pendentes").select("id", { count: "exact" }).eq("visualizado", false);
      alertasPendentesCount = count || 0;
    } catch (e) { }
    const estagios = [
      {id:'quente', label:'🔥 Quente', cor:'#ff6b35'},
      {id:'negociacao', label:'💬 Negociação', cor:'#f0a500'},
      {id:'aguardando', label:'⏳ Aguardando', cor:'#64b5f6'},
      {id:'visita_agendada', label:'📅 Visita', cor:'#81c784'},
      {id:'frio', label:'❄️ Frio', cor:'#90a4ae'},
      {id:'vendido', label:'✅ Vendido', cor:'#4caf50'},
      {id:'perdido', label:'❌ Perdido', cor:'#78716c'}
    ];
    let totalLeads = 0;
    estagios.forEach(e => { if (kanban[e.id]) totalLeads += kanban[e.id].length; });

    let colunasHtml = '';
    estagios.forEach(est => {
      const cards = kanban[est.id] || [];
      let cardsHtml = cards.length === 0
        ? '<p style="color:#444;font-size:11px;text-align:center;padding:10px">Vazio</p>'
        : cards.map(c => {
          const tel = String(c.telefone || '');
          const msg = String(c.ultimaMensagem || '').substring(0, 60);
          const vei = String(c.veiculo || '');
          const opcoesEstagio = estagios.map(e2 =>
            '<option value="' + e2.id + '"' + (e2.id === est.id ? ' selected' : '') + '>' + e2.label + '</option>'
          ).join('');
          const textoBusca = (tel + ' ' + vei + ' ' + msg).toLowerCase().replace(/"/g, '');
          return '<div class="lead-card" data-tel="' + tel + '" data-busca="' + textoBusca + '" style="background:#161616;border:1px solid #222;border-radius:8px;padding:10px;margin-bottom:8px">' +
            '<div style="font-size:13px;font-weight:600;color:#fff">' + (c.formatado || tel) + '</div>' +
            (vei ? '<div style="font-size:11px;color:#f0a500;margin-top:3px">🚗 ' + vei + '</div>' : '') +
            '<div style="font-size:11px;color:#555;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + msg + '</div>' +
            '<div style="font-size:10px;color:#444;margin-top:3px">' + (c.tempoLabel || '') + '</div>' +
            '<div style="margin-top:8px;display:flex;gap:6px;align-items:center">' +
            '<a href="/painel/chat/' + tel + '" style="background:#1e2a1e;color:#81c784;padding:4px 10px;border-radius:5px;font-size:11px;text-decoration:none">💬 Chat</a>' +
            '<select onchange="moverLead(\'' + tel + '\', this.value, \'' + est.id + '\')" style="background:#1a1a1a;color:#ccc;border:1px solid #2a2a2a;border-radius:5px;font-size:11px;padding:3px 4px;flex:1">' + opcoesEstagio + '</select>' +
            '</div></div>';
        }).join('');

      colunasHtml += '<div class="lead-coluna" data-estagio="' + est.id + '" style="min-width:220px;max-width:220px;background:#111;border-radius:10px;border-top:2px solid ' + est.cor + ';flex-shrink:0">' +
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:11px;font-weight:700;text-transform:uppercase;color:' + est.cor + '">' + est.label + '</span>' +
        '<span class="lead-contagem" style="font-size:11px;background:#1e1e1e;padding:1px 7px;border-radius:8px;color:#888">' + cards.length + '</span>' +
        '</div>' +
        '<div class="lead-cards" style="padding:8px;max-height:65vh;overflow-y:auto">' + cardsHtml + '</div>' +
        '</div>';
    });

    const html = '<!DOCTYPE html><html lang="pt-BR"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<title>${NOME_IA} CRM</title>` +
      '<style>body{margin:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0}' +
      'a{color:inherit}header{background:#111;border-bottom:1px solid #222;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0}' +
      '.dot{width:8px;height:8px;background:#4caf50;border-radius:50%;display:inline-block;margin-right:6px;animation:p 2s infinite}' +
      '@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}' +
      '.badge{background:#f0a500;color:#000;font-size:10px;padding:2px 7px;border-radius:8px;margin-left:6px;font-weight:700}' +
      '.board{display:flex;gap:12px;padding:14px;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '</style></head><body>' +
      '<header>' +
      `<h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">${NOME_IA} <span style="color:#f0a500">CRM</span>` +
      (pendente ? '<span class="badge">💰 1 desconto</span>' : '') +
      (alertasPendentesCount > 0 ? '<span class="badge" style="background:#f44336">⚠️ ' + alertasPendentesCount + ' alerta(s)</span>' : '') + '</h1>' +
      '<div style="font-size:12px;color:#888"><span class="dot"></span>' + totalLeads + ' leads</div>' +
      '</header>' +
      '<div style="padding:10px 16px;background:#0f0f0f;border-bottom:1px solid #1a1a1a;display:flex;gap:10px;align-items:center">' +
      '<a href="/painel" style="color:#f0a500;font-size:12px;font-weight:600;text-decoration:none">📋 Pipeline</a>' +
      '<a href="/painel/lista" style="color:#888;font-size:12px;text-decoration:none">💬 Conversas</a>' +
      '<a href="/followups" style="color:#888;font-size:12px;text-decoration:none">📅 Follow-ups</a>' +
      '<a href="/painel/simulacao-manual" style="color:#888;font-size:12px;text-decoration:none">💳 Simulações</a>' +
      (alertasPendentesCount > 0 ? '<a href="/painel/alertas" style="color:#f44336;font-size:12px;font-weight:600;text-decoration:none">⚠️ Alertas (' + alertasPendentesCount + ')</a>' : '') +
      '<button onclick="document.getElementById(\'form-novo-contato\').style.display=document.getElementById(\'form-novo-contato\').style.display===\'none\'?\'flex\':\'none\'" style="margin-left:auto;background:#f0a500;color:#000;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">➕ Novo contato</button>' +
      '</div>' +
      '<div id="form-novo-contato" style="display:none;padding:10px 16px;background:#1a1500;border-bottom:1px solid #f0a500;gap:8px;flex-direction:column">' +
      '<div style="font-size:11px;color:#f0a500;font-weight:700">Iniciar conversa manualmente</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<input type="text" id="novo-tel" placeholder="Telefone (ex: 5551999999999)" style="flex:1;min-width:160px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      '<select id="novo-template" style="flex:1;min-width:140px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      estoqueAtual.map(v => `<option value="${limparTexto(v.modelo||'')} ${v.ano||''}">${limparTexto(v.modelo||'')} ${v.ano||''}</option>`).join('') +
      '</select>' +
      '<button onclick="iniciarContato()" style="background:#f0a500;color:#000;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer">Enviar template</button>' +
      '</div>' +
      '</div>' +
      '<div style="padding:10px 16px;background:#0f0f0f;border-bottom:1px solid #1a1a1a">' +
      '<input type="text" id="busca-crm" placeholder="🔎 Buscar por telefone, veículo ou mensagem (ex: foto, argo, 9355...)" ' +
      'oninput="filtrarLeads(this.value)" style="width:100%;box-sizing:border-box;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:7px;color:#fff;padding:8px 10px;font-size:13px">' +
      '</div>' +
      '<div class="board">' + colunasHtml + '</div>' +
      '<script>' +
      'function iniciarContato() {' +
      ' const tel = document.getElementById("novo-tel").value.replace(/\\D/g,"");' +
      ' const veiculo = document.getElementById("novo-template").value;' +
      ' if (!tel || tel.length < 10) { alert("Digite um telefone válido"); return; }' +
      ' fetch("/painel/iniciar-contato", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: tel, veiculo }) })' +
      ' .then(r => r.json())' +
      ' .then(d => { if (d.ok) { alert("Template enviado com sucesso!"); document.getElementById("novo-tel").value = ""; } else alert("Erro: " + (d.erro||"falha no envio")); })' +
      ' .catch(() => alert("Erro de conexão"));' +
      '}' +
      'function atualizarContagens() {' +
      ' document.querySelectorAll(".lead-coluna").forEach(function(col) {' +
      ' var contagem = col.querySelector(".lead-contagem");' +
      ' if (contagem) contagem.textContent = col.querySelectorAll(".lead-card").length;' +
      ' });' +
      '}' +
      'function moverLead(tel, novoEstagio, estagioAtual) {' +
      ' fetch("/crm/mover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: tel, estagio: novoEstagio }) })' +
      ' .then(r => r.json())' +
      ' .then(d => {' +
      ' if (!d.ok) { alert("Erro ao mover lead"); return; }' +
      ' var card = document.querySelector(\'.lead-card[data-tel="\' + tel + \'"]\');' +
      ' var colDestino = document.querySelector(\'.lead-coluna[data-estagio="\' + novoEstagio + \'"] .lead-cards\');' +
      ' if (!card || !colDestino) { location.reload(); return; }' +
      ' var vazio = colDestino.querySelector("p");' +
      ' if (vazio) vazio.remove();' +
      ' colDestino.insertBefore(card, colDestino.firstChild);' +
      ' atualizarContagens();' +
      ' })' +
      ' .catch(() => alert("Erro de conexão ao mover lead"));' +
      '}' +
      'function filtrarLeads(termo) {' +
      ' var t = termo.toLowerCase().trim();' +
      ' var cards = document.querySelectorAll(".lead-card");' +
      ' cards.forEach(function(card) {' +
      ' var bate = !t || (card.getAttribute("data-busca") || "").indexOf(t) !== -1;' +
      ' card.style.display = bate ? "" : "none";' +
      ' });' +
      ' var colunas = document.querySelectorAll(".lead-coluna");' +
      ' colunas.forEach(function(col) {' +
      ' var visiveis = col.querySelectorAll(".lead-card:not([style*=\\"display: none\\"])").length;' +
      ' var contagem = col.querySelector(".lead-contagem");' +
      ' if (contagem) contagem.textContent = t ? visiveis : col.querySelectorAll(".lead-card").length;' +
      ' });' +
      '}' +
      '</script>' +
      '</body></html>';

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.send('<html><body style="background:#000;color:#f44;padding:20px;font-family:monospace">Erro: ' + e.message + '</body></html>');
  }
});

app.get("/painel/alertas", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { data } = await supabase.from("alertas_pendentes").select("*").order("criado_em", { ascending: false }).limit(100);
    const alertas = data || [];
    let itensHtml = alertas.map(a => {
      const texto = String(a.texto || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      const hora = a.criado_em ? new Date(a.criado_em).toLocaleString('pt-BR') : '';
      return '<div style="background:' + (a.visualizado ? '#161616' : '#2a1a00') + ';border:1px solid ' + (a.visualizado ? '#222' : '#f0a500') + ';border-radius:8px;padding:12px;margin-bottom:10px">' +
        '<div style="font-size:13px;color:#ddd;line-height:1.5">' + texto + '</div>' +
        '<div style="font-size:10px;color:#666;margin-top:6px">' + hora + '</div>' +
        (!a.visualizado ? '<button onclick="marcarVisto(' + a.id + ', this)" style="margin-top:8px;background:#f0a500;color:#000;border:none;border-radius:5px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">✓ Marcar como visto</button>' : '<span style="font-size:11px;color:#4caf50">✓ Visto</span>') +
        '</div>';
    }).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alertas pendentes — ${NOME_IA} CRM</title>` +
      '<style>body{margin:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0}a{color:inherit}' +
      'header{background:#111;border-bottom:1px solid #222;padding:12px 16px;position:sticky;top:0;display:flex;align-items:center;gap:10px}</style></head><body>' +
      '<header><a href="/painel" style="color:#f0a500;text-decoration:none;font-size:20px">←</a><h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">⚠️ Alertas pendentes</h1></header>' +
      '<div style="padding:14px">' +
      `<p style="font-size:12px;color:#888;margin-top:0">Notificações que não puderam ser enviadas ao seu WhatsApp porque fazia mais de 24h que você não escrevia para o número da ${NOME_IA}. Mande qualquer mensagem para o número da ${NOME_IA} para reabrir a janela.</p>` +
      (itensHtml || '<p style="color:#555;text-align:center;padding:20px">Nenhum alerta pendente 🎉</p>') +
      '</div>' +
      '<script>' +
      'function marcarVisto(id, btn) {' +
      ' fetch("/painel/alertas/visto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })' +
      ' .then(r => r.json()).then(d => { if (d.ok) location.reload(); });' +
      '}' +
      '</script>' +
      '</body></html>';

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.send('<html><body style="background:#000;color:#f44;padding:20px">Erro: ' + e.message + '</body></html>');
  }
});
app.post("/registrar-mensagem", async (req, res) => {
  try {
