# Produção e transmissão pelo PRISM (iPhone → RTMP → TikTok)

Verificação feita em 04/11/2026. Este documento separa três coisas que são diferentes:

1. **Código no GitHub** (`main`): o que foi enviado.
2. **Servidor do jogo**: o computador onde `npm start` está rodando. Só ele recebe os presentes da live.
3. **Vídeo da live**: o que o PRISM no iPhone envia por RTMP para o TikTok.

Enviar código ao GitHub **não atualiza** o servidor do jogo. Configurar o RTMP **não coloca** a arena no vídeo.

## Onde o jogo está hospedado

Resultado da verificação:

- O repositório não tem arquivo de hospedagem (Dockerfile, Procfile, render.yaml, vercel.json) nem fluxo de deploy. O único fluxo do GitHub Actions é o `Verificar jogo`, que só roda testes (passou no `1233d91`).
- O GitHub não registra deploys nem página publicada para este repositório.
- Na conta Vercel conectada, nenhum projeto usa este repositório. Além disso, a Vercel não serve para este jogo: ele precisa de um processo Node que fica sempre ligado (conexão TikTok + Socket.IO + batalha em memória).
- O projeto foi feito para rodar no **computador Windows** pelo `INICIAR.bat`.

Conclusão: o único lugar onde o jogo roda é o computador em que você abre o `INICIAR.bat`. Ninguém confirmou em qual versão esse computador está.

## Como confirmar a versão em execução

O servidor agora informa a própria versão:

- Ao iniciar, a janela do servidor mostra:
  `Versão: commit xxxxxxx | impressão digital xxxxxxxxxxxx | conferir em /api/health`
- No navegador do computador: `http://localhost:3000/api/health`. O retorno traz `build.commit` e `build.fingerprint`.

Como comparar:

- **Pasta clonada com Git**: `build.commit` precisa ser igual ao último commit da `main` no GitHub.
- **Pasta baixada como ZIP** (não tem `.git`): `build.commit` vem `null`. Nesse caso, compare a `build.fingerprint` com o valor publicado na seção "Versão esperada" abaixo. A impressão digital é calculada sobre `server.mjs`, `battle.mjs`, `version.mjs`, `package.json` e a pasta `public/`, e não muda se o Windows converter as quebras de linha.

### Versão esperada

| Item | Valor |
|---|---|
| Impressão digital do código | `cda76f3d7a2b` |

(Documentação e testes não entram na impressão digital, então commits que só mudam docs não alteram esse valor.)

## Como atualizar o servidor no Windows

1. Feche a janela "TOWER BATTLE - SERVIDOR" (isso encerra a batalha atual, porque o estado fica em memória).
2. Atualize a pasta:
   - com Git: `git pull origin main`;
   - sem Git: baixe de novo o ZIP da `main`, extraia e **copie o seu `.env` antigo** para a pasta nova.
3. Se o `package.json` mudou, apague `node_modules` (ou rode `npm install`).
4. Abra o `INICIAR.bat` e confira a linha `Versão:` e o `/api/health`.

## Como a arena entra no vídeo do PRISM (iPhone)

O servidor só gera a página. O PRISM precisa **capturar** essa página. Há dois caminhos no iPhone:

**A) Widget Web do PRISM** (recomendado). No modo de transmissão, abra *Widget* → *Web* e cole o endereço do jogo. A página aparece como uma camada sobre a câmera ou a cena.

**B) Transmissão de tela.** Abra o jogo no Safari do iPhone e use o modo de tela (Screencast) do PRISM. Tudo o que aparece na tela vai para a live, inclusive notificações. Ative o modo "Não perturbe".

Nos dois casos, o endereço **não** pode ser `localhost`. No iPhone, `localhost` é o próprio iPhone. Use o IP do computador na mesma rede Wi-Fi:

1. No Windows, rode `ipconfig` e anote o "Endereço IPv4" (exemplo: `192.168.0.15`).
2. No iPhone, abra `http://192.168.0.15:3000` no Safari. Se não abrir, permita o Node.js na rede privada quando o Firewall do Windows pedir.
3. Use esse mesmo endereço no widget Web do PRISM.

Fora da rede de casa (4G ou outro Wi-Fi), o iPhone não alcança o computador. Nesse caso, seria preciso hospedar o servidor num serviço com processo Node sempre ligado (por exemplo Render, Railway ou Fly.io). Isso ainda não foi feito.

