# Piper publicado no serviço principal

Verificação em 05/11/2026, 00:39 UTC. Publicação autorizada explicitamente pelo usuário: “Joga no principal mesmo”.

- Serviço: https://batalha-torres.onrender.com
- Plano preservado: Free (512 MB); runtime Node; nenhum serviço/recurso pago criado.
- Branch: `claude/torres-production-validation-969pba`.
- Commit publicado: `e0e241dcd9febea99597db0f7cfcbaec4f065c33` (merge do PR #1).
- Deploy Render: `dep-dblsv53bc2fs7395s0l0`, status `live`, concluído às 00:37:51 UTC.
- Fingerprint confirmado em `/api/health`: `cda76f3d7a2b`.

## Conferências reais em produção

- O `npm install` executou o postinstall, instalou Piper/Python/modelo em `.piper/` e publicou no serviço existente, sem mudar seu endereço ou plano.
- `GET /api/narration/sample`: HTTP 200, 98.860 bytes, WAV PCM válido de 2,24 segundos. Primeira chamada levou 22,73 segundos, incluindo carregar o modelo no Free. Segunda chamada em cache: 0,43 segundo (isso não mede uma nova síntese).
- Playwright acessou o endereço público, tocou em Ativar voz e confirmou avanço real da reprodução, botão Silenciar voz, mute, ausência de overflow horizontal/exceções JavaScript e simulador oculto. Captura: `render-main-live.png`.
- Métrica real Render às 00:39 UTC: memória do serviço 250.712.060 bytes (aproximadamente 239 MiB) de 512 MiB. É uma observação após o teste da amostra, não teste de carga prolongada.
- Evento Render confirmou deploy concluído; não houve evento de falha de servidor na janela consultada.
- Validação anterior ao merge: 32 testes passaram; sintaxe dos módulos e instalação nativa passaram; teste local real de presente → Piper WAV → balão/reprodução/mute passou.

## O que falta conferir no iPhone

1. Atualizar a página/widget no PRISM usando o mesmo URL.
2. Tocar em Ativar voz e aguardar o primeiro carregamento (pode levar cerca de 20–30 segundos no Free).
3. Ouvir “Voz ativada. Prontos para a batalha!”.
4. Conferir o áudio da transmissão em outro aparelho, pois tocar no navegador não comprova a captura pelo PRISM/RTMP.
5. Com a live conectada, testar Flor/Rosa reais e conferir incremento de presentes/unidades e agradecimento por nome/time.

No momento da verificação, `configured=true`, `connected=false` e contadores reais de presentes/chat/likes estavam zerados. Os logs existentes indicavam falha ao obter Room ID. Não se pode concluir se a conta estava offline, se a identificação estava incorreta ou se era bloqueio da biblioteca sem uma nova verificação com a live ativa. Não foram enviados presentes pagos nem mensagens ao TikTok neste teste.

Permanecem pendentes: iPhone físico/PRISM, RTMP, doação real e teste prolongado em carga. O servidor mantém reconexão automática existente. Nenhuma senha, chave ou variável secreta foi alterada/exposta.

Este registro usa commit `[skip render]`: não faz outro deploy nem altera o commit ativo acima. Alterações só em documentação/captura não mudam o fingerprint.
