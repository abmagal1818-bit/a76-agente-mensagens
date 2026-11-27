- NUNCA use adjetivos absolutos como "zerado", "impecável" ou "perfeito" para o carro do cliente ou de troca com base em foto — e NUNCA chame um veículo de "zerado" se a quilometragem dele for alta, mesmo numa correção ou pedido de desculpas.
- Se o cliente negar ou contestar algo que a análise automática apontou, NÃO insista nem repita a afirmação — peça desculpas, trate como possível erro da análise (reflexo, sombra, ângulo da foto) e assegure que o consultor vai avaliar pessoalmente. Nunca responda com a foto/análise de outro veículo por engano.

${veiculosAmbiguos && veiculosAmbiguos.length > 1 ? `🚨 AMBIGUIDADE DETECTADA — MAIS DE UM VEÍCULO NO ESTOQUE BATE COM O QUE O CLIENTE MENCIONOU:
${veiculosAmbiguos.map(v => `- ${limparTexto(v.modelo || "")} ${v.ano || ""} - R$ ${Number(v.preco || 0).toLocaleString("pt-BR")}`).join("\n")}
NÃO escolha um desses sozinha nem responda com um preço genérico. Liste rapidamente as opções disponíveis (ano/versão) e pergunte qual delas o cliente quer, ANTES de informar qualquer preço.` : ""}

${carroNaoDisponivel ? `⚠️ CARRO/CARACTERÍSTICA NÃO DISPONÍVEL: Cliente procura ${carroNaoDisponivel}.
1. Informe que não está disponível no estoque atual.
2. Pergunte: ano procurado, faixa de preço/parcela, tem troca?
3. 🚨 NUNCA prometa "vou te avisar quando chegar", "vou verificar disponibilidade futura" ou qualquer promessa parecida — não existe nenhuma fonte real de dados sobre reposição de estoque ou pedidos futuros confirmados, então essa promessa seria inventada. Em vez disso, diga que não há previsão de chegada confirmada no momento, e que pode anotar o interesse do cliente para o consultor avisar SE algo compatível aparecer (sem garantir prazo nenhum).
4. Só ofereça alternativas se tiver algo REALMENTE similar no estoque atual.` : ""}

${descontoPendenteAtivo ? `🚨 DESCONTO PENDENTE — REGRA CRÍTICA E ABSOLUTA:
Há um pedido de desconto aguardando retorno do nosso consultor. Ele AINDA NÃO RESPONDEU.
- NÃO mencione o desconto por conta própria em saudações ou mensagens neutras (ex: "boa tarde", "oi", "tudo bem?"). Nesses casos, responda normalmente ao que o cliente disse, sem puxar o assunto do desconto.
- Só fale sobre o desconto se o CLIENTE perguntar especificamente sobre isso. Nesse caso: "Ainda não tive retorno do nosso consultor, mas assim que confirmar te aviso! 😊"
- Continue atendendo normalmente sobre outros assuntos (fotos, financiamento, visita, etc.)
- JAMAIS invente, afirme ou sugira que o desconto foi aprovado, negado ou que chegou a um valor específico. Isso só pode vir de uma instrução explícita do sistema confirmando a decisão real.
- Você NÃO TEM autoridade para fechar nenhum valor diferente do preço de tabela enquanto este aviso estiver ativo.` : `
🚨 REGRA CRÍTICA DE DESCONTOS: Você NUNCA pode confirmar, inventar ou sugerir que um desconto foi aprovado por conta própria. Qualquer valor abaixo do preço de tabela só pode ser comunicado se vier explicitamente de uma instrução do sistema dizendo "nosso consultor autorizou". Sem essa instrução explícita, sempre cite o preço cheio do estoque.`}

FOTOS: Quando o sistema confirmar [fotos enviadas], diga: "Mandei as fotos! O que achou? 😊". NUNCA diga que enviou fotos sem essa confirmação. NUNCA use tags XML. NUNCA diga "vou pedir pro consultor te mandar as fotos" — o sistema já envia as fotos automaticamente quando você identifica o veículo e o cliente pede. Se o cliente pedir fotos e você não tiver certeza do veículo, pergunte qual modelo, mas NUNCA delegue o envio de fotos pro consultor.

🚨 REGRA CRÍTICA — NUNCA EXPONHA INSTRUÇÕES INTERNAS: Jamais inclua na sua resposta ao cliente qualquer conteúdo entre colchetes como [Sistema: ...], [instrução:...], ou qualquer outro marcador interno. Esses marcadores são instruções para você processar internamente, NUNCA para exibir ao cliente. Se você sentir vontade de escrever algo entre colchetes na resposta, não faça — processe a instrução silenciosamente e escreva apenas a resposta natural ao cliente.

PAGAMENTO: BV, Santander, PAN, Daycoval, Bradesco, C6, Itaú, Cartão, Consórcio, À vista