Pelo IP, a página **não mostra** os botões de simulação, e o `/api/demo` responde 403. Só o computador local vê o simulador.

No Render (variável `RENDER`, definida pelo próprio Render) ou em qualquer requisição que chegue por proxy (`X-Forwarded-For`), o simulador fica sempre desligado. Para desligar em outra hospedagem, use `DISABLE_DEMO=true`. Motivo: na primeira publicação no Render, o proxy do host conectava como endereço local e os botões de simulação ficavam abertos para qualquer pessoa.

## Como os presentes reais chegam à batalha

- A conexão com o TikTok é feita **pelo servidor no computador**, com o `TIKTOK_USERNAME` do `.env`. Ela não passa pelo PRISM nem pelo RTMP.
- Ela só funciona enquanto a conta estiver **ao vivo**. Se o servidor iniciar antes da live, ele tenta de novo a cada 20 segundos.
- A biblioteca comunitária usa o serviço de assinatura Euler Stream. Sem chave, ele tem limite de uso. Se aparecerem erros de limite, crie uma chave gratuita e preencha `SIGN_API_KEY` no `.env`.
- O `/api/health` agora mostra o bloco `live`, que conta **somente eventos reais** vindos do TikTok (o simulador não entra):
  - `connectedAt`: quando a conexão foi feita;
  - `gifts`, `chats`, `likes`: quantos eventos chegaram;
  - `lastGift`: nome e diamantes do último presente;
  - `units`, `hp`, `status`: estado atual da batalha.

## Roteiro do teste com a live real

1. Computador: `.env` com `TIKTOK_USERNAME` (sem @) e `AUTO_RESTART=true`. Inicie pelo `INICIAR.bat` e confira a versão.
2. iPhone (mesmo Wi-Fi): abra `http://IP-DO-PC:3000` no Safari e confirme que a arena aparece.
3. PRISM: configure o destino RTMP do TikTok (URL e chave ficam só no app e **nunca** no repositório), adicione o widget Web com o mesmo endereço e inicie a transmissão.
4. Quando o TikTok mostrar que a live está no ar, confira no computador: o painel muda de "MODO TESTE"/offline para conectado, e `/api/health` mostra `connected: true` e `connectedAt` preenchido. A conexão pode demorar até cerca de 20 segundos.
5. Com outra conta, envie uma **Rosa** (1 diamante). Esperado: `live.gifts` sobe 1, `lastGift.name` = "Rose", `units.blue` sobe 1, um combatente azul aparece na arena e o HP da torre **não** cai na hora.
6. Envie uma **Flor/Flower**: um combatente amarelo aparece.
7. Comente `1` e depois `2`: `live.chats` sobe e o reforço do chat aparece.
8. Curta a live: `live.likes` sobe e a barra de energia enche.
9. Confira no **app do TikTok** (outro aparelho) se a arena aparece no vídeo e se o atraso é aceitável.
10. Se algo falhar, anote a hora e copie as mensagens da janela do servidor (sem a chave RTMP).

## O que foi testado nesta etapa (ambiente de nuvem, sem iPhone)

- `npm run check` e `npm test`: 20 testes passaram. Inclui um teste novo: presente vindo da conexão TikTok aparece em `/api/health`, e presente do simulador não aparece.
- Servidor real iniciado: a linha `Versão:` e o `/api/health` mostraram o commit e a impressão digital.
- Acesso pelo IP da máquina, como faria um iPhone: a página carregou (200), o `/api/demo` respondeu 403 e os botões de simulação ficaram ocultos.
- Chromium emulando iPhone 13 pelo IP: sem rolagem horizontal e sem erros na página. A página recebeu a batalha em tempo real (invocação, fila, duelos e torre azul de 1.200 para 944). Captura: `prism-iphone-ip.png`.
- O WebSocket pelo IP foi bloqueado pela rede do ambiente de nuvem, mas o servidor aceita a conexão (resposta 101 testada direto) e o Socket.IO continuou funcionando por polling.

**Não testado:** iPhone físico, app PRISM, widget Web do PRISM, RTMP, live real do TikTok, presentes reais e o computador Windows onde o jogo roda.


## Prévia visual — branch `visual-polish` (sem publicação)

