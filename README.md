# Vingadores vs X-Men — Tower Battle Fanmade

Jogo de batalha de torres **não oficial**, criado para lives interativas no TikTok. Interface em HTML Canvas, com 14 personagens chibi vetoriais originais e duelos calculados pelo servidor.

## Como usar no Windows (só com VS Code)
1. Instale **Node.js LTS** em https://nodejs.org/ (o VS Code sozinho não executa Node).
2. Baixe o ZIP deste repositório e extraia ou abra a pasta no VS Code.
3. Dê dois cliques em `INICIAR.bat` (ele instala as dependências na primeira execução).
4. Abra **http://localhost:3000**. Sem TikTok configurado, teste pelos botões de simulação na tela (somente localhost).

Para conectar a LIVE, copie `.env.exemplo` para `.env`, preencha `TIKTOK_USERNAME` **sem @**, salve e reinicie o servidor. O perfil deve estar ao vivo.

## Regras
- 🌼 **Flor/Flower** = equipe amarela **Vingadores**.
- 🌹 **Rosa/Rose** = equipe azul **X-Men**.
- Chat `1` / `vingadores` = amarelo; `2` / `xmen` = azul.
- Outros presentes ajudam a equipe escolhida no chat (ou equipe atribuída ao usuário).
- Curtidas alimentam a energia global; presentes invocam combatentes. Eles duelam e os sobreviventes atacam a torre adversária.
- Flor/Rosa de 1 diamante invoca 1 combatente; presentes maiores invocam mais, até 57 por evento (limite de valor já existente). Até 12 por time ficam ativos; os demais aguardam espaço na fila.
- Batalhas sem limite de tempo e sem número de rodada. Vence quem destruir a torre; queda simultânea das duas torres é empate.
- Reinício automático após 10 segundos. Presentes enviados nesse intervalo são guardados para a próxima batalha. Para reinício apenas manual, configure `AUTO_RESTART=false`.
- Placar e ranking continuam contando o apoio recebido; o dano das torres acontece durante o combate, não na chegada do presente.
- Sem OBS para rodar o **jogo**; a transmissão de vídeo ainda precisa ser publicada por algum sistema de LIVE (TikTok LIVE Studio/RTMP/serviço de streaming). Só o servidor Node não inicia uma transmissão.

## Live real (PRISM no iPhone)
O iPhone precisa abrir o jogo pelo IP do computador (`http://IP-DO-PC:3000`), não por `localhost`. Para saber qual versão está rodando, abra `/api/health`. Passo a passo completo e roteiro de teste: [docs/producao-prism.md](docs/producao-prism.md).

## Voz brasileira gratuita

O branch de prévia inclui Piper para gerar agradecimentos em português no próprio servidor, sem API paga. [Ouça o exemplo](docs/piper-example.wav) e veja a [instalação e testes](docs/piper.md). No iPhone, toque em **Ativar voz**. A integração precisa ser validada no Render/PRISM antes de usar na live.

## Arquivos
- `server.mjs`: Socket.IO, ciclo da batalha e recepção dos eventos TikTok
- `version.mjs`: commit e impressão digital do código exibidos em `/api/health`
- `battle.mjs`: movimento, filas, duelos, HP individual e ataques às torres
- `public/index.html`, `public/style.css`, `public/game.js`: jogo visual
- `INICIAR.bat`: iniciação automática no Windows
- `.env.exemplo`: configuração

## Testes

`npm test` e `npm run check`. [Detalhes e capturas dos duelos](docs/duels.md).

## Avisos
Projeto fanmade não afiliado à Marvel, Disney, TikTok ou ByteDance. A biblioteca de conexão TikTok é comunitária/não oficial e pode falhar ou mudar. Não há promessa de recompensa financeira, sorteio ou aposta. **Não publique `.env` nem credenciais.**