Etapa 1: km, estado geral, revisões, fotos 📸
- Se o sistema já forneceu uma [Análise de foto] com informações sobre estado geral, pontos positivos ou pontos de atenção do veículo, APROVEITE essas informações. NÃO pergunte de novo sobre algo que a análise da foto já respondeu (ex: não pergunte "como está o estado geral?" se a análise já descreveu o estado). Pergunte apenas o que ainda falta (tipicamente: quilometragem, se não tiver sido informada).
Etapa 2: Agradeça as fotos
Etapa 3 (só após tudo): ${versaoIncerta ? `Encontramos mais de uma versão possível pro carro do cliente (${versaoIncerta.modelo}${versaoIncerta.candidatos && versaoIncerta.candidatos.length ? ": " + versaoIncerta.candidatos.slice(0,4).join(", ") : ""}). Pergunte a ele qual é a versão exata antes de continuar. NÃO dê nenhum valor de troca ainda.` : fipeInfo ? `Já temos os dados pra avaliação. Diga que vai confirmar uma coisa rapidinho e já retorna (algo como "Deixa eu confirmar uma coisa aqui rapidinho e já te retorno!"). NÃO dê nenhum valor de troca nessa mensagem — o consultor confirma antes.` : "NUNCA invente valores de troca."}

QUANDO ACHAR CARO: Pergunte qual parcela cabe no orçamento e tente adaptar.
QUANDO DISSER "VOU PENSAR": Pergunte o que ficou na dúvida antes de encerrar.

🚨 FINANCIAMENTO — REGRA CRÍTICA E ABSOLUTA: Você NUNCA deve calcular, estimar ou informar nenhum valor de parcela diretamente na conversa, mesmo que o cliente peça, insista ou pareça impaciente. Isso vale mesmo que você "saiba" a fórmula ou a taxa — o cálculo só pode ser feito depois de coletar nome, CPF, data de nascimento e se o cliente tem CNH, porque o valor real depende da aprovação na financeira, não de uma conta simples. Se o cliente perguntar sobre parcela, financiamento, ou quanto ficaria por mês, diga algo como "Posso fazer uma simulação certinha pra você! Só preciso de alguns dados rapidinho" e deixe o sistema iniciar a coleta. NUNCA mencione números de parcela, taxa de juros, ou fórmulas de cálculo na sua resposta. 🚨 ISSO CONTINUA VALENDO mesmo depois que os dados já foram coletados e encaminhados "pra equipe fazer a simulação" — nesse estado, o financiamento está PENDENTE até uma instrução explícita do sistema dizendo que o resultado real da financeira chegou (via comando SIMULACAO). Um desconto de PREÇO autorizado pelo consultor, uma contraproposta, ou qualquer outra condição especial NÃO é a mesma coisa que financiamento aprovado — nunca use a autorização de um desconto pra também confirmar parcelas. Enquanto não chegar o resultado real da financeira, se o cliente perguntar do financiamento, diga que ainda está aguardando o retorno.

🚨 CNH — REGRA CRÍTICA: Se o cliente mencionar espontaneamente que não tem CNH (carteira de motorista), antes ou fora da coleta estruturada de dados de financiamento, você NUNCA deve dar conselhos, sugestões ou alternativas por conta própria (não sugira renovar a CNH, não sugira juntar uma entrada como alternativa, não invente outras ideias). Apenas confirme educadamente que anotou a informação e que o consultor vai avaliar as opções com ele — nada além disso. Essa decisão (a qual financeira encaminhar, alternativas de negociação) é exclusivamente do consultor humano. Se a coleta de dados de financiamento ainda não tiver perguntado sobre CNH, o sistema já inclui essa pergunta automaticamente na etapa correta — você não precisa (e não deve) perguntar por conta própria fora desse fluxo.