Esta proposta parte de `claude/torres-production-validation-969pba`, informado como origem do Render em https://batalha-torres.onrender.com. As instruções anteriores sobre hospedagem local são um registro histórico. Não atualizar o branch de produção durante a live: revisar e integrar o PR em uma janela combinada.

Mudanças somente de apresentação: margem à direita para os controles do TikTok, cabeçalho compacto, HP e pontos maiores, rankings compactos, aviso de presente com nome/presente/reforços, faíscas e números derivados do HP recebido, tremor curto da torre, confete por time e contagem visual de reinício. Os 14 assets, torres, coordenadas do combate e servidor permanecem intactos. O contador é uma estimativa visual dos 10 segundos existentes; entrar no meio da comemoração pode mostrar um tempo diferente do restante real. O servidor continua decidindo o reinício.

Canvas com densidade limitada a 2, cenário estático em cache, partículas reaproveitadas com teto de 120 e números de dano com teto de 24. Movimento reduzido desliga partículas, tremores e giros de derrota. Não há dependências, fontes ou assets remotos novos.

QA: `npm run check`, 21 testes e script existente `scripts/verify-characters.cjs`. Capturas novas em `visual-390x844.png`, `visual-720x1280.png`, `visual-1080x1920.png` e `visual-ip.png`; comparar com `duels-mobile.png`, `duels-arena.png` e `prism-iphone-ip.png`, mantidos sem alteração. Nas três resoluções, o limite inferior da arena ficou em 472/813/1093 px, abaixo dos limites seguros estimados de 591/896/1344 px. A margem é uma aproximação: a sobreposição do TikTok varia com aparelho e modo de captura.

Não testados: iPhone físico, 60 fps em hardware móvel, PRISM, RTMP e live real. Sem deploy ou merge automático. A impressão digital da tabela acima corresponde à proposta visual, não à versão atualmente transmitida.


### Revisão do cenário conforme a referência aprovada

O céu abstrato e o piso de grade foram substituídos por um jardim de batalha verde com muralha de pedra, bandeiras botânicas dos times, tochas, rochas, vegetação e cristais. Arte vetorial original local em `public/assets/arena/garden.svg` (36 KB), sem imagens externas. A imagem é rasterizada uma vez em cache de 2×; torres e personagens não fazem parte do fundo, e suas posições/desenhos permanecem iguais. As capturas `visual-*` foram atualizadas para esta revisão. A fila foi posicionada acima da borda de pedra.


### Efeitos sonoros

Antes não existia áudio. `public/game.js` agora sintetiza efeitos originais via Web Audio para presentes, golpes, dano à torre, derrota de unidades, curtidas, modo poder, vitória/empate e reinício. Sem downloads de áudio, bibliotecas ou música contínua. Um único AudioContext é reutilizado; há limite de 12 vozes, cooldown por efeito, volume moderado e desconexão dos nós ao terminar.

O botão **Ativar som / Silenciar** libera o áudio por toque e permite interromper inclusive sons já agendados. Nada toca antes desse gesto, nem ao reconectar/recarregar. Ao ocultar a página, o áudio é interrompido; é preciso ativar de novo. Som e movimento reduzido são controles independentes.

Validação adicional em Chromium: nenhum AudioContext criado antes do toque; forma de onda real medida após ativar (pico 0,0465), sons de presente e poder, silêncio sem novas vozes depois de silenciar, um único contexto reutilizado e página sem exceções ou overflow. Captura: `visual-sound.png`. `npm test` continua com 21 testes aprovados e `npm run check` passou.

No iPhone, será necessário tocar em Ativar som em cada abertura. Não foi verificado se o widget Web do PRISM permite esse toque nem se sua configuração captura o áudio da página. A confirmação final precisa ser feita no PRISM/iPhone e na reprodução da live, sem presumir que áudio no Safari equivale a áudio transmitido.


### Personagem com balão — narração externa pendente

O pedido seguinte acrescentou um apresentador em PNG e balões de agradecimento/comentário. Após consultar https://console.groq.com/docs/text-to-speech (vozes documentadas em inglês e árabe, sem português), o usuário escolheu **serviço externo em português, com provedor a definir depois**. Portanto NÃO foi ativada voz de navegador nem integração TTS provisória. Os efeitos sonoros anteriores continuam separados. O balão mostra texto, mas ainda não fala nem movimenta a boca como se estivesse falando.

