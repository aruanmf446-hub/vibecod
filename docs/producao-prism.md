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
| Impressão digital do código | `e427647504b9` |

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
