# Reformulação visual dos personagens

## Inspeção e escopo

Base inspecionada: `main`, commit `38e91b0`. Projeto vanilla HTML/CSS/JavaScript, Express e Socket.IO. Arena em Canvas 2D (`public/game.js`, 540×650), ajustada pelo CSS existente. O layout do código é diferente da imagem de referência fornecida; a interface real foi preservada integralmente.

Antes: quatro modelos de retângulos, diferenciados por cor e pequenos acessórios. As figuras são animações de apresentação no cliente, sem HP, colisões, IA ou ataques individuais. O servidor calcula as regras e emite `attack`, `likes`, `power`, `win` e `reset`. O Canvas cria 7 unidades paradas de cada time no início e 6 no reset, invoca reforços e remove as investidas nos limites/TTL existentes. Esses números, limites, velocidades e eventos foram preservados.

## Implementação

- `public/assets/characters/`: 14 SVGs originais, transparentes e locais, com desenho próprio, contorno, gradientes e equipamento individual. Nenhum serviço de imagens ou dependência de runtime nova.
- `public/characters.js`: catálogo com ID, time, recurso, animações, escala visual e efeito; preload das imagens reutilizadas pelo Canvas; desenho e efeitos leves, sem filtros ou emissão adicional de partículas.
- `public/game.js`: substituição exclusiva do modelo visual antigo e seleção cíclica das aparências de cada time. `visualSlot` organiza somente o desenho das unidades paradas ao lado das torres, evitando sobreposição. As coordenadas lógicas e os caminhos das investidas não mudam. Os 14 designs não são forçados simultaneamente.
- `public/index.html`: carrega o catálogo antes do renderer e usa um dos assets locais como favicon (evita o 404 automático do navegador).
- `tests/characters.test.mjs`: catálogo 8/6, recursos distintos, renderização sem mutação e invariantes das invocações/movimento/limite.
- `scripts/verify-characters.cjs`: QA opcional em Chromium/Playwright, sem adicionar dependência ao jogo.

### Aparências

| Time | ID | Recurso/efeito |
| --- | --- | --- |
| Flor / amarelo | giant_green | Gigante, punhos e impacto |
| Flor / amarelo | thunder_warrior | Armadura, capa, machado e raios |
| Flor / amarelo | tech_armor | Armadura vermelha, reator e propulsores |
| Flor / amarelo | web_hero | Máscara, pose acrobática e fios |
| Flor / amarelo | cosmic_warrior | Cabelos loiros, traje espacial e energia dourada |
| Flor / amarelo | shield_soldier | Equipamento tático e escudo hexagonal |
| Flor / amarelo | electric_spy | Cabelos ruivos, traje preto e braceletes elétricos |
| Flor / amarelo | size_scientist | Capacete prateado, antenas e pulso cosmético de escala |
| Rosa / azul | blue_beast | Corpo baixo e largo, presas e garras |
| Rosa / azul | optic_soldier | Visor horizontal e rajada vermelha |
| Rosa / azul | telekinetic_woman | Traje verde, aura e fragmentos orbitais |
| Rosa / azul | claw_warrior | Corpo compacto, barba e lâminas |
| Rosa / azul | storm_woman | Cabelos brancos, capa, vento e raios |
| Rosa / azul | energy_absorber | Mecha branca, luvas e energia verde |

Cada recurso usa `/assets/characters/<ID>.svg`. A mudança de tamanho e a energia de absorção são apenas visuais.

## Animações e limites

Idle: respiração/balanço discreto. Movimento: balanço e inclinação acompanhando a trajetória original. Ataque: inclinação e efeito no trecho final da investida já existente; não produz dano adicional. Derrota: pose e transparência na vitória do adversário, utilizando `state.winner` existente. As animações adicionais respeitam `prefers-reduced-motion`.

Não existe estado de recebimento de dano por unidade no jogo original; não foi criado um evento fictício nem um sistema de combate paralelo. Os ataques de punhos, garras e armas usam poses e rastros do sprite completo, não um rig com membros independentes. A ilustração vetorial é uma interpretação original da direção artística, não uma reprodução pixel a pixel do acabamento pintado da referência.

O backend, integração TikTok, CSS, arena, torres, HP, controles, regras, rankings e transmissão não foram alterados. A live real não foi conectada neste ambiente. O teste de carga em Chromium não substitui medição em celulares físicos ou durante transmissão.

## Validação

- `npm test`: 6 testes passaram (3 existentes + 3 novos).
- `npm run check` e `node --check public/characters.js`: passaram.
- QA Chromium: todos os controles locais, HP, pontos, energia, ranking, vitória e reset; cinco viewports (360×640, 390×844, 720×1280, 768×1024 e 1440×900), animação, ausência de overflow horizontal e modo de movimento reduzido.
- Carga visual até o limite de 110 unidades: medição em `browser-results.json`.
- Console, exceções e requests: resultado detalhado em `browser-results.json`.
- Capturas reais antes/depois em `before-mobile.png`, `after-mobile.png`, `before-desktop.png`, `after-desktop.png`; o “antes” renderiza o JS do commit-base em navegador local. `after-battle.png` mostra uma investida. `characters-preview.png` é uma galeria dos SVGs reais, separada da partida.

Para repetir o QA: inicie `npm start`; em outro terminal use `PLAYWRIGHT_MODULE=/caminho/para/playwright node scripts/verify-characters.cjs` (Chromium padrão em `/usr/bin/chromium`, ajustável por `CHROMIUM_PATH`). A dependência Playwright é somente da ferramenta de validação, não do aplicativo.

Nenhuma URL de produção foi identificada no repositório atual. Deploy não confirmado.
