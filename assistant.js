/* ============================================================
   Assistente rápido (Gemini) — widget flutuante compartilhado
   entre baymax (index.html) e agentes.html
   ============================================================ */
(function(){
  // ======= CONFIGURAÇÃO DO ASSISTENTE =======
  // Cole aqui a URL do seu Cloudflare Worker (proxy seguro) — NÃO cole a chave do Gemini
  // diretamente aqui, o Google revoga chaves encontradas em repositórios públicos.
  // Veja o guia "como-conectar-gemini.md", seção "Proxy com Cloudflare Workers".
  const GEMINI_PROXY_URL_RAW = 'https://baymax-gemini-proxy.patrique-rodrigues.workers.dev';
  const GEMINI_MODEL = 'gemini-2.5-flash';
  // =======================================

  const GEMINI_PROXY_URL = GEMINI_PROXY_URL_RAW.trim().replace(/^['"]|['"]$/g, '');

  function isGeminiConfigured(){
    return GEMINI_PROXY_URL && !GEMINI_PROXY_URL.includes('COLE_A_URL_DO_SEU_WORKER_AQUI');
  }

  const SYSTEM_INSTRUCTION = 'Você é o assistente rápido do app Baymax (um organizador pessoal com tarefas em Kanban, agenda e anotações, e a Central de Agentes Toqan). Responda em português do Brasil, de forma direta, curta e útil — no máximo uns 3-4 parágrafos curtos ou uma lista objetiva. Se a pergunta for sobre como usar o app, explique de forma simples. Se for uma dúvida qualquer do dia a dia, ajude normalmente, como um assistente rápido.';

  const history = []; // { role: 'user'|'model', text }

  // ---------- injeta CSS ----------
  const style = document.createElement('style');
  style.textContent = `
    .ai-fab{
      position:fixed; bottom:24px; left:24px; z-index:998;
      width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
      background: linear-gradient(135deg, #4C3F7A, #1CA9C9); color:#fff; font-size:24px;
      box-shadow: 0 10px 24px rgba(44,42,40,0.18); display:flex; align-items:center; justify-content:center;
      transition: transform 0.2s ease;
    }
    .ai-fab:hover{ transform: scale(1.08); }
    .ai-panel{
      position:fixed; bottom:90px; left:24px; z-index:998; width:330px; max-width: calc(100vw - 48px);
      height:440px; max-height: calc(100vh - 140px); background:#fff; border-radius:22px;
      box-shadow: 0 20px 48px rgba(44,42,40,0.20); display:none; flex-direction:column; overflow:hidden;
      font-family:'Nunito', sans-serif;
    }
    .ai-panel.open{ display:flex; }
    .ai-panel-header{
      background: linear-gradient(135deg, #4C3F7A, #1CA9C9); color:#fff; padding:14px 16px;
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
    }
    .ai-panel-header-title{ font-family:'Baloo 2', sans-serif; font-weight:700; font-size:15px; }
    .ai-panel-header-sub{ font-size:10.5px; opacity:0.85; font-weight:600; margin-top:1px; }
    .ai-panel-close{ border:none; background:rgba(255,255,255,0.2); color:#fff; width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:13px; flex-shrink:0; }
    .ai-panel-close:hover{ background:rgba(255,255,255,0.35); }
    .ai-messages{ flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; background:#FAF6EF; }
    .ai-messages::-webkit-scrollbar{ width:6px; }
    .ai-messages::-webkit-scrollbar-thumb{ background:#E7EEF1; border-radius:10px; }
    .ai-empty{ color:#7A756D; font-size:12.5px; font-weight:600; text-align:center; padding:20px 10px; line-height:1.4; }
    .ai-bubble{ max-width:85%; padding:9px 13px; border-radius:16px; font-size:13px; font-weight:600; line-height:1.4; word-break:break-word; white-space:pre-wrap; }
    .ai-bubble.user{ align-self:flex-end; background:#4C3F7A; color:#fff; border-bottom-right-radius:4px; }
    .ai-bubble.model{ align-self:flex-start; background:#fff; color:#2C2A28; border:1px solid #E7EEF1; border-bottom-left-radius:4px; }
    .ai-bubble.model.error{ border-color:#E14B4B; color:#B23A3A; }
    .ai-bubble.typing{ align-self:flex-start; background:#fff; border:1px solid #E7EEF1; border-bottom-left-radius:4px; padding:11px 14px; }
    .ai-dot{ display:inline-block; width:6px; height:6px; border-radius:50%; background:#9FB2BE; margin-right:3px; animation: aiBlink 1.2s infinite ease-in-out; }
    .ai-dot:nth-child(2){ animation-delay:0.2s; }
    .ai-dot:nth-child(3){ animation-delay:0.4s; }
    @keyframes aiBlink{ 0%,80%,100%{ opacity:0.3; } 40%{ opacity:1; } }
    .ai-input-row{ display:flex; gap:8px; padding:12px; border-top:1px solid #E7EEF1; flex-shrink:0; background:#fff; }
    .ai-input{
      flex:1; border:2px solid #E7EEF1; border-radius:100px; padding:9px 15px; font-size:13px; font-weight:600;
      font-family:'Nunito', sans-serif; outline:none; transition:border-color 0.2s; min-width:0;
    }
    .ai-input:focus{ border-color:#4C3F7A; }
    .ai-send-btn{
      border:none; background:#4C3F7A; color:#fff; width:38px; height:38px; border-radius:50%; font-size:16px;
      cursor:pointer; flex-shrink:0; transition:background 0.2s;
    }
    .ai-send-btn:hover{ background:#362C5C; }
    .ai-send-btn:disabled{ opacity:0.5; cursor:default; }
  `;
  document.head.appendChild(style);

  // ---------- injeta HTML ----------
  const fab = document.createElement('button');
  fab.className = 'ai-fab';
  fab.title = 'Assistente rápido';
  fab.textContent = '✨';

  const panel = document.createElement('div');
  panel.className = 'ai-panel';
  panel.innerHTML = `
    <div class="ai-panel-header">
      <div>
        <div class="ai-panel-header-title">🤖 Assistente rápido</div>
        <div class="ai-panel-header-sub">Powered by Gemini</div>
      </div>
      <button class="ai-panel-close" id="aiPanelClose" title="Fechar">✕</button>
    </div>
    <div class="ai-messages" id="aiMessages">
      <div class="ai-empty">Pergunte algo rápido: dicas de uso do app, ajuda para organizar uma tarefa, ou qualquer dúvida do momento.</div>
    </div>
    <div class="ai-input-row">
      <input type="text" class="ai-input" id="aiInput" placeholder="Digite sua pergunta..." maxlength="500">
      <button class="ai-send-btn" id="aiSendBtn" title="Enviar">➤</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#aiMessages');
  const inputEl = panel.querySelector('#aiInput');
  const sendBtn = panel.querySelector('#aiSendBtn');
  const closeBtn = panel.querySelector('#aiPanelClose');

  function togglePanel(){
    panel.classList.toggle('open');
    if(panel.classList.contains('open')) inputEl.focus();
  }
  fab.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  function clearEmptyState(){
    const empty = messagesEl.querySelector('.ai-empty');
    if(empty) empty.remove();
  }
  function addBubble(role, text, isError){
    clearEmptyState();
    const div = document.createElement('div');
    div.className = 'ai-bubble ' + role + (isError ? ' error' : '');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }
  function addTypingIndicator(){
    clearEmptyState();
    const div = document.createElement('div');
    div.className = 'ai-bubble typing';
    div.id = 'aiTypingIndicator';
    div.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function removeTypingIndicator(){
    const el = document.getElementById('aiTypingIndicator');
    if(el) el.remove();
  }

  async function sendMessage(){
    const text = inputEl.value.trim();
    if(!text) return;

    if(!isGeminiConfigured()){
      addBubble('user', text);
      addBubble('model', '⚠️ O assistente ainda não foi configurado. É preciso publicar o proxy (Cloudflare Worker) e colar a URL dele no arquivo "assistant.js" (procure por GEMINI_PROXY_URL_RAW). Veja o guia "como-conectar-gemini.md", seção "Proxy com Cloudflare Workers".', true);
      inputEl.value = '';
      return;
    }

    addBubble('user', text);
    history.push({ role: 'user', text });
    inputEl.value = '';
    sendBtn.disabled = true;
    addTypingIndicator();

    try{
      const contents = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));
      const res = await fetch(GEMINI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.6 }
        })
      });
      removeTypingIndicator();
      if(!res.ok){
        const errText = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' — ' + errText.slice(0, 200) + '\n\nConfira se a URL do proxy está certa e se o GEMINI_API_KEY foi salvo nas variáveis do Worker (veja o guia).');
      }
      const data = await res.json();
      const reply = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
        ? data.candidates[0].content.parts.map(p => p.text || '').join('')
        : '';
      if(!reply){
        addBubble('model', '⚠️ O Gemini não retornou uma resposta de texto. Pode ser um bloqueio de segurança do próprio modelo — tente reformular a pergunta.', true);
        return;
      }
      addBubble('model', reply);
      history.push({ role: 'model', text: reply });
      if(history.length > 20) history.splice(0, history.length - 20); // mantém só as últimas trocas
    }catch(e){
      removeTypingIndicator();
      console.error(e);
      addBubble('model', '⚠️ Erro ao falar com o assistente: ' + e.message, true);
    }finally{
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => { if(e.key === 'Enter') sendMessage(); });
})();
