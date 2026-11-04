# Vingadores vs X-Men — Tower Battle Fanmade

Jogo de batalha de torres **não oficial**, criado para lives interativas no TikTok. Interface original desenhada em HTML Canvas, sem imagens, logos ou personagens oficiais.

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
- Curtidas alimentam a energia global; presentes causam dano e invocam mini-heróis.
- Partidas de 3 minutos, placar, ranking, reinício automático.
- Sem OBS para rodar o **jogo**; a transmissão de vídeo ainda precisa ser publicada por algum sistema de LIVE (TikTok LIVE Studio/RTMP/serviço de streaming). Só o servidor Node não inicia uma transmissão.

## Arquivos
- `server.mjs`: motor, Socket.IO e recepção dos eventos TikTok
- `public/index.html`, `public/style.css`, `public/game.js`: jogo visual
- `INICIAR.bat`: iniciação automática no Windows
- `.env.exemplo`: configuração

## Avisos
Projeto fanmade não afiliado à Marvel, Disney, TikTok ou ByteDance. A biblioteca de conexão TikTok é comunitária/não oficial e pode falhar ou mudar. Não há promessa de recompensa financeira, sorteio ou aposta. **Não publique `.env` nem credenciais.**
