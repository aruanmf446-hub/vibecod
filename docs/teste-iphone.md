# Ensaio no iPhone, sem live e sem pagar presente

Abra **https://batalha-torres.onrender.com/#teste** no Safari ou no widget Web do PRISM. Alternativa: segure o título do jogo por 2 segundos. O painel de botões só aparece no modo de ensaio; o link normal permanece sem esses controles.

O ensaio é **isolado neste aparelho**. O mesmo `Battle` do servidor é usado localmente para demonstrar unidades, duelos e vitória, mas nenhum comando é enviado para alterar o jogo público. O servidor só fornece mensagens fixas e áudio em cache. Não precisa de PIN/senha porque não dá acesso a controles da batalha pública. A rota de simulação antiga `/api/demo` continua bloqueada na hospedagem.

## Como testar

1. Voz e Mostrar comentários vêm habilitados. O navegador tenta iniciar a voz automaticamente.
2. Se o iPhone bloquear o áudio, toque uma vez em qualquer botão de teste ou em Liberar voz. Nenhum código pode garantir áudio automático quando iOS/PRISM exige gesto. A primeira preparação pode levar cerca de 20–30 segundos no Free.
3. **Rosa · Lucas**: personagem azul, balão agradecendo Lucas, voz brasileira e combatente azul.
4. **Sorvete · Lucas**: personagem amarelo, agradecimento e combatente amarelo.
5. **Estrela · Júnior**: exemplo de presente genérico para o time azul, como se Júnior tivesse escolhido esse time. Em eventos reais, presentes genéricos continuam seguindo o time do participante.
6. **Comentário · Maria**: balão e voz de um comentário de exemplo, sem invocar unidade.
7. **Reforços**: adicionam 19 combatentes do time, respeitando a fila e limite do mesmo motor.
8. **Curtidas**: quatro toques ativam o modo poder do ensaio.
9. **Testar vitória**: reduz a torre azul para 8 HP SOMENTE no ensaio e cria combatentes amarelos; eles avançam, atacam e ganham pelo motor normal. Após 10 segundos o ensaio reinicia.
10. **Limpar ensaio**: limpa só o teste local. **Sair**: retorna à batalha pública sem recarregar o áudio.

Antes de transmitir a partida real, sair do ensaio ou usar https://batalha-torres.onrender.com/ sem `#teste`. Nunca confundir o selo EN​​SAIO com uma doação recebida. Se o widget do PRISM não permitir interagir com a página, testar no Safari e verificar as opções de interação/áudio do widget no aplicativo. Captura de áudio pelo RTMP ainda deve ser conferida em outro aparelho.

## O que prova funcionamento e o que não prova

O ensaio verifica imagem, personagens, fila, duelos, balões, Piper, áudio no navegador e resultado. **Não comprova que o TikTok está conectado.** O painel mostra separadamente a conta configurada e o estado da conexão real.

O servidor continua identificando comentários/presentes pela biblioteca `tiktok-live-connector`; PRISM apenas transmite a página. Rosa/Sorvete têm time próprio; demais presentes seguem o time escolhido/atribuído. Combos só invocam e agradecem no evento final. Teste automatizado injeta eventos na conexão simulada da biblioteca para confirmar nome, presente, quantidade, time e agradecimento. A confirmação real exige conta pública ao vivo e um evento real recebido; sem isso não se deve prometer que a integração da live foi validada.

## Implementação e validação

- `public/rehearsal.mjs`: orquestra o ensaio, recebendo o mesmo `Battle` do servidor. Arquivo do motor é servido por GET em `/testing/battle.mjs`; o motor original não mudou.
- `/api/rehearsal/:kind`: quatro fixtures fixas (rosa/flor/estrela/comentário), formatadas pela mesma função dos anúncios reais. Não recebe texto livre, não chama Groq e não altera HP/unidades/pontos/counters da live. Áudios são gerados uma vez e compartilhados em cache.
- Voz desejada desde o início, tentativa automática e aviso claro quando autoplay é bloqueado. Primeira interação libera a mídia; usuário ainda pode silenciar.
- Comentários marcados inicialmente e Piper habilitado para comentários no servidor por padrão, com amostragem de 5 segundos/fila limitada para evitar sobreposição. `PIPER_COMMENTS=false` permite desligar explicitamente.
- `npm test`: 37 testes passaram. `npm run check` passou. QA de batalha existente passou; cancelamento intencional de mídia na navegação é distinguido de erro real de rede.
- QA do ensaio em Chromium com política de gesto obrigatório: rosa/flor/estrela/comentário, reprodução real WAV, modo poder, vitória/reinício; comparou estado/contadores da batalha principal antes/depois e confirmou nenhuma mutação, `/api/demo` 403, sem overflow/exceções.
- Repetir com servidor hospedado simulado (`DISABLE_DEMO=true`, Piper habilitado): `GAME_URL=http://127.0.0.1:3012 PLAYWRIGHT_MODULE=/caminho/playwright node scripts/verify-phone-rehearsal.cjs`. Requer ausência de eventos reais para comparar snapshots idênticos.
- Captura real de teste: `phone-rehearsal.png`. iPhone físico e PRISM não foram controlados neste ambiente.

## Confirmação no endereço principal

Publicado em 05/11/2026, deploy Render `dep-dblt9plckfvc739r0d0g`, commit `ecc9a27de059ef8a1a015b8b37176b75117c66a8`, fingerprint `801dd3ccb954`. `/api/health` confirmou `narration.enabled=true` e `narration.comments=true`.

O QA remoto foi repetido contra https://batalha-torres.onrender.com e passou: abertura por long-press, presentes fixos, comentário com reprodução real do Piper, modos poder/vitória/reinício, saída do ensaio; HP, unidades, battleId e contadores reais do principal idênticos antes/depois. `/api/demo` continuou 403. Sem overflow ou exceções JavaScript. O script agora suporta o proxy do ambiente no contexto do navegador/API; nenhuma credencial é persistida.

A conta configurada continuava desconectada e os contadores reais estavam zerados. Não foram enviados presentes pagos ou mensagens ao TikTok. A consulta HTTP pública ao TikTok não forneceu metadados de live verificáveis, então não foi usada como prova de conta offline/online. Falta confirmação da conta pelo operador e teste com a transmissão TikTok ativa. O app PRISM/iPhone físico não foi controlado por estas ferramentas; a reprodução/captura final deve ser conferida no próprio aparelho.