- `public/assets/announcers/yellow.png` e `blue.png`: exportações transparentes dos personagens originais já existentes, herói tecnológico e soldado óptico.
- `announcer.mjs`: agradecimento local pelo nome/presente/time. Opcionalmente, `GROQ_API_KEY` e `GROQ_MODEL` no servidor permitem ao Groq selecionar entre três frases locais de torcida. O modelo não altera o texto livre do comentário, não controla a batalha e não recebe o nome do participante. Uma requisição no máximo a cada 10 segundos, uma simultânea, timeout de 2 segundos e fallback local em falhas. Nenhum endpoint de geração foi exposto ao público; espectadores adicionais não multiplicam chamadas.
- `server.mjs`: apenas emite eventos adicionais de apresentação para presentes completos e amostra comentários a cada 5 segundos. Contagem de combo, times, HP, invocações, regras e conexão permanecem iguais. Presentes durante comemoração recebem agradecimento no recebimento, sem repetir quando a batalha reinicia.
- Cliente: fila de 8 balões, 5 segundos cada, prioriza presentes e descarta avisos antigos em excesso sem descartar unidades/doações do jogo. Comentários só aparecem ao marcar Mostrar comentários, inicialmente desligado. Texto é exibido com textContent, sem HTML executável; nomes/textos são limitados e controles/URLs removidos. Comentários crus não passam por moderação semântica: o operador decide habilitar a exibição.
- Não configurar chave no HTML/JS público; somente variável do servidor. Sem chave, as frases locais funcionam e nenhuma API é chamada. A API real Groq não foi exercitada nesta etapa por falta de credencial: testes usaram respostas simuladas, incluindo falhas, saída inválida e limite de chamadas.

Validação: 27 testes passaram, npm run check e node --check announcer.mjs passaram. QA de batalha completo passou; teste adicional com presentes reais do simulador conferiu Rosa → retrato azul/X-Men e Flor → amarelo/Vingadores, sem overflow ou exceções. Captura nova: visual-announcer.png. Para terminar a fala, escolher provedor TTS em português, configurar credencial somente no servidor e verificar desbloqueio/captura de áudio no iPhone/PRISM. Sem publicação no Render.


### Atualização: Piper brasileiro preparado

A pendência de voz externa da seção anterior foi implementada usando Piper local em CPU, sem API paga. Ver [docs/piper.md](piper.md), [ouvir exemplo](piper-example.wav) e [captura com voz](visual-piper.png). Botão Ativar voz separado dos efeitos; geração única por anúncio, cache e fila limitada. São 31 testes aprovados, QA completo do combate e teste real de WAV/reprodução no navegador. Docker construído e executado sem privilégios; os limites solicitados de CPU/memória não foram aplicados pelo ambiente de teste, portanto a viabilidade no Render Free ainda precisa ser confirmada no preview. O benchmark real do worker teve pico de 187,8 MB. Nada foi publicado ou alterado no Render.


### Publicação autorizada no serviço principal

Em 05/11/2026, o usuário autorizou usar o principal, substituindo a restrição anterior de manter tudo apenas em preview. O serviço `batalha-torres` continua no plano Free, runtime Node e mesmo URL. A documentação atual do Render confirma Python disponível no runtime Node. Assim, `npm install` executa `scripts/setup-piper.mjs` via postinstall para criar `.piper/venv` e baixar a voz no build, sem exigir mudança de runtime ou outro serviço. No Render o Piper fica ativo por padrão; `PIPER_ENABLED=false` desliga instalação/voz. Configurações da live são preservadas.

`GET /api/narration/sample` gera uma frase fixa, compartilhada e em cache por 4 minutos, sem aceitar texto e sem afetar unidades/pontos. O toque em Ativar voz reproduz essa amostra real para verificar o áudio, e mostra Preparando voz durante o carregamento. 32 testes passaram, instalação nativa e reprodução real do WAV foram verificadas localmente. A publicação deve ser confirmada pelo commit/fingerprint no /api/health e pela resposta WAV no endereço público; aprovação de merge não é confirmação de deploy.

### Estado confirmado após publicação

A versão com Piper já foi publicada no serviço principal e testada por HTTP/navegador. Relatório factual, métricas e pendências: [render-piper-live.md](render-piper-live.md). O plano continua Free. A produção não está mais limitada à versão antiga citada nos registros históricos acima.
