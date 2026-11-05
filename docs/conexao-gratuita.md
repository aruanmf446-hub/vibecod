# Conexão comunitária com TikTok LIVE

## Causa encontrada

Em 05/11/2026 o Render registrou `fetchWebcastSignatureFromEulerRoute: This endpoint requires a Business plan`.

O servidor criava `TikTokLiveConnection` com `enableExtendedGiftInfo: true`. Na versão instalada 2.5.0, isso busca o catálogo com `fetchAvailableGifts()` antes do WebSocket. Essa busca usa `gift/list/` com assinatura de URL pela rota de assinatura genérica da EulerStream, sujeita ao Business. Um erro nessa etapa encerra toda a tentativa de conexão.

A conclusão anterior de que toda conexão necessariamente exigia Business era incompleta. O catálogo opcional era o primeiro bloqueio identificado; o WebSocket possui um fluxo comunitário separado.

## Correção

- `enableExtendedGiftInfo: false`: não consulta o catálogo opcional pago. O próprio evento `WebcastGiftMessage` traz `giftDetails.giftName`, `diamondCount` e `giftType`; `repeatCount` e `repeatEnd` estão no evento.
- `RoomIdRouteConfig.skipFetchRoomIdFromEulerRoute = true`: consulta sala por HTML/API do TikTok, sem recorrer à busca gerenciada paga se ambas falharem. Se falharem, a conexão informa falha em vez de fingir sucesso.
- `processInitialData: false`: não transforma o lote de histórico da conexão/reconexão em novas doações para a batalha.
- Combo nativo: `giftDetails.giftType === 1` e `repeatEnd` numérico `0/1` são respeitados. Apenas o final entra no motor; formato antigo booleano continua aceito.
- Regras, tabela de presentes, faixas de moedas, HP, times, duelos e voz permanecem como estavam. Não há dependência nova, cadastro automático, chave ou cobrança.

EulerStream continua como provedor do handshake WebSocket comunitário. Isto não elimina dependência externa nem concede acesso a serviços pagos. O fornecedor anuncia Community gratuito com limites; uma chave gratuita poderá ser necessária se os limites anônimos ou as políticas do fornecedor mudarem. Não foi criada conta nem usado cartão.

## Validação

- `npm run check` e `npm test`: 49 testes.
- Teste de regressão com a **classe real instalada**: simula apenas as respostas externas e o transporte do socket. Reproduz Business com catálogo ligado e confirma que, desligado, chega ao WebSocket sem invocar o catálogo. Confirma evento nativo com nome/valor sem `extendedGiftInfo` e nenhum presente do histórico.
- Integração do servidor simula payload nativo 2.5.0: combo de 3 rosas só contabilizado no final; 2 sorvetes de 5 moedas invocam 6 amarelos; nomes, voz, pontos e times mantidos.
- Sonda real neste workspace não conseguiu resolver sala por HTML/API. Isso não valida conexão de rede do Render nem significa que o usuário esteja offline.
- Ensaio local e controles existentes são usados para conferir jogo/voz sem enviar mensagens ou presentes ao TikTok. Captura física no PRISM e um presente real exigem uma live ativa; ensaio não é prova de doação real.

## Fontes consultadas

- [Código oficial da biblioteca: catálogo e assinatura](https://github.com/zerodytrash/TikTok-Live-Connector/blob/ts-rewrite/src/lib/web/routes/base/fetch-room-gifts.ts).
- [Documentação oficial: configuração e eventos](https://github.com/zerodytrash/TikTok-Live-Connector).
- [EulerStream: Community e rotas Business](https://www.eulerstream.com/pricing).

A publicação só deve ser considerada concluída após deploy `live` e fingerprint `aae8f792d988` no `/api/health`. Estar publicado não comprova `connected: true` nem recebimento de presente real.
