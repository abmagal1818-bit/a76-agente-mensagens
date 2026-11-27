    const { telefone, tipo, texto, wamid, status_entrega, motivo_erro } = req.body || {};
    if (!telefone || !texto) {
      return res.status(400).json({ ok: false, erro: "telefone e texto sao obrigatorios" });
    }
    const numero = String(telefone).replace(/\D/g, "");
    const { error } = await supabase.from("mensagens").insert({ telefone: numero, tipo: tipo || "sara", texto, wamid: wamid || null, status_entrega: status_entrega || "enviado", motivo_erro: motivo_erro || null });
    if (error) {
      console.error("[Mensagem] ERRO ao gravar mensagem:", error.message);
      return res.status(500).json({ ok: false, erro: error.message });
    }
    console.log(`[Mensagem] OK gravada: ${numero} (${tipo || "sara"})`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[Mensagem] EXCECAO:", e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});
app.post("/notificar-lead", async (req, res) => {
  try {
    const bodyNormalizado = {};
    for (const [chave, valor] of Object.entries(req.body || {})) {
      bodyNormalizado[String(chave).trim()] = valor;
    }
    const { nome, telefone, veiculo, portal, mensagem } = bodyNormalizado;
    if (!telefone) {
      console.error("[Lead] ❌ Telefone ausente. Body recebido:", JSON.stringify(req.body));
      return res.status(400).json({ erro: "Telefone obrigatório" });
    }
    const numero = String(telefone).replace(/\D/g, "");
    const formatado = numero.length >= 12 ? `+${numero.slice(0,2)} (${numero.slice(2,4)}) ${numero.slice(4,9)}-${numero.slice(9)}` : telefone;
    const linkWhatsApp = `https://wa.me/${numero}`;
    const msg = `🔔 *Novo lead — ${portal || "Portal"}*\nNome: *${nome || "Não informado"}*\nFone: ${formatado}\nVeículo: *${veiculo || "Não informado"}*${mensagem ? `\nMensagem: "${mensagem.substring(0, 150)}"` : ""}\n\nFalar com lead: ${linkWhatsApp}\n${BASE_URL}/painel`;
    await enviarTexto(NUMERO_AUGUSTO, msg);
    console.log(`[Lead] ✅ Notificação enviada: ${formatado} — ${veiculo}`);
    try { const { data: existenteCRM } = await supabase.from("clientes").select("id").eq("telefone", numero).limit(1); const payloadCRM = { telefone: numero, nome: nome || undefined, veiculo_interesse: veiculo || undefined, ultima_interacao: new Date().toISOString() }; if (!existenteCRM || !existenteCRM.length) payloadCRM.estagio = "quente"; const { error: erroCRM } = await supabase.from("clientes").upsert(payloadCRM, { onConflict: "telefone" }); if (erroCRM) console.error("[Lead] ERRO ao gravar no CRM (Supabase):", erroCRM.message); else console.log("[Lead] OK gravado no CRM/painel:", numero); } catch (erroCRM) { console.error("[Lead] EXCECAO ao gravar no CRM (Supabase):", erroCRM.message); } res.json({ ok: true });
  } catch(e) {
    console.error("[Lead] Erro notificação:", e.message);
    res.status(500).json({ erro: e.message });
  }
});
app.post("/notificar-post-publicado", async (req, res) => {
  try {
    const { veiculo, instagram_ok, facebook_ok } = req.body;
    const igOk = instagram_ok === true || instagram_ok === "true";
    const fbOk = facebook_ok === true || facebook_ok === "true";
    const msg = `🎬 *Reels publicado!*\nVeículo: *${veiculo || "não informado"}*\nInstagram: ${igOk ? "✅" : "❌"}\nFacebook: ${fbOk ? "✅" : "❌"}`;
    await enviarTexto(NUMERO_AUGUSTO, msg);
    console.log(`[Reels] ✅ Notificação de publicação enviada: ${veiculo}`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[Reels] Erro notificação:", e.message);
    res.status(500).json({ erro: e.message });
  }
});
const TEMPLATES_STORY = ["golf_fipe", "gol_completo", "ford_ka_negocio", "aircross_grid"];
const DIAS_SEM_REPETIR = 5;
function embaralhar(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
app.get("/painel/stories/sortear-veiculos", async (req, res) => {
  try {
    const limiteData = new Date(Date.now() - DIAS_SEM_REPETIR * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentes, error: erroRecentes } = await supabase
      .from("stories_publicados")
      .select("veiculo_id")
      .gte("publicado_em", limiteData);
    if (erroRecentes) throw erroRecentes;
    const idsExcluidos = (recentes || []).map(r => r.veiculo_id).filter(Boolean);
    let query = supabase
      .from("veiculos")
      .select("*")
      .eq("status", "disponivel")
      .eq("publicado", true);
    if (idsExcluidos.length > 0) {
      query = query.not("id", "in", `(${idsExcluidos.join(",")})`);
    }
    const { data: veiculos, error: erroVeiculos } = await query;
    if (erroVeiculos) throw erroVeiculos;
    let pool = veiculos || [];
    if (pool.length < 4) {
      const { data: todosDisponiveis } = await supabase
        .from("veiculos")
        .select("*")
        .eq("status", "disponivel")
        .eq("publicado", true);
      const idsJaNoPool = new Set(pool.map(v => v.id));
      const extras = (todosDisponiveis || []).filter(v => !idsJaNoPool.has(v.id));
      pool = [...pool, ...embaralhar(extras)];
    }
    const sorteados = embaralhar(pool).slice(0, 4);
    const modelosSorteados = embaralhar(TEMPLATES_STORY);
    const resultado = sorteados.map((v, i) => ({
      veiculo: v,
      template: modelosSorteados[i % modelosSorteados.length],
    }));
    res.json({ ok: true, total: resultado.length, itens: resultado });
  } catch (e) {
    console.error("[Stories] Erro ao sortear veiculos:", e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});
app.post("/painel/stories/registrar", async (req, res) => {
  try {
    const { veiculo_id, modelo_usado, instagram_ok, facebook_ok, veiculo_titulo } = req.body;
    if (!veiculo_id) return res.status(400).json({ ok: false, erro: "veiculo_id e obrigatorio" });
    const igOk = instagram_ok === true || instagram_ok === "true";
    const fbOk = facebook_ok === true || facebook_ok === "true";
    const { error } = await supabase.from("stories_publicados").insert({
      veiculo_id,
      modelo_usado: modelo_usado || null,
      instagram_ok: igOk,
      facebook_ok: fbOk,
    });
    if (error) throw error;
    const msg = `📸 *Story publicado!*\nVeiculo: *${veiculo_titulo || veiculo_id}*\nModelo: ${modelo_usado || "?"}\nInstagram: ${igOk ? "✅" : "❌"}\nFacebook: ${fbOk ? "✅" : "❌"}`;
    await enviarTexto(NUMERO_AUGUSTO, msg);
    res.json({ ok: true });
  } catch (e) {
    console.error("[Stories] Erro ao registrar publicacao:", e.message);
    res.status(500).json({ ok: false, erro: e.message });
  }
});
app.post("/painel/alertas/visto", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ erro: "ID inválido" });
  try {
    await supabase.from("alertas_pendentes").update({ visualizado: true }).eq("id", id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get("/painel/lista", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const conversas = await listarConversas();
    let itens = conversas.map(c => {
      const tel = String(c.from || '');
      const msg = String(c.ultimaMensagem || '').substring(0, 60);
      const hora = c.ultimaAtividade ? new Date(c.ultimaAtividade).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '';
      return '<a href="/painel/chat/' + tel + '" style="display:block;padding:12px 16px;border-bottom:1px solid #141414;text-decoration:none;' + (c.naoLida > 0 ? 'border-left:3px solid #f44336' : '') + '">' +
        '<div style="font-size:13px;font-weight:600;color:#fff">' + (c.formatado || tel) + (c.naoLida > 0 ? ' <span style="background:#f44336;color:#fff;font-size:10px;padding:1px 5px;border-radius:8px">' + c.naoLida + '</span>' : '') + '</div>' +
        '<div style="font-size:11px;color:#555;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + msg + '</div>' +
        '<div style="font-size:10px;color:#444;margin-top:2px">' + hora + '</div>' +
        '</a>';
    }).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conversas — ${NOME_IA} CRM</title>` +
      '<style>body{margin:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0}a{color:inherit}' +
      'header{background:#111;border-bottom:1px solid #222;padding:12px 16px;position:sticky;top:0}' +
      '.tabs{padding:10px 16px;background:#0f0f0f;border-bottom:1px solid #1a1a1a;display:flex;gap:10px}</style></head><body>' +
      `<header><h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">${NOME_IA} <span style="color:#f0a500">CRM</span></h1></header>` +
      '<div class="tabs"><a href="/painel" style="color:#888;font-size:12px;text-decoration:none">📋 Pipeline</a>' +
      '<a href="/painel/lista" style="color:#f0a500;font-size:12px;font-weight:600;text-decoration:none">💬 Conversas</a>' +
      '<a href="/painel/simulacao-manual" style="color:#888;font-size:12px;text-decoration:none">💳 Simulações</a></div>' +
      (itens || '<p style="padding:20px;color:#555">Nenhuma conversa</p>') +
      '</body></html>';

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.send('<html><body style="background:#000;color:#f44;padding:20px">Erro: ' + e.message + '</body></html>');
  }
});

app.get("/painel/chat/:tel", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const tel = req.params.tel;
  const erro = req.query.erro;
  try {
    const mensagens = await buscarMensagens(tel);
    const numero = tel.replace(/\D/g, '');
    const formatado = numero.length >= 12 ? '(' + numero.slice(2,4) + ') ' + numero.slice(4,9) + '-' + numero.slice(9) : tel;

    let referralCliente = null;
    try {
      const { data: dataCliente } = await supabase.from("clientes").select("anuncio_referral").eq("telefone", tel).limit(1);
      referralCliente = dataCliente?.[0]?.anuncio_referral || null;
    } catch (e) { }

    let avisoErro = '';
    if (erro === 'janela24h') {
      avisoErro = '<div style="background:#3a1a00;color:#f0a500;padding:10px 14px;font-size:12px;border-bottom:1px solid #f0a500">⚠️ Não enviado: faz mais de 24h que o cliente não escreve. Use um template aprovado ou espere ele mandar mensagem.</div>';
    } else if (erro === '1') {
      avisoErro = '<div style="background:#3a0a0a;color:#f44336;padding:10px 14px;font-size:12px;border-bottom:1px solid #f44336">⚠️ Erro ao enviar a mensagem. Tente de novo.</div>';
    }

    let msgsHtml = '';
    let ultimaDataRenderizada = null;
    for (const m of mensagens) {
      const tipo = m.tipo || 'client';
      const dataObjMsg = m.criado_em ? new Date(m.criado_em) : null;
      const dataLabel = dataObjMsg ? dataObjMsg.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
      if (dataLabel && dataLabel !== ultimaDataRenderizada) {
        msgsHtml += '<div style="text-align:center;margin:14px 0"><span style="background:#1a1a1a;color:#777;font-size:10px;padding:3px 12px;border-radius:10px;letter-spacing:.3px">' + dataLabel + '</span></div>';
        ultimaDataRenderizada = dataLabel;
      }
      const hora = dataObjMsg ? dataObjMsg.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
      const alinha = tipo === 'client' || tipo === 'client_foto' ? 'flex-start' : 'flex-end';
      const bg = (tipo === 'client' || tipo === 'client_foto') ? '#1e1e1e' : tipo === 'sara' || tipo === 'sara_fotos' ? '#1a3a1a' : tipo === 'sistema' ? '#1a1a2e' : '#2a1a00';
      const cor = (tipo === 'client' || tipo === 'client_foto') ? '#ddd' : tipo === 'sara' || tipo === 'sara_fotos' ? '#b8e6b8' : tipo === 'sistema' ? '#555' : '#f0c060';
      const label = (tipo === 'client' || tipo === 'client_foto') ? '👤 Cliente' : tipo === 'sara' || tipo === 'sara_fotos' ? `🤖 ${NOME_IA}` : tipo === 'sistema' ? '⚙️ Sistema' : '⚡ Você';

      let conteudo = '';
      if (tipo === 'sara_fotos') {
        try {
          const dados = JSON.parse(m.texto || '{}');
          const modelo = dados.modelo || 'Veículo';
          const urlsFotos = dados.fotos || [];
          conteudo = '<div style="padding:8px 0">' +
            '<div style="font-size:11px;color:#81c784;margin-bottom:6px">📸 ' + urlsFotos.length + ' foto(s) do ' + String(modelo).replace(/</g,'&lt;') + ' enviadas</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
            urlsFotos.map(url =>
              '<img src="' + url + '" onclick="abrirFoto(this.src)" style="width:80px;height:60px;object-fit:cover;border-radius:4px;cursor:zoom-in" onerror="this.style.display=\'none\'">'
            ).join('') +
            '</div></div>';
        } catch(e) {
          conteudo = '<div style="color:#81c784;font-size:12px">📸 Fotos enviadas</div>';
        }
      } else if (tipo === 'client_foto') {
        try {
          const dados = JSON.parse(m.texto || '{}');
          const caption = dados.caption ? '<div style="font-size:11px;color:#aaa;margin-top:4px">' + String(dados.caption).replace(/</g,'&lt;') + '</div>' : '';
          if (dados.url) {
            conteudo = '<img src="' + dados.url + '" onclick="abrirFoto(this.src)" style="max-width:100%;border-radius:6px;display:block;cursor:zoom-in" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'block\'">' +
              '<div style="display:none;color:#888;font-size:12px">📷 Foto indisponível (link expirou antes de ser arquivada)</div>' + caption;
          } else {
            conteudo = '<div style="color:#888;font-size:12px">📷 Foto recebida' + (dados.caption ? ': ' + dados.caption : '') + '</div>';
          }
        } catch(e) {
          conteudo = '<div style="color:#888;font-size:12px">📷 Foto recebida</div>';
        }
      } else if (tipo === 'sistema') {
        conteudo = '<div style="font-size:10px;color:#555;font-style:italic">' + String(m.texto || '').replace(/</g,'&lt;').substring(0, 100) + '...</div>';
      } else {
        conteudo = '<div style="background:' + bg + ';color:' + cor + ';padding:8px 11px;border-radius:10px;font-size:13px;line-height:1.5">' + String(m.texto || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') + '</div>';
      }

      let statusIcone = '';
      if (tipo !== 'client' && tipo !== 'client_foto' && tipo !== 'sistema' && m.wamid) {
        const statusMap = {
          enviado: { icone: '✓', cor: '#888' },
          sent: { icone: '✓', cor: '#888' },
          delivered: { icone: '✓✓', cor: '#888' },
          read: { icone: '✓✓', cor: '#53bdeb' },
          failed: { icone: '❌', cor: '#f44336' }
        };
        const s = statusMap[m.status_entrega] || statusMap.enviado;
        statusIcone = ' <span style="color:' + s.cor + '">' + s.icone + '</span>';
        if (m.status_entrega === 'failed' && m.motivo_erro) {
          statusIcone += '<div style="font-size:10px;color:#f44336;margin-top:2px">⚠️ ' + String(m.motivo_erro).replace(/</g,'&lt;') + '</div>';
        }
      }

      if (tipo === 'sistema') continue;

      msgsHtml += '<div style="display:flex;justify-content:' + alinha + ';margin-bottom:8px">' +
        '<div style="max-width:82%">' +
        '<div style="font-size:9px;color:#555;margin-bottom:2px;text-align:' + (alinha==='flex-start'?'left':'right') + '">' + label + '</div>' +
        conteudo +
        '<div style="font-size:9px;color:#444;margin-top:2px;text-align:' + (alinha==='flex-start'?'left':'right') + '">' + hora + statusIcone + '</div>' +
        '</div></div>';
    }

    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + formatado + '</title>' +
      '<style>body{margin:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0}' +
      'header{background:#111;border-bottom:1px solid #222;padding:10px 14px;display:flex;align-items:center;gap:10px;position:sticky;top:0}' +
      '.msgs{padding:12px;min-height:70vh}' +
      'form{position:sticky;bottom:0;background:#111;border-top:1px solid #1e1e1e;padding:10px 12px;display:flex;gap:8px}' +
      'textarea{flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:7px;color:#fff;padding:8px;font-size:13px;height:44px;font-family:inherit;resize:none}' +
      'button{background:#f0a500;color:#000;border:none;border-radius:7px;padding:0 16px;font-size:13px;font-weight:700;cursor:pointer}</style></head><body>' +
      '<header>' +
      '<a href="/painel/lista" style="color:#f0a500;text-decoration:none;font-size:20px">←</a>' +
      '<div style="flex:1"><div style="font-size:14px;font-weight:600">' + formatado + '</div></div>' +
      '<button onclick="document.getElementById(\'form-template\').style.display=\'flex\'" style="background:#1a1a1a;color:#f0a500;border:1px solid #f0a500;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer">📋 Template</button>' +
      '<button onclick="document.getElementById(\'form-fotos\').style.display=\'flex\'" style="background:#1a1a1a;color:#81c784;border:1px solid #81c784;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer">📸 Fotos</button>' +
      '<button onclick="document.getElementById(\'form-video\').style.display=\'flex\'" style="background:#1a1a1a;color:#64b5f6;border:1px solid #64b5f6;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer">🎥 Vídeo</button>' +
      '</header>' +
      (referralCliente ? '<div style="background:#0d1f2d;color:#64b5f6;padding:8px 14px;font-size:11px;border-bottom:1px solid #1a3a52">📢 Veio de anúncio: ' + String(referralCliente).replace(/</g,'&lt;') + '</div>' : '') +
      '<form id="form-fotos" action="/painel/enviar-fotos" method="POST" style="display:none;padding:10px 14px;background:#1a2a1a;border-bottom:1px solid #81c784;gap:8px;flex-direction:column">' +
      '<input type="hidden" name="tel" value="' + tel + '">' +
      '<label style="font-size:11px;color:#81c784">Selecione o veículo para enviar as fotos:</label>' +
      '<select name="modelo_id" required style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      '<option value="">-- Selecione --</option>' +
      estoqueAtual.filter(v => v.fotos?.length > 0).map(v =>
        '<option value="' + (v.id || limparTexto(v.modelo || '') + '_' + (v.ano || '')) + '">' +
        limparTexto(v.modelo || '') + ' ' + (v.ano || '') + ' — ' + Number(v.km || 0).toLocaleString('pt-BR') + ' km — R$ ' + Number(v.preco || 0).toLocaleString('pt-BR') +
        '</option>'
      ).join('') +
      '</select>' +
      '<button type="submit" style="background:#81c784;color:#000;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Enviar fotos pelo WhatsApp</button>' +
      '</form>' +
      '<form id="form-template" action="/painel/template" method="POST" style="display:none;padding:10px 14px;background:#1a1500;border-bottom:1px solid #f0a500;gap:8px;flex-direction:column">' +
      '<input type="hidden" name="tel" value="' + tel + '">' +
      '<label style="font-size:11px;color:#f0a500">Veículo de interesse (para preencher o template):</label>' +
      '<input type="text" name="veiculo" placeholder="ex: Polo 1.0 MPI" value="' + (referralCliente ? String(referralCliente).replace(/"/g,'&quot;') : '') + '" required style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      '<button type="submit" style="background:#f0a500;color:#000;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Enviar template de retomada</button>' +
      '</form>' +
      '<form id="form-video" action="/painel/enviar-video" method="POST" enctype="multipart/form-data" style="display:none;padding:10px 14px;background:#0d1f2d;border-bottom:1px solid #64b5f6;gap:8px;flex-direction:column">' +
      '<input type="hidden" name="tel" value="' + tel + '">' +
      '<label style="font-size:11px;color:#64b5f6">Selecione o vídeo (MP4, máx. 16MB):</label>' +
      '<input type="file" name="video" accept="video/mp4,video/3gpp" required style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      '<input type="text" name="legenda" placeholder="Legenda (opcional)" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#fff;padding:8px;font-size:13px">' +
      '<button type="submit" style="background:#64b5f6;color:#000;border:none;border-radius:6px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">Enviar vídeo pelo WhatsApp</button>' +
      '</form>' +
      avisoErro +
      '<div class="msgs">' + (msgsHtml || '<p style="color:#555;text-align:center;padding:20px">Sem mensagens</p>') + '</div>' +
      '<form action="/painel/enviar" method="POST">' +
      '<input type="hidden" name="tel" value="' + tel + '">' +
      `<textarea name="texto" placeholder="Enviar como ${NOME_IA}..."></textarea>` +
      '<button type="submit">→</button>' +
      '</form>' +
      '<div id="lightbox" onclick="fecharFoto()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999;align-items:center;justify-content:center;cursor:zoom-out">' +
      '<img id="lightbox-img" style="max-width:92%;max-height:92%;border-radius:6px" onclick="event.stopPropagation()">' +
      '</div>' +
      '<script>' +
      'function abrirFoto(src) { document.getElementById("lightbox-img").src = src; document.getElementById("lightbox").style.display = "flex"; }' +
      'function fecharFoto() { document.getElementById("lightbox").style.display = "none"; }' +
      'document.addEventListener("keydown", function(e) { if (e.key === "Escape") fecharFoto(); });' +
      'var ultimoTotalMsgs = ' + mensagens.length + ';' +
      'var telAtual = "' + tel + '";' +
      'function verificarNovasMensagens() {' +
      ' fetch("/painel/mensagens/" + telAtual).then(function(r){return r.json();}).then(function(d) {' +
      '  var total = (d.mensagens || []).length;' +
      '  if (total > ultimoTotalMsgs) {' +
      '   var textarea = document.querySelector("textarea[name=texto]");' +
      '   if (textarea && textarea.value.trim()) {' +
      '    var banner = document.getElementById("banner-novas");' +
      '    if (!banner) {' +
      '     banner = document.createElement("div");' +
      '     banner.id = "banner-novas";' +
      '     banner.style.cssText = "position:sticky;top:0;background:#f0a500;color:#000;text-align:center;padding:7px;font-size:12px;font-weight:700;cursor:pointer;z-index:20";' +
      '     banner.textContent = "\\uD83D\\uDD14 Nova mensagem chegou — clique pra atualizar";' +
      '     banner.onclick = function() { location.reload(); };' +
      '     var msgsEl = document.querySelector(".msgs");' +
      '     if (msgsEl) msgsEl.insertAdjacentElement("beforebegin", banner);' +
      '    }' +
      '   } else { location.reload(); }' +
      '  }' +
      ' }).catch(function(){});' +
      '}' +
      'setInterval(verificarNovasMensagens, 6000);' +
      '</script>' +
      '</body></html>';

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.send('<html><body style="background:#000;color:#f44;padding:20px">Erro: ' + e.message + '</body></html>');
  }
});

app.post("/painel/enviar-fotos", async (req, res) => {
  const { tel, modelo_id } = req.body;
  if (!tel || !modelo_id) return res.redirect("/painel/lista");

  const veiculo = estoqueAtual.find(v => {
    const idGerado = (v.id || limparTexto(v.modelo || '') + '_' + (v.ano || ''));
    return String(idGerado) === String(modelo_id);
  });

  if (!veiculo) {
    console.log(`[Painel Fotos] Veículo ID "${modelo_id}" não encontrado`);
    return res.redirect("/painel/chat/" + tel + "?erro=1");
  }
  if (!veiculo.fotos?.length) {
    console.log(`[Painel Fotos] Veículo (${veiculo.modelo}) sem fotos`);
    return res.redirect("/painel/chat/" + tel + "?erro=1");
  }
  try {
    console.log(`[Painel Fotos] Enviando ${veiculo.fotos.length} fotos do ${veiculo.modelo} para ${tel}`);
    await enviarFotosVeiculo(tel, veiculo);
    if (!conversas[tel]) conversas[tel] = [];
    conversas[tel].push({ role: "user", content: `[Sistema: fotos enviadas do ${limparTexto(veiculo.modelo)} pelo consultor via painel]` });
    res.redirect("/painel/chat/" + tel);
  } catch (e) {
    console.error("[Painel Fotos] Erro:", e.message);
    res.redirect("/painel/chat/" + tel + "?erro=1");
  }
});

app.post("/painel/enviar-video", uploadMiddleware.single("video"), async (req, res) => {
  const { tel, legenda } = req.body;
  if (!tel || !req.file) return res.redirect("/painel/lista");
  try {
    const nomeArquivo = `videos/${Date.now()}_${tel}.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("veiculos")
      .upload(nomeArquivo, req.file.buffer, {
        contentType: req.file.mimetype || "video/mp4",
        upsert: false
      });
    if (uploadError) throw new Error("Erro no upload: " + uploadError.message);

    const { data: urlData } = supabase.storage.from("veiculos").getPublicUrl(nomeArquivo);
    const videoUrl = urlData.publicUrl;
    console.log(`[Vídeo] Upload concluído: ${videoUrl}`);

    const corpo = {
      messaging_product: "whatsapp",
      to: tel,
      type: "video",
      video: { link: videoUrl }
    };
    if (legenda) corpo.video.caption = legenda;
    await enviarWhatsApp(tel, corpo);

    await salvarMensagem(tel, "intervencao", `[Vídeo enviado: ${legenda || videoUrl}]`);
    if (!conversas[tel]) conversas[tel] = [];
    conversas[tel].push({ role: "assistant", content: `[Sistema: vídeo enviado pelo consultor via painel]` });
    console.log(`[Vídeo] ✅ Enviado para ${tel}`);
    res.redirect("/painel/chat/" + tel);
  } catch(e) {
    console.error("[Vídeo] Erro:", e.message);
    res.redirect("/painel/chat/" + tel + "?erro=1");
  }
});

app.post("/painel/enviar", async (req, res) => {
  const { tel, texto } = req.body;
  console.log(`[Painel] Tentando enviar pra ${tel}: "${texto}"`);
  if (tel && texto) {
    try {
      const resp = await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to: tel, text: { body: texto } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
      );
      console.log(`[Painel] ✅ Enviado! Resposta Meta:`, JSON.stringify(resp.data));
      const wamid = resp.data?.messages?.[0]?.id || null;
      if (!conversas[tel]) conversas[tel] = [];
      conversas[tel].push({ role: "assistant", content: texto });
      await salvarMensagem(tel, "intervencao", texto, wamid);
      await marcarIntervencaoManual(tel);
    } catch(e) {
      console.error("[Painel] ❌ Erro enviar:", e.message);
      if (e.response) console.error("[Painel] Detalhe Meta:", JSON.stringify(e.response.data));
      const codigoMeta = e.response?.data?.error?.code;
      if (codigoMeta === 131047) {
        return res.redirect("/painel/chat/" + tel + "?erro=janela24h");
      }
      return res.redirect("/painel/chat/" + tel + "?erro=1");
    }
  } else {
    console.log(`[Painel] ⚠️ Dados faltando — tel: ${tel}, texto: ${texto}`);
  }
  res.redirect("/painel/chat/" + tel);
});

app.post("/painel/iniciar-contato", async (req, res) => {
  const { telefone, veiculo } = req.body;
  if (!telefone) return res.status(400).json({ erro: "Telefone obrigatório" });
  try {
    const veiculoTexto = veiculo || "nossos veículos";
    let enviou = await enviarMensagemTemplate(telefone, "boas_vindas_lead", [veiculoTexto]);
    if (!enviou) {
      enviou = await enviarMensagemTemplate(telefone, TEMPLATE_FOLLOWUP, [veiculoTexto]);
    }
    if (enviou) {
      console.log(`[Contato Manual] ✅ Template enviado para ${telefone} — ${veiculoTexto}`);
      const textoRegistro = `[Template de contato manual enviado: ${veiculoTexto}]`;
      await salvarMensagem(telefone, "intervencao", textoRegistro);
      await atualizarEstagio(telefone, "quente", veiculoTexto);
      if (!conversas[telefone]) conversas[telefone] = [];
      conversas[telefone].push({ role: "assistant", content: textoRegistro });
      res.json({ ok: true });
    } else {
      console.error(`[Contato Manual] ❌ Falha ao enviar para ${telefone}`);
      res.status(500).json({ erro: "Falha ao enviar template — verifique se o número tem WhatsApp" });
    }
  } catch(e) {
    console.error("[Contato Manual] Erro:", e.message);
    res.status(500).json({ erro: e.message });
  }
});

app.post("/painel/template", async (req, res) => {
  const { tel, veiculo } = req.body;
  if (!tel || !veiculo) return res.redirect("/painel/chat/" + (tel || ""));
  try {
    const enviou = await enviarMensagemTemplate(tel, TEMPLATE_FOLLOWUP, [veiculo]);
    if (enviou) {
      const textoRegistro = `[Template ${TEMPLATE_FOLLOWUP} enviado manualmente: ${veiculo}]`;
      if (!conversas[tel]) conversas[tel] = [];
      conversas[tel].push({ role: "assistant", content: textoRegistro });
      await salvarMensagem(tel, "intervencao", textoRegistro);
      return res.redirect("/painel/chat/" + tel);
    } else {
      return res.redirect("/painel/chat/" + tel + "?erro=1");
    }
  } catch (e) {
    console.error("[Painel] Erro ao enviar template manual:", e.message);
    return res.redirect("/painel/chat/" + tel + "?erro=1");
  }
});

app.get("/painel/mensagens/:from", async (req, res) => {
  try { res.json({ mensagens: await buscarMensagens(req.params.from) }); } catch (e) { res.json({ mensagens: [] }); }
});
app.post("/painel/visualizar", (req, res) => {
  const { from } = req.body;
  if (from) conversasVisualizadas[from] = Date.now();
  res.json({ ok: true });
});
app.post("/painel/intervencao", async (req, res) => {
  const { from, texto } = req.body;
  if (!from || !texto) return res.status(400).json({ erro: "Dados inválidos" });
  try {
    await axios.post(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: from, text: { body: texto } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    if (!conversas[from]) conversas[from] = [];
    conversas[from].push({ role: "assistant", content: texto });
    await salvarMensagem(from, "intervencao", texto);
    await marcarIntervencaoManual(from);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
app.post("/painel/aprendizado", async (req, res) => {
  const { situacao, correcao } = req.body;
  if (!situacao || !correcao) return res.status(400).json({ erro: "Dados inválidos" });
  try { await salvarAprendizado(situacao, correcao); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get("/painel/aprendizados", async (req, res) => {
  try { res.json({ aprendizados: await buscarAprendizados() }); } catch (e) { res.json({ aprendizados: [] }); }
});
app.get("/painel/simulacoes", async (req, res) => {
  try {
    const { data } = await supabase.from("simulacoes_credito").select("*").order("criado_em", { ascending: false }).limit(50);
    res.json({ simulacoes: data || [] });
  } catch (e) { res.json({ simulacoes: [] }); }
});
app.get("/painel/custo", async (req, res) => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { data: msgsCliente, count } = await supabase
      .from("mensagens")
      .select("id", { count: "exact" })
      .eq("tipo", "client")
      .gte("criado_em", inicioMes.toISOString());

    const totalMensagensCliente = count || 0;

    const SONNET_INPUT_TOKENS = 2000;
    const SONNET_OUTPUT_TOKENS = 150;
    const HAIKU_INPUT_TOKENS = 300;
    const HAIKU_OUTPUT_TOKENS = 50;

    const SONNET_INPUT_PRICE = 3.00;
    const SONNET_OUTPUT_PRICE = 15.00;
    const HAIKU_INPUT_PRICE = 0.80;
    const HAIKU_OUTPUT_PRICE = 4.00;

    const custoSonnetInput = (totalMensagensCliente * SONNET_INPUT_TOKENS / 1_000_000) * SONNET_INPUT_PRICE;
    const custoSonnetOutput = (totalMensagensCliente * SONNET_OUTPUT_TOKENS / 1_000_000) * SONNET_OUTPUT_PRICE;
    const custoHaikuInput = (totalMensagensCliente * HAIKU_INPUT_TOKENS / 1_000_000) * HAIKU_INPUT_PRICE;
    const custoHaikuOutput = (totalMensagensCliente * HAIKU_OUTPUT_TOKENS / 1_000_000) * HAIKU_OUTPUT_PRICE;

    const custoTotalUSD = custoSonnetInput + custoSonnetOutput + custoHaikuInput + custoHaikuOutput;
    const cotacaoUSDBRL = 5.50;

    res.json({
      periodo: `${inicioMes.toLocaleDateString("pt-BR")} até hoje`,
      mensagensClienteMes: totalMensagensCliente,
      custoEstimadoUSD: Number(custoTotalUSD.toFixed(2)),
      custoEstimadoBRL: Number((custoTotalUSD * cotacaoUSDBRL).toFixed(2)),
      observacao: "Estimativa baseada em tokens médios por mensagem. Valor real pode variar conforme tamanho do histórico e estoque."
    });
  } catch (e) {
    res.json({ erro: e.message, mensagensClienteMes: 0, custoEstimadoUSD: 0, custoEstimadoBRL: 0 });
  }
});
app.post("/painel/followup", async (req, res) => {
  const { from, motivo, dias } = req.body;
  if (!from || !motivo || !dias) return res.status(400).json({ erro: "Dados inválidos" });
  try { await agendarFollowUp(from, motivo, null, dias); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});
app.post("/painel/resolver", async (req, res) => {
  const { from } = req.body;
  if (conversas[from]) delete conversas[from];
  if (from) conversasVisualizadas[from] = Date.now();
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// PAINEL: SIMULAÇÃO MULTI-BANCO MANUAL
// ─────────────────────────────────────────────
// Formulário simples para o Augusto disparar uma simulação manualmente,
// sem precisar passar pelo fluxo da Sara no WhatsApp.
// Barra de abas padrão do CRM, repetida aqui pra página ficar integrada ao
// resto do painel (mesmo visual, mesma navegação) em vez de parecer um site solto.
function tabsCrm(ativa) {
  const itens = [
    { href: "/painel", label: "📋 Pipeline" },
    { href: "/painel/lista", label: "💬 Conversas" },
    { href: "/followups", label: "📅 Follow-ups" },
    { href: "/painel/simulacao-manual", label: "💳 Simulações" }
  ];
  return '<div style="padding:10px 16px;background:#0f0f0f;border-bottom:1px solid #1a1a1a;display:flex;gap:10px;align-items:center">' +
    itens.map(i => `<a href="${i.href}" style="color:${i.href === ativa ? '#f0a500' : '#888'};font-size:12px;font-weight:${i.href === ativa ? '600' : '400'};text-decoration:none">${i.label}</a>`).join('') +
    '</div>';
}

app.get("/painel/simulacao-manual", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Simulações — ${NOME_IA} CRM</title>
      <style>
        body { margin:0; font-family:-apple-system,sans-serif; background:#0a0a0a; color:#e0e0e0; }
        a { color:inherit; }
        header { background:#111; border-bottom:1px solid #222; padding:12px 16px; display:flex; align-items:center; gap:10px; }
        .conteudo { max-width:480px; margin:0 auto; padding:20px 16px; }
        h2 { margin:0 0 4px; color:#fff; font-size:18px; }
        label { display:block; margin-top:14px; font-weight:600; font-size:13px; color:#ccc; }
        input { width:100%; padding:9px; margin-top:4px; box-sizing:border-box; font-size:14px; background:#161616; border:1px solid #2a2a2a; border-radius:6px; color:#e0e0e0; }
        input:focus { outline:none; border-color:#f0a500; }
        button { margin-top:20px; padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer; background:#f0a500; color:#000; border:none; border-radius:6px; }
      </style>
    </head>
    <body>
      <header><h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">${NOME_IA} <span style="color:#f0a500">CRM</span></h1></header>
      ${tabsCrm("/painel/simulacao-manual")}
      <div class="conteudo">
        <h2>💳 Simulação Multi-Banco</h2>
        <p style="color:#888;font-size:13px;">Preenche os dados e roda a simulação nos bancos configurados (Pan, Santander, Itaú, BV). Nome é opcional — nenhum banco pede pra simular.</p>
        <form method="POST" action="/painel/simulacao-manual">
          <label>Nome completo <span style="color:#555;font-weight:400">(opcional)</span></label>
          <input name="nome">
          <label>CPF</label>
          <input name="cpf" required>
          <label>Telefone <span style="color:#555;font-weight:400">(Pan exige)</span></label>
          <input name="telefone" placeholder="(51) 99999-9999">
          <label>Data de nascimento <span style="color:#555;font-weight:400">(BV às vezes exige)</span></label>
          <input name="nascimento" placeholder="dd/mm/aaaa">
          <label>Placa do veículo <span style="color:#555;font-weight:400">(Itaú, Santander e BV exigem)</span></label>
          <input name="placa" placeholder="ABC1D23">
          <label>Valor do veículo (R$) <span style="color:#555;font-weight:400">(Santander exige)</span></label>
          <input name="veiculoValor" type="number" step="0.01">
          <label>Valor de entrada (R$)</label>
          <input name="entrada" type="number" step="0.01">
          <label>Prazo (meses)</label>
          <input name="prazoMeses" type="number">
          <button type="submit">Rodar simulação</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post("/painel/simulacao-manual", async (req, res) => {
  try {
    const { nome, cpf, telefone, nascimento, placa, veiculoValor, entrada, prazoMeses } = req.body;
    const resultados = await simularTodosBancos({
      nome: nome || null, cpf, telefone: telefone || null, nascimento: nascimento || null, placa: placa || null,
      veiculoValor: veiculoValor ? parseFloat(veiculoValor) : null,
      entrada: entrada ? parseFloat(entrada) : null,
      prazoMeses: prazoMeses ? parseInt(prazoMeses) : null
    }, null, telefone || null);

    const corStatus = (s) => s === "aprovado" ? "#4caf50" : s === "negado" ? "#f44336" : (s === "nao_configurado" || s === "dados_insuficientes") ? "#666" : "#f0a500";
    const linhas = resultados.map(r => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a;color:#fff;font-weight:600">${r.banco}</td>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a;color:${corStatus(r.status)}">${r.status}</td>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a">${r.taxa ?? "-"}</td>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a">${r.parcela ?? "-"}</td>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a">${r.cet ?? "-"}</td>
        <td style="padding:10px;border-bottom:1px solid #1a1a1a;color:#888;font-size:12px">${r.mensagem ?? "-"}</td>
      </tr>`).join("");

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Resultado — ${NOME_IA} CRM</title>
        <style>
          body { margin:0; font-family:-apple-system,sans-serif; background:#0a0a0a; color:#e0e0e0; }
          a { color:inherit; }
          header { background:#111; border-bottom:1px solid #222; padding:12px 16px; display:flex; align-items:center; gap:10px; }
          .conteudo { max-width:720px; margin:0 auto; padding:20px 16px; }
          table { border-collapse:collapse; width:100%; margin-top:16px; font-size:13px; }
          th { padding:10px; text-align:left; color:#888; font-weight:600; border-bottom:1px solid #2a2a2a; }
        </style>
      </head>
      <body>
        <header><h1 style="font-size:16px;color:#fff;font-weight:700;margin:0">${NOME_IA} <span style="color:#f0a500">CRM</span></h1></header>
        ${tabsCrm("/painel/simulacao-manual")}
        <div class="conteudo">
          <h2 style="color:#fff;font-size:18px;margin:0 0 4px">Resultado — ${nome || cpf}</h2>
          <table>
            <tr><th>Banco</th><th>Status</th><th>Taxa</th><th>Parcela</th><th>CET</th><th>Mensagem</th></tr>
            ${linhas}
          </table>
          <p style="margin-top:20px;"><a href="/painel/simulacao-manual" style="color:#f0a500;text-decoration:none;font-size:13px">← Nova simulação</a></p>
        </div>
      </body>
      </html>
    `);
  } catch (e) {
    res.status(500).send("Erro ao rodar simulação: " + e.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Servidor na porta " + PORT));

