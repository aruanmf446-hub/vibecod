# Piper e voz pt-BR

A configuração opcional instala Piper 1.8.0 (GPL-3.0) e ONNX Runtime 1.31.1 no build; não copia os modelos para o repositório.

- Piper, código-fonte e licença: https://github.com/OHF-Voice/piper1-gpl
- Voz: `pt_BR-faber-medium`, 22.050 Hz, 1 locutor.
- Modelo/configuração: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber/medium
- Model card: https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD
- Segundo o model card consultado, o dataset é CC0, proveniente de OHF-Voice/voice-datasets; treinamento ajustado de lessac medium.

O áudio de exemplo em docs/piper-example.wav foi gerado neste projeto, em CPU, sem voz de ator ou personagem oficial. Ao redistribuir imagens/container ou alterar o motor, preservar licenças e cumprir as obrigações dos componentes distribuídos. A fala é uma voz genérica brasileira, não uma imitação de vozes oficiais dos personagens.
