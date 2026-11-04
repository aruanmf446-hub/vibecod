# Duelos contínuos alimentados por presentes

A pedido do usuário, esta entrega amplia o escopo anterior, que era somente visual: agora há combate real no servidor e vitória por destruição da torre, sem temporizador ou número de rodada.

## Funcionamento

- Flor invoca combatentes amarelos e Rosa invoca azuis. A atribuição de outros presentes ao time escolhido no chat foi mantida, assim como o reforço de chat e os likes.
- Presente de 1 diamante: 1 combatente. Presentes maiores usam o valor existente do jogo (8 pontos por diamante, limitado a 450), com `ceil(valor/8)` combatentes, até 57 por evento. Os botões de reforço de 150 pontos invocam 19.
- Até 12 combatentes ativos por time, distribuídos em três corredores. Os excedentes aguardam em fila, sem descarte por limite de renderização. As 8/6 aparências continuam exclusivas de cada time.
- Cada combatente tem 40 HP, golpe de 10, intervalo de 700 ms e ataque à torre de 8. O modo poder existente aumenta o dano em 50% para ambos os times. As aparências têm o mesmo atributo de combate; seus poderes permanecem efeitos visuais.
- Os adversários param e se enfrentam; os sobreviventes avançam até a torre. Doar não remove HP da torre imediatamente. Novos defensores podem entrar mesmo sob cerco.
- Os pontos/rankings representam o apoio recebido e são creditados na invocação, preservando a fórmula anterior.
- Somente a queda de uma torre encerra a batalha. Duas torres caindo no mesmo passo resultam em empate. Sem reforços e combatentes, o jogo aguarda os participantes, sem inventar um vencedor.
- Reinício automático após 10 segundos, sem numeração. Presentes enviados após o resultado aguardam a próxima batalha. `AUTO_RESTART=false` permite aguardar reinício manual. O reinício mantém a conexão e o contador de espectadores e cancela um reinício automático pendente.

## Arquivos

- Criado `battle.mjs`: simulação independente, filas, movimento, golpes simultâneos e decisão do vencedor.
- Modificado `server.mjs`: usa a simulação em passos fixos de 100 ms; publica o estado autoritativo; substitui dano direto e rodadas por batalhas contínuas. Os handlers/conexão TikTok, mapeamento de presentes e restrição local do simulador permanecem.
- Modificados `public/game.js` e `public/characters.js`: interpolação do estado recebido, barras de HP individuais, poses de ataque, dano e derrota; reconexão recupera o exército existente. Navegadores não calculam o resultado.
- Modificados `public/index.html` e `public/style.css`: troca do cronômetro/rodada pelo status sem limite, contador em campo e fila. Arena e torres mantêm enquadramento e posições.
- `package.json`: verificação sintática inclui os módulos novos. Sem novas dependências.
- `.env.exemplo` e `README.md`: configuração e regras atualizadas.
- Testes: `tests/battle.test.mjs`, `tests/server-flow.test.mjs`, `tests/characters.test.mjs`; QA atualizado em `scripts/verify-characters.cjs`.

## Validação executada

- `npm test`: 19 testes passaram. Incluem duelos simétricos, empate, fila, defesa durante cerco, vitória, espera sem limite, combo de presente contado no final, atribuição por time, presentes na comemoração, reinício manual/automático e preservação da conexão.
- `npm run check`: passou, incluindo servidor, motor de combate e renderizadores.
- Chromium real, servidor local: todos os seis controles, invocação sem dano instantâneo, combate entre unidades, dano na torre, vitória efetiva, reinício automático e preservação de presente recebido no intervalo.
- Dois navegadores receberam snapshots idênticos da mesma batalha; recarregar a página recuperou os combatentes.
- Cinco viewports: 360×640, 390×844, 720×1280, 768×1024 e 1440×900; sem overflow horizontal. Movimento reduzido verificado sem exceções.
- Nenhum erro de console, exceção ou falha de carregamento observado. Resultado em `duels-browser-results.json`.
- Capturas reais da versão atual: `duels-mobile.png`, `duels-desktop.png` e `duels-arena.png`. As demais capturas da pasta são históricas da etapa visual anterior.

Repetição: `npm start` e, em outro terminal, `PLAYWRIGHT_MODULE=/caminho/para/playwright node scripts/verify-characters.cjs`. `GAME_URL` e `CHROMIUM_PATH` são opcionais para o QA. Ele usa o simulador em localhost e deve rodar sem live real conectada.

## Limitações

Não foram testados iPhone físico, PRISM, RTMP ou uma live TikTok real. A biblioteca comunitária de conexão permanece a mesma. O estado e as filas ficam em memória: reiniciar o processo do servidor começa uma nova batalha. O equilíbrio usa atributos iguais para os 14 designs; não foram implementados poderes individuais que mudem as regras. A publicação do código no GitHub não comprova deploy em produção; o servidor da transmissão precisa atualizar o código e reiniciar.
