# Comentários, times e retorno da música

## Causa confirmada da leitura incompleta

O `tiktok-live-connector` 2.5.0 instalado importa `tiktok-live-proto/v3` (0.2.4). Os exemplos antigos usam `comment`, `userId` e `giftDetails`, mas o decoder ativo entrega:

- `WebcastChatMessage.content`: texto do comentário.
- `User.id`: identidade numérica estável; `displayId`: nome de usuário.
- `WebcastGiftMessage.gift`: nome, moedas e tipo em `name`, `diamondCount` e `type`.

O nome era lido porque `nickname` existe nos dois formatos. O texto ficava vazio e os IDs caíam em `anon`, compartilhando seleção/hash de time. O narrador completava o vazio com o grito amarelo. Isso explica o relato sem precisar atribuí-lo ao Groq ou Piper.

A correção aceita os campos atuais e mantém os anteriores. Comentário vazio não é anunciado. Comentários comuns são lidos com seu texto, sem grito automático. Seleções reconhecidas confirmam o time (ex.: “Lucas comentou: 2. Entrou para os X-Men!”). Uma nova escolha de time não é descartada pelo intervalo global de leitura; os limites de texto, fila de áudio e cooldown dos reforços continuam valendo. IDs diferentes mantêm escolhas diferentes. Presentes genéricos seguem a seleção do participante, com valor e combo do schema atual. Não muda regras, faixas de moedas, HP ou motor.

O pacote direto foi fixado em 2.5.0 e `package-lock.json` registra a árvore instalada, sem dependências novas. Os testes agora codificam/decodificam mensagens usando o schema v3 real, em vez de depender só de objetos simulando o formato antigo.

## Falha de áudio reproduzida e recuperação

A música é Web Audio e a voz usa um HTMLAudio. Se o contexto da trilha for suspenso por uma disputa de sessão de áudio, o antigo `duck(false)` só aumentava o ganho; não retomava o contexto. `startMusic()` também retornava cedo quando já havia uma fonte em loop, sem tentar resume. Assim o ganho podia voltar ao normal e a música permanecer parada.

A correção retoma o contexto mesmo com a fonte existente, libera o ganho em ended/pause/erro e cancela automações antigas antes de definir o novo volume. Um temporizador limitado pela duração da fala também libera a trilha se o WebView omitir o evento ended. Bufferização longa libera o fundo até a fala voltar. Não cria loops simultâneos e não religa música silenciada de propósito.

Essa interrupção foi reproduzida no navegador suspendendo o contexto durante uma fala real do Piper. A causa exata no PRISM físico não pôde ser observada por estas ferramentas; o iOS ainda controla as permissões de áudio.

## Validação

- `npm run check` e 52 testes Node: texto literal, 2/xmen, identidade de dois usuários, persistência de time, presente no schema v3, moedas/combo e compatibilidade anterior.
- `scripts/verify-comment-audio.cjs`: WAV real para Maria e Lucas/2, texto correto e retrato azul; música suspensa durante a fala volta após ended; ao suprimir ended/pause, recuperação pelo temporizador; sinal de áudio presente, mesma fonte em loop, silêncio intencional respeitado, estado da batalha pública inalterado e sem exceções.
- Novo botão apenas em `/#teste`: **Comentário · X-Men (2)**. A produção continua sem controles. Captura: `visual-comments-blue.png`.
- Não foram enviados comentários, presentes ou mensagens ao TikTok por estas ferramentas. A validação física no PRISM/iPhone continua necessária.
