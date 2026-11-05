# Voz brasileira com Piper, sem API paga

A voz é `pt_BR-faber-medium`, do Piper, gerada em CPU no próprio servidor. Sem cartão, chave de TTS ou cobrança por frase. Isso não altera as condições ou limites do provedor de hospedagem. Groq é opcional para escolher frases e pode ficar desligado (chave vazia).

## O que está pronto no branch de prévia

- `scripts/piper_worker.py`: modelo carregado uma vez, um thread de inferência e entrada JSON pelo stdin. Não usa comandos shell nem caminhos enviados por espectadores.
- `narration.mjs`: até 6 pedidos pendentes, timeout com retorno para legenda, até 24 WAVs em memória, validade de 5 minutos e tamanho máximo de 2 MB por clip. Nenhuma rota aceita texto arbitrário para sintetizar.
- `server.mjs`: prepara áudio uma vez por anúncio, compartilhado por todos os espectadores, e serve `GET /api/narration/:id`. Regras e motor da batalha não mudaram.
- Navegador: botão **Ativar voz / Silenciar voz**, separado dos efeitos. Um elemento de áudio é liberado pelo toque e reutilizado. Voz e balão começam juntos; a exibição acompanha a duração do áudio. Efeitos ficam mais baixos durante a fala. Ocultar a página interrompe a voz e exige novo toque ao voltar.
- Presentes narrados por padrão. Comentários só geram voz com `PIPER_COMMENTS=true` no servidor e só são exibidos/tocados no navegador que marcou Mostrar comentários. Continuam amostrados e limitados; em sobrecarga alguns avisos ficam só em texto, sem perder doações no combate.
- Se Python, modelo ou geração falharem, a legenda continua. Não há fallback para API paga ou voz do navegador.

## Ouvir antes de publicar

Abra [piper-example.wav](piper-example.wav). A frase de exemplo é fictícia: “Obrigado, Lucas, pela rosa! A mim, meus X-Men!”. A voz é brasileira genérica, sem imitação de ator/personagem oficial.

## Instalação local em Linux

```bash
python3 -m venv .venv-piper
.venv-piper/bin/pip install -r scripts/piper-requirements.txt
.venv-piper/bin/python -m piper.download_voices pt_BR-faber-medium --data-dir /tmp/piper-voices
PIPER_ENABLED=true PIPER_PYTHON="$PWD/.venv-piper/bin/python" PIPER_MODEL=/tmp/piper-voices/pt_BR-faber-medium.onnx npm start
```

O worker atual usa `resource` do Linux. Windows nativo não foi testado; usar Docker/WSL para a preparação local. Sem Piper ativado, o caminho Node anterior continua funcionando.

## Pacote Docker para testar no Render

O Dockerfile inclui Node 24, Python, Piper 1.8.0, ONNX Runtime 1.31.1 e o modelo, baixado somente durante o build. O processo roda como usuário sem privilégios. O modelo não está no GitHub e a página não baixa seus 61 MB: só recebe pequenos WAVs gerados. `.dockerignore` exclui `.env`, `.git`, logs e arquivos ZIP. Um mount opcional `build_ca` atende proxies corporativos; não é necessário no Render comum e não entra na imagem.

Para teste local:

```bash
docker build -t tower-piper-preview .
docker run --rm -p 3000:3000 -e PORT=3000 -e PIPER_ENABLED=true tower-piper-preview
```

No Render, preparar primeiro um **Web Service de teste**, runtime **Docker**, apontado ao branch `visual-polish`, e selecionar o plano Free se disponível na conta. Sem criar banco, disco, worker pago ou API de voz. Não trocar o branch/runtime do serviço da live durante transmissão. Não foi criado nem publicado um serviço no Render nesta etapa.

Configuração:

```env
PIPER_ENABLED=true
PIPER_PYTHON=/opt/piper/venv/bin/python
PIPER_MODEL=/opt/piper/voices/pt_BR-faber-medium.onnx
PIPER_COMMENTS=false
DISABLE_DEMO=true
```

O Dockerfile já define as três primeiras variáveis. Copiar manualmente apenas as configurações necessárias da live no painel do Render, sem expor credenciais. Não presumir que o serviço nativo Node existente passa a usar Docker ao adicionar o arquivo. Endereço do novo preview deve ser conferido antes de ser colocado no PRISM.

## Teste do container

A imagem Docker foi construída e o jogo rodou como usuário `node`, com modelo legível e WAV real reproduzido no Chromium. O comando solicitou 512 MB e 0,1 CPU, mas a inspeção mostrou que o ambiente de nuvem não aplicou esses cgroups: o limite visível continuou 8 GB/2 CPUs. Portanto esse ensaio NÃO comprova caber no plano Free. O benchmark por processo abaixo é a medida válida; medir memória/latência no serviço de preview real do Render antes de migrar a live.

## Medidas e validação

Benchmark real, Linux CPU deste ambiente, não Render Free: carregamento/primeira frase 2.147 ms; frases seguintes 325/408 ms; WAVs de 3,2 a 4,3 segundos; pico do processo Python 187,8 MB. Resultados em `piper-benchmark.json`. Isso não é o consumo total do servidor: Node, cache e sistema usam memória adicional. O desempenho no Render depende de CPU compartilhada, suspensão e limites do plano.

Os testes de navegador conferem WAV real, avanço do tempo de reprodução, retrato/time corretos, silenciar e 404 para clip inexistente. Rodar também `npm run check`, `node --check narration.mjs`, `node --check announcer.mjs` e `npm test` (31 testes). O QA existente de combate foi executado com Piper habilitado, sem mudar regras. `visual-piper.png` mostra a prévia real.

Ainda pendentes: serviço de preview real no Render, iPhone físico, interação no widget Web do PRISM, captura do áudio no RTMP e live TikTok real. Confirmar o áudio assistindo por outro aparelho: ouvir no navegador sozinho não comprova que foi transmitido. A produção permanece intacta.

Licenças e origem: [PIPER_NOTICES.md](../PIPER_NOTICES.md).