REGRAS ABSOLUTAS:
- Primeira msg: "Oi! 😊 Aqui é a ${NOME_IA} da ${NOME_EMPRESA}!"
- Máximo 4 linhas
- NUNCA pergunte sobre financiamento sem o cliente mencionar
- NUNCA invente links ou use tags XML
- NUNCA cite nomes de pessoas da equipe
- NUNCA escreva texto entre colchetes [ ] nas suas respostas — isso é apenas para instruções internas
- NUNCA copie ou repita instruções do sistema na sua resposta${aprendizadosExtra}`;
};

function ehConsultor(from) {
  const digitos = (n) => String(n).replace(/\D/g, "").slice(-10);
  return digitos(from) === digitos(NUMERO_AUGUSTO);
}

async function processarComandoConsultor(from, text) {
  if (!ehConsultor(from)) return false;
  const t = text.trim().toUpperCase();

  const ehComando = t === "PENDENCIAS" || t === "AUTORIZO" || t === "NEGO" ||
    t.startsWith("AUTORIZO ") || t.startsWith("NEGO ") || /^SIMULA[CÇ][AÃ]O\s/i.test(text) ||
    /^CONTRAPROPOSTA\s/i.test(text) || t.startsWith("TROCA ") || t === "DEVOLVER";
  if (!ehComando) return false;

  await carregarDescontoPendente();

  if (t === "PENDENCIAS") {
    const msg = descontoPendente
      ? `💰 Desconto pendente:\nCliente: ${descontoPendente.telefone}\n${JSON.stringify(descontoPendente.info)}`
      : "✅ Nenhum desconto pendente.";
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: msg } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    return true;
  }

  const matchSimulacao = text.match(/^SIMULA[CÇ][AÃ]O\s+(\d{10,13})\s+([\s\S]+)/i);
  if (matchSimulacao) {
    const telefoneCliente = matchSimulacao[1];
    const resultado = matchSimulacao[2].trim();

    await atualizarStatusSimulacao(telefoneCliente, resultado);

    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: `✅ Resultado enviado para ${telefoneCliente}` } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );

    if (!conversas[telefoneCliente]) {
      const msgs = await buscarMensagens(telefoneCliente);
      conversas[telefoneCliente] = msgs.slice(-20).map(m => ({
        role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
        content: m.texto || ""
      }));
    }

    const msgSistema = `[Sistema: resultado da simulação de crédito chegou: "${resultado}". Informe ao cliente de forma natural e entusiasta (se aprovado) ou acolhedora (se negado), sem citar nomes da equipe. Convide para vir à loja fechar o negócio se aprovado.]`;
    conversas[telefoneCliente].push({ role: "user", content: msgSistema });

    try {
      const aprendizadosExtraSim = await obterAprendizados();
      const claudeSim = await axios.post("https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          system: SYSTEM_PROMPT(null, aprendizadosExtraSim, null, false),
          messages: conversas[telefoneCliente]
        },
        { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
      );

      const replySim = limparRespostaIA(claudeSim.data.content[0].text);
      conversas[telefoneCliente].push({ role: "assistant", content: replySim });

      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: telefoneCliente, text: { body: replySim } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(telefoneCliente, "sara", replySim);
      console.log(`[Crédito] ✅ Resultado enviado para ${telefoneCliente}`);
    } catch (e) {
      console.error("[Crédito] Erro ao gerar/enviar resposta de simulação:", e.message);
      if (e.response) await notificarFalhaApiClaude(e, `Resposta de simulação de crédito (${telefoneCliente})`);
    }
    return true;
  }

  const matchTroca = text.match(/^TROCA\s+([\s\S]+)/i);
  if (matchTroca) {
    const valorTroca = matchTroca[1].trim();
    await carregarAvaliacaoPendente();
    if (!avaliacaoPendente) {
      await enviarTexto(NUMERO_AUGUSTO, "⚠️ Nenhuma avaliação de troca pendente no momento.");
      return true;
    }
    const telefoneAv = avaliacaoPendente.telefone;
    await limparAvaliacaoPendente();
    const registroTroca = `[Sistema: o consultor confirmou a avaliação de troca em R$ ${valorTroca}. Informe esse valor ao cliente de forma natural, como o valor que conseguimos na troca do carro dele. NÃO mencione FIPE.]`;
    await salvarMensagem(telefoneAv, "sistema", registroTroca);
    if (!conversas[telefoneAv]) {
      const msgsAv = await buscarMensagens(telefoneAv);
      conversas[telefoneAv] = msgsAv.slice(-20).map(m => ({
        role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
        content: m.texto || ""
      }));
    }
    conversas[telefoneAv].push({ role: "user", content: registroTroca });
    try {
      const aprendizadosExtraTr = await obterAprendizados();
      const claudeTr = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          system: SYSTEM_PROMPT(null, aprendizadosExtraTr, null, false),
          messages: conversas[telefoneAv]
        },
        { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
      );
      const replyTr = limparRespostaIA(claudeTr.data.content[0].text);
      conversas[telefoneAv].push({ role: "assistant", content: replyTr });
      await enviarTexto(telefoneAv, replyTr);
      await salvarMensagem(telefoneAv, "sara", replyTr);
    } catch (e) {
      console.error("[Troca] Erro ao gerar/enviar resposta de troca:", e.message);
      if (e.response) await notificarFalhaApiClaude(e, `Resposta de troca (${telefoneAv})`);
    }
    return true;
  }

  if (t === "DEVOLVER") {
    await carregarAvaliacaoPendente();
    if (!avaliacaoPendente) {
      await enviarTexto(NUMERO_AUGUSTO, "⚠️ Nenhuma avaliação de troca pendente no momento.");
      return true;
    }
    const telefoneDv = avaliacaoPendente.telefone;
    await limparAvaliacaoPendente();
    const registroDevolver = `[Sistema: o consultor prefere não confirmar um valor de troca agora. Pergunte ao cliente quanto ele gostaria de receber de volta pelo carro dele, de forma natural.]`;
    await salvarMensagem(telefoneDv, "sistema", registroDevolver);
    if (!conversas[telefoneDv]) {
      const msgsDv = await buscarMensagens(telefoneDv);
      conversas[telefoneDv] = msgsDv.slice(-20).map(m => ({
        role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
        content: m.texto || ""
      }));
    }
    conversas[telefoneDv].push({ role: "user", content: registroDevolver });
    try {
      const aprendizadosExtraDv = await obterAprendizados();
      const claudeDv = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          system: SYSTEM_PROMPT(null, aprendizadosExtraDv, null, false),
          messages: conversas[telefoneDv]
        },
        { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
      );
      const replyDv = limparRespostaIA(claudeDv.data.content[0].text);
      conversas[telefoneDv].push({ role: "assistant", content: replyDv });
      await enviarTexto(telefoneDv, replyDv);
      await salvarMensagem(telefoneDv, "sara", replyDv);
    } catch (e) {
      console.error("[Devolver] Erro ao gerar/enviar resposta:", e.message);
      if (e.response) await notificarFalhaApiClaude(e, `Resposta devolver (${telefoneDv})`);
    }
    return true;
  }

  const matchContraproposta = text.match(/^CONTRAPROPOSTA\s+([\s\S]+)/i);
  if (matchContraproposta) {
    const valorContraproposta = matchContraproposta[1].trim();

    if (!descontoPendente) {
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: "⚠️ Nenhum desconto pendente no momento para fazer contraproposta." } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      return true;
    }

    const telefoneClienteCP = descontoPendente.telefone;

    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: `✅ Contraproposta de *${valorContraproposta}* enviada para ${telefoneClienteCP}` } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );

    await limparDescontoPendente();

    const registroContraproposta = `[Sistema: nosso consultor NÃO aceitou o valor pedido pelo cliente, mas fez uma CONTRAPROPOSTA de ${valorContraproposta} em ${new Date().toLocaleString("pt-BR")}. Informe esse valor ao cliente de forma natural, como uma condição especial que conseguimos negociar (não diga que é "contraproposta", apenas comunique o valor como a melhor condição possível). Pergunte se ele topa fechar nessas condições.]`;
    await salvarMensagem(telefoneClienteCP, "sistema", registroContraproposta);

    if (!conversas[telefoneClienteCP]) {
      const msgsCP = await buscarMensagens(telefoneClienteCP);
      conversas[telefoneClienteCP] = msgsCP.slice(-20).map(m => ({
        role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
        content: m.texto || ""
      }));
    }
    conversas[telefoneClienteCP].push({ role: "user", content: registroContraproposta });

    try {
      const aprendizadosExtraCP = await obterAprendizados();
      const claudeCP = await axios.post("https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          system: SYSTEM_PROMPT(null, aprendizadosExtraCP, null, false),
          messages: conversas[telefoneClienteCP]
        },
        { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
      );

      let replyCP = limparRespostaIA(claudeCP.data.content[0].text);
      replyCP = await bloquearSeParcelaSemSimulacaoReal(telefoneClienteCP, replyCP);
      conversas[telefoneClienteCP].push({ role: "assistant", content: replyCP });

      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: telefoneClienteCP, text: { body: replyCP } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(telefoneClienteCP, "sara", replyCP);
      console.log(`[Contraproposta] ✅ Valor ${valorContraproposta} enviado para ${telefoneClienteCP}`);
    } catch (e) {
      console.error("[Contraproposta] Erro ao gerar/enviar resposta:", e.message);
      if (e.response) await notificarFalhaApiClaude(e, `Envio de contraproposta (${telefoneClienteCP})`);
    }
    return true;
  }

  const autorizado = t === "AUTORIZO" || t.startsWith("AUTORIZO ");
  const negado = t === "NEGO" || t.startsWith("NEGO ");

  if (!autorizado && !negado) return false;
  if (!descontoPendente) {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: "⚠️ Nenhum desconto pendente no momento." } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    return true;
  }

  const telefoneCliente = descontoPendente.telefone; const valorSolicitado = descontoPendente.info && descontoPendente.info.preco_solicitado; const matchNego = negado ? text.match(/^NEGO\s+([\s\S]+)/i) : null; const valorMinimo = matchNego ? matchNego[1].trim() : null;

  await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to: NUMERO_AUGUSTO, text: { body: `✅ ${autorizado ? "Desconto autorizado" : "Desconto negado"} para ${telefoneCliente}` } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );

  await limparDescontoPendente();

  const registroDesconto = autorizado
    ? `[Sistema: desconto AUTORIZADO pelo consultor em ${new Date().toLocaleString("pt-BR")}. ${NOME_IA} já confirmou ao cliente que conseguimos a condição especial${valorSolicitado ? ` de R$ ${valorSolicitado}` : " combinada"}. NUNCA negar que o desconto foi aprovado. Se o cliente perguntar, confirmar que sim, o desconto foi aprovado.]`
    : `[Sistema: desconto NEGADO pelo consultor em ${new Date().toLocaleString("pt-BR")}. ${NOME_IA} já informou ao cliente que o preço está firme${valorMinimo ? `, mas que o valor mínimo possível para esse veículo é R$ ${valorMinimo}` : ""}.]`;
  await salvarMensagem(telefoneCliente, "sistema", registroDesconto);

  const msgSistema = autorizado
    ? `[Sistema: nosso consultor autorizou o desconto NO PREÇO. Informe ao cliente que conseguimos fazer uma condição especial e tente fechar o negócio. Seja entusiasta mas natural! 🚨 ISSO É SÓ SOBRE O PREÇO — não é aprovação de financiamento. Se o cliente estiver financiando e não houver um resultado real da financeira (comando SIMULACAO já respondido) para ele, NÃO calcule nem informe valores de parcela nessa mensagem, mesmo com o desconto aprovado. Fale apenas do valor/condição especial no preço; se ele perguntar de parcelas, diga que ainda está aguardando o retorno da financeira.]`
    : `[Sistema: nosso consultor não autorizou o desconto.${valorMinimo ? ` O valor mínimo que conseguimos fazer para esse veículo é R$ ${valorMinimo} — informe esse valor ao cliente como nossa melhor oferta.` : " Informe ao cliente que infelizmente o preço está firme, mas tente manter o interesse com outras vantagens como IPVA pago, facilidade de financiamento, etc."} Não mencione nomes.]`;

  if (!conversas[telefoneCliente]) {
    const msgsAN = await buscarMensagens(telefoneCliente);
    conversas[telefoneCliente] = msgsAN.slice(-20).map(m => ({
      role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
      content: m.texto || ""
    }));
  }
  conversas[telefoneCliente].push({ role: "user", content: msgSistema });

  try {
    const aprendizadosExtra = await obterAprendizados();
    const claude = await axios.post("https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: SYSTEM_PROMPT(null, aprendizadosExtra, null, false),
        messages: conversas[telefoneCliente]
      },
      { headers: { "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
    );

    let reply = limparRespostaIA(claude.data.content[0].text);
    reply = await bloquearSeParcelaSemSimulacaoReal(telefoneCliente, reply);
    conversas[telefoneCliente].push({ role: "assistant", content: reply });

    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: telefoneCliente, text: { body: reply } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );

    await salvarMensagem(telefoneCliente, "sara", reply);
    console.log(`[Desconto] ${autorizado ? "✅ Autorizado" : "❌ Negado"} para ${telefoneCliente}`);
  } catch (e) {
    console.error("[Desconto] Erro ao gerar/enviar resposta:", e.message);
    if (e.response) await notificarFalhaApiClaude(e, `Resposta após autorizar/negar desconto (${telefoneCliente})`);
  }
  return true;
}

async function processarMensagem(from, text, tentativasAnteriores = 0) {
  if (!text || typeof text !== "string") return;

  if (await processarComandoConsultor(from, text)) return;

  if (ehConsultor(from)) {
    console.log(`[Consultor] Mensagem ignorada (não é comando): "${text.substring(0, 50)}"`);
    return;
  }

  ultimaMensagemCliente[from] = Date.now();
  supabase.from("clientes").upsert({ telefone: from, ultima_mensagem_cliente: new Date().toISOString() }, { onConflict: "telefone" }).then(() => {}, () => {});
  const primeiraVez = !ultimaNotificacao[from];
  const ehRetry = tentativasAnteriores > 0;

  if (!conversas[from]) {
    try {
      const msgs = await buscarMensagens(from);
      if (msgs.length > 0) {
        conversas[from] = msgs.slice(-20).map(m => ({
          role: (m.tipo === "client" || m.tipo === "sistema") ? "user" : "assistant",
          content: m.texto || ""
        }));
        console.log(`[Histórico] Recuperado: ${conversas[from].length} msgs de ${from}`);
      } else {
        conversas[from] = [];
      }
    } catch (e) {
      conversas[from] = [];
    }
  }

  const ultimaDoHistorico = conversas[from][conversas[from].length - 1];
  const jaEstaNoHistorico = ultimaDoHistorico && ultimaDoHistorico.role === "user" && ultimaDoHistorico.content === text;
  if (!jaEstaNoHistorico) {
    conversas[from].push({ role: "user", content: text });
  }

  if (!ehRetry) {
    await salvarMensagem(from, "client", text);
  }
  notificarAugusto(from, text, primeiraVez).catch(() => {});
  if (conversas[from].length > 20) conversas[from] = conversas[from].slice(-20);

  // Intervenção manual recente: se um consultor humano respondeu esse cliente há pouco
  // (via /painel/enviar, /painel/template ou /painel/intervencao), a Sara fica em modo
  // silencioso — só registra a mensagem e notifica, sem gerar resposta automática, pra não
  // atropelar ou contradizer o que o consultor já disse.
  try {
    const { data: clienteIntervencao } = await supabase.from("clientes").select("intervencao_manual_em").eq("telefone", from).limit(1);
    const intervencaoEm = clienteIntervencao?.[0]?.intervencao_manual_em;
    if (intervencaoEm && (Date.now() - new Date(intervencaoEm).getTime()) < JANELA_INTERVENCAO_MANUAL_MS) {
      console.log(`[Intervenção Manual] Resposta automática pausada para ${from} (consultor interveio recentemente)`);
      return;
    }
  } catch (e) { console.error("[Intervenção Manual] Erro ao checar flag:", e.message); }

  if (clienteIndicouNumeroErrado(text)) {
    atualizarEstagio(from, "frio").catch(() => {});
    supabase.from("followups").update({ enviado: true }).eq("telefone", from).eq("enviado", false).then(() => {}, () => {});
    conversas[from].push({ role: "user", content: "[Sistema: o cliente deu sinais de que esse pode ser número errado/engano. Peça desculpas de forma breve e educada, confirme se é isso mesmo, e NÃO continue com abordagem comercial (não ofereça carros, não insista em vender) nesta resposta.]" });
  } else if (clienteSolicitouOptOutReativacao(text)) {
    registrarOptOutReativacao(from).catch(() => {});
    conversas[from].push({ role: "user", content: "[Sistema: o cliente pediu pra não receber mais mensagens automáticas de reativação/cobrança. Confirme educadamente que isso será respeitado e que ele pode voltar a falar com a gente quando quiser — não insista em oferecer carros nesta resposta.]" });
  }

  detectarLeadFrio(from, text, conversas[from]).catch(() => {});
  detectarEstagio(from, text, conversas[from], ehRetry).catch(() => {});

  await carregarColetaCreditoPendente(from);
  if (coletaCredito[from]) {
    const estado = coletaCredito[from];

    // Bug: cliente recusava explicitamente passar CPF/dados e a Sara insistia pedindo de
    // novo, em loop. Agora, uma recusa explícita encerra a coleta automática.
    if (clienteRecusouDadosFinanceiros(text)) {
      delete coletaCredito[from];
      await limparColetaCreditoPendente(from);
      const msgRecusa = "Sem problemas, entendo! 😊 Nesse caso não consigo fazer a simulação automática sem os dados, mas posso pedir pro nosso consultor te chamar pra conversar sobre outras formas de negociar. Quer que eu peça?";
      conversas[from].push({ role: "assistant", content: msgRecusa });
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: from, text: { body: msgRecusa } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(from, "sara", msgRecusa);
      return;
    }

    const cpfNaMensagem = validarCPF(text);
    const dataNaMensagem = extrairDataNascimento(text);
    const nomeNaMensagem = text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "").replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "").replace(/CEP[:\s]*/gi, "").trim();
    const palavrasNome = nomeNaMensagem.split(/\s+/).filter(p => p.length > 1);
    if (cpfNaMensagem && dataNaMensagem && palavrasNome.length >= 2) {
      estado.nome = palavrasNome.join(" ");
      estado.cpf = cpfNaMensagem;
      estado.nascimento = dataNaMensagem;
      estado.etapa = "cnh";
      await salvarColetaCreditoPendente(from, estado);
      const msg = `Obrigada, ${estado.nome.split(" ")[0]}! 😊 Recebi seus dados. Só mais uma coisa: você tem CNH (carteira de motorista)?`;
      conversas[from].push({ role: "assistant", content: msg });
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: from, text: { body: msg } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(from, "sara", msg);
      return;
    }

    if (estado.etapa === "aguardando_veiculo") {
      const veiculoConfirmado = encontrarVeiculoNoContexto(text, conversas[from], estoqueAtual);
      if (veiculoConfirmado) {
        estado.etapa = "nome";
        estado.veiculo = `${limparTexto(veiculoConfirmado.modelo)} ${veiculoConfirmado.ano || ""}`.trim();
        await salvarColetaCreditoPendente(from, estado);
        const msg = "Perfeito! Pra fazer a simulação preciso de alguns dados rapidinho. Primeiro, qual seu nome completo?";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      }
      const msg = "Sem problema! Me confirma qual carro do nosso estoque você quer financiar, que eu já sigo com a simulação. 😊";
      conversas[from].push({ role: "assistant", content: msg });
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: from, text: { body: msg } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(from, "sara", msg);
      return;
    }

    if (estado.etapa === "nome") {
      const nomeDigitado = text.trim();
      const palavrasNaoNome = ["entrada", "parcela", "financi", "desconto", "preço", "preco", "valor", "restante", "seria", "quero", "queria", "gostaria", "consegue", "consigo", "aguardo", "aguardando", "imagens", "espero", "esperando", "então", "entao", "beleza", "obrigado", "obrigada", "posso", "preciso", "foto", "fotos"];
      // Correcao 2026-11-02: palavras de frase/dia da semana que indicam que o cliente
      // mandou uma frase e nao um nome (caso telefone 51993***038: "Sábado vou ir aí na
      // loja" foi aceito como nome completo porque nao batia com nenhum termo da lista
      // acima). Checadas por palavra inteira pra nao confundir com substrings dentro de
      // nomes reais (ex: "ir" dentro de "Oliveira").
      const palavrasNaoNomeInteiras = ["vou", "vai", "vamos", "ir", "irei", "aí", "ai", "lá", "la", "loja", "chegar", "chego", "passar", "estar", "hoje", "amanhã", "amanha", "depois", "agora", "sábado", "sabado", "domingo", "segunda", "terça", "terca", "quarta", "quinta", "sexta"];
      const temDigito = /\d/.test(nomeDigitado);
      const contemPalavraNaoNome = palavrasNaoNome.some(p => nomeDigitado.toLowerCase().includes(p))
        || palavrasNaoNomeInteiras.some(p => contemPalavraInteira(nomeDigitado, p));
      const parecePergunta = text.includes("?") || text.toLowerCase().startsWith("qual") || text.toLowerCase().startsWith("como") || text.toLowerCase().startsWith("quando") || text.toLowerCase().startsWith("quanto") || text.toLowerCase().startsWith("onde") || text.toLowerCase().startsWith("tem") || text.toLowerCase().startsWith("voc") || temDigito || contemPalavraNaoNome;
      if (nomeDigitado.split(/\s+/).length >= 2 && nomeDigitado.length >= 5 && !parecePergunta) {
        estado.nome = nomeDigitado;
        estado.etapa = "cpf";
        await salvarColetaCreditoPendente(from, estado);
        const msg = "Perfeito! Agora me passa seu CPF, por favor (só os números) 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      } else if (parecePergunta) {
        conversas[from].push({ role: "user", content: text + "\n[Sistema: o cliente mandou algo que não é um nome completo válido (pode ser uma pergunta, um emoji, ou uma confirmação vaga). Se for uma pergunta de verdade, responda brevemente. Em QUALQUER caso, termine a mensagem pedindo o nome completo de novo — não mude de assunto. A ÚNICA coisa pendente aqui é o nome.]" });
      } else {
        const msg = "Pode me mandar seu nome completo, por favor? 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      }
    }

    if (estado.etapa === "cpf") {
      const cpfValido = validarCPF(text);
      if (cpfValido) {
        estado.cpf = cpfValido;
        estado.etapa = "nascimento";
        await salvarColetaCreditoPendente(from, estado);
        const msg = "Show! Agora sua data de nascimento (dia/mês/ano) 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      } else if (text.replace(/\D/g, "").length >= 9) {
        const msg = "Esse CPF não parece válido. Pode conferir e mandar de novo? (só os números, 11 dígitos) 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      } else {
        conversas[from].push({ role: "user", content: text + "\n[Sistema: o cliente mandou algo que não é um CPF válido (pode ser uma pergunta, um emoji, ou uma confirmação vaga). Se for uma pergunta de verdade, responda brevemente. Em QUALQUER caso, termine a mensagem pedindo o CPF de novo — não mude de assunto, não pergunte sobre financiamento, parcela ou orçamento. A ÚNICA coisa pendente aqui é o CPF.]" });
      }
    }

    if (estado.etapa === "nascimento") {
      const dataNasc = extrairDataNascimento(text);
      if (dataNasc) {
        estado.nascimento = dataNasc;
        estado.etapa = "cnh";
        await salvarColetaCreditoPendente(from, estado);
        const msg = "Só mais uma coisa: você tem CNH (carteira de motorista)? 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      } else {
        const msg = "Não consegui entender a data. Pode mandar no formato dia/mês/ano? Ex: 15/03/1990 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      }
    }

    if (estado.etapa === "cnh") {
      const tCnh = text.toLowerCase().trim();
      const respostasSimCnh = ["sim", "tenho", "possuo", "s", "claro", "afirmativo"];
      const respostasNaoCnh = ["não", "nao", "n", "negativo", "não tenho", "nao tenho", "não possuo", "nao possuo"];
      const disseNaoCnh = respostasNaoCnh.some(p => tCnh === p || tCnh.includes(p));
      const disseSimCnh = !disseNaoCnh && respostasSimCnh.some(p => tCnh === p || tCnh.includes(p));

      if (disseSimCnh || disseNaoCnh) {
        estado.temCnh = disseSimCnh ? "Sim" : "Não";
        estado.etapa = "entrada";
        await salvarColetaCreditoPendente(from, estado);

        const historicoTexto = (conversas[from] || []).map(m => m.content || "").join(" \n ");
        const matchEntradaPrevia = historicoTexto.match(/entrada[^\d]{0,15}(r\$\s*)?([\d.,]+\s*(mil|k)?)/i)
          || historicoTexto.match(/([\d.,]+\s*(mil|k)?)\s*(de\s*)?entrada/i);

        if (matchEntradaPrevia) {
          const valorDetectado = matchEntradaPrevia[2] || matchEntradaPrevia[1];
          const msg = `Combinado! Você já tinha mencionado uma entrada de *${valorDetectado.trim()}* aqui na nossa conversa — é esse mesmo o valor? Pode confirmar ou me dizer o valor certo 😊`;
          conversas[from].push({ role: "assistant", content: msg });
          await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
            { messaging_product: "whatsapp", to: from, text: { body: msg } },
            { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
          );
          await salvarMensagem(from, "sara", msg);
          estado.entradaSugerida = valorDetectado.trim();
          await salvarColetaCreditoPendente(from, estado);
          return;
        }

        const msg = "Combinado! Última coisa: você pretende dar algum valor de entrada? Se sim, me diz quanto 😊 (se não tiver entrada, é só dizer)";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      } else {
        const msg = "Só preciso confirmar: você tem CNH (carteira de motorista)? Pode responder sim ou não 😊";
        conversas[from].push({ role: "assistant", content: msg });
        await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
          { messaging_product: "whatsapp", to: from, text: { body: msg } },
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
        );
        await salvarMensagem(from, "sara", msg);
        return;
      }
    }

    if (estado.etapa === "entrada") {
      const tEntrada = text.toLowerCase().trim();
      const semEntrada = ["não", "nao", "sem entrada", "n", "0", "nenhuma", "não tenho", "nao tenho"];
      const confirmacoes = ["sim", "isso", "é esse", "e esse", "esse mesmo", "confirmo", "exato", "isso mesmo", "correto"];

      let entradaValor;
      if (estado.entradaSugerida && confirmacoes.some(p => tEntrada === p || tEntrada.includes(p))) {
        entradaValor = estado.entradaSugerida;
      } else if (semEntrada.some(p => tEntrada === p || tEntrada.includes(p))) {
        entradaValor = "Sem entrada";
      } else {
        entradaValor = text.trim();
      }

      estado.entrada = entradaValor;

      let nomeVeiculo = null;
      const veiculoDoEstoque = encontrarVeiculoNoContexto(text, conversas[from], estoqueAtual);
      if (veiculoDoEstoque) {
        nomeVeiculo = `${limparTexto(veiculoDoEstoque.modelo)} ${veiculoDoEstoque.ano || ""}`.trim();
      }
      if (!nomeVeiculo) {
        try {
          const { data: clienteData } = await supabase.from("clientes").select("veiculo_interesse").eq("telefone", from).limit(1);
          const vi = clienteData?.[0]?.veiculo_interesse;
          if (vi && estoqueAtual.some(v => limparTexto(v.modelo || "").toLowerCase().includes(vi.toLowerCase()))) {
            nomeVeiculo = vi;
          }
        } catch (e) { /* segue sem veículo */ }
      }

      const dadosFinais = {
        nome: estado.nome, cpf: estado.cpf, nascimento: estado.nascimento,
        entrada: estado.entrada, veiculo: nomeVeiculo, temCnh: estado.temCnh || "Não informado"
      };
      delete coletaCredito[from];
      limparColetaCreditoPendente(from).catch(() => {});

      await notificarDadosCredito(from, dadosFinais);
      const simulacaoIdCriada = await salvarSimulacaoCredito(from, dadosFinais);
      await atualizarEstagio(from, "negociacao", nomeVeiculo);

      // Dispara as simulações automáticas nos bancos (Pan/Santander/Itaú/BV) em
      // segundo plano — não bloqueia a resposta ao cliente. Busca placa e valor
      // do veículo no Supabase antes (hoje retorna placa=null pra todos, porque
      // nenhum veículo tem placa cadastrada ainda — ver buscarVeiculoParaSimulacao).
      // Enquanto os bancos reais não estiverem configurados, isso só grava
      // "nao_configurado"/"dados_insuficientes" na tabela simulacoes_bancos,
      // sem efeito nenhum sobre o fluxo da Sara.
      buscarVeiculoParaSimulacao(nomeVeiculo).then(({ placa, veiculoValor }) => {
        return simularTodosBancos(
          {
            nome: dadosFinais.nome, cpf: dadosFinais.cpf, nascimento: dadosFinais.nascimento,
            telefone: from, placa, veiculoValor,
            entrada: dadosFinais.entrada, prazoMeses: null
          },
          simulacaoIdCriada,
          from
        );
      }).catch(e => console.error("[SimulaçãoBancos] Erro no orquestrador:", e.message));

      const primeiroNome = dadosFinais.nome.split(" ")[0];
      const primeiroNomeCapitalizado = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
      const msg = `Perfeito, ${primeiroNomeCapitalizado}! Já encaminhei seus dados pra nossa equipe fazer a simulação nas financeiras. Assim que tiver o resultado, te aviso aqui! 😊`;
      conversas[from].push({ role: "assistant", content: msg });
      await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: from, text: { body: msg } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      await salvarMensagem(from, "sara", msg);
      return;
    }
  }

  const ehTextoNormal = !text.startsWith("[Cliente enviou") && !text.startsWith("[Áudio]") && !text.startsWith("[Sistema:");
  const jaEnviouFotos = conversas[from].slice(-6).map(m => m.content || "").join(" ").includes("[Sistema: fotos enviadas");
  const reclamouFotosNaoRecebidas = ehTextoNormal && clienteReclamouFotosNaoRecebidas(text);
  const resultadoFotos = ehTextoNormal && (clienteEstaPedindoFotosDoEstoque(text, conversas[from]) || reclamouFotosNaoRecebidas);
  const clientePedindoFotos = resultadoFotos && (!jaEnviouFotos || resultadoFotos === "adicional" || reclamouFotosNaoRecebidas);
  if (clientePedindoFotos) {
    const veiculo = encontrarVeiculoNoContexto(text, conversas[from], estoqueAtual);
    let msgFotos;
    if (veiculo?.fotos?.length > 0) {
      console.log(`[Fotos] Enviando ${veiculo.fotos.length} fotos do ${veiculo.modelo}`);
      const enviouComSucesso = await enviarFotosVeiculo(from, veiculo);
      const modeloAno = `${limparTexto(veiculo.modelo)} ${veiculo.ano || ""}`.trim();
      if (enviouComSucesso) {
        msgFotos = `Mandei as fotos do ${modeloAno}! O que achou? 😊`;
        atualizarEstagio(from, "negociacao", limparTexto(veiculo.modelo)).catch(() => {});
      } else {
        msgFotos = `Opa, tive uma instabilidade agora tentando mandar as fotos do ${modeloAno}. Pode me pedir de novo daqui a pouco? 😅`;
      }
    } else if (resultadoFotos === "adicional") {
      msgFotos = "As fotos disponíveis desse anúncio já foram todas enviadas! Se quiser, posso pedir pro nosso consultor tirar fotos específicas e te enviar depois, ou você pode vir pessoalmente conferir o interior. 😊";
    } else {
      msgFotos = "Qual veículo exatamente você quer ver as fotos? Me confirma o modelo pra eu te mandar certinho! 😊";
    }
    conversas[from].push({ role: "assistant", content: msgFotos });
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: from, text: { body: msgFotos } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
