# Plano Futuro — Integração do XTTS v2 (Coqui TTS)

Status: **planejado (não implementado)**
Data do levantamento: 2026-10
Autor: agente (levantamento técnico)

---

## 1. Contexto atual

### Vozes disponíveis hoje
O Daime Motion usa **Kokoro-82M** local (`server/tts.ts`), que possui **apenas 3 vozes em português**:

| ID | Nome | Gênero |
|---|---|---|
| `pf_dora` | Dora | Feminino |
| `pm_alex` | Alex | Masculino |
| `pm_santa` | Santa | Masculino |

Decisão: **manter essas 3 vozes como padrão** e adicionar o XTTS v2 como engine opcional no futuro.

### Ambiente verificado
| Item | Valor |
|---|---|
| Python | 3.11 (`C:\Users\DJDUM\AppData\Local\Programs\Python\Python311\python.exe`) |
| `TTS` (Coqui) | **0.22.0 instalado** |
| `torch` | 2.14.1 **+cpu** (sem CUDA) |
| GPU | Intel UHD Graphics (integrada, sem CUDA) |
| CPU | Intel i3-1115G4 — 2 núcleos / 4 threads |
| RAM | ~8 GB |
| Modelo XTTS v2 | **não baixado** (só existe `tts_models--pt--cv--vits` em cache) |

### Achado importante sobre desempenho
Sem GPU dedicada e com 2 núcleos físicos, o XTTS v2 roda **somente em CPU** e será **lento** (estimativa conservadora: 3x a 10x mais lento que o tempo real). Uma narração de 10 minutos pode levar de **30 a 100+ minutos** para gerar.

Consequências de projeto:
- XTTS v2 deve ser **opcional** (não substituir o Kokoro).
- Precisa de **progresso/estimativa** na UI e timeout generoso no backend.
- Chunking é obrigatório (textos longos em blocos menores).
- Evitar geração em paralelo (RAM/CPU limitados); processar **sequencialmente**.

---

## 2. Por que XTTS v2

| Vantagem | Detalhe |
|---|---|
| Multilíngue | Suporta **português (pt-BR)** nativamente entre 17 idiomas |
| Clonagem de voz | Gera voz a partir de **um sample de referência (6–30s)** — vozes ilimitadas |
| Local/offline | Roda 100% na máquina, sem depender de rede (diferente do Edge TTS) |
| Qualidade | Alta naturalidade e prosódia |
| Licença | Coqui Public Model License (uso não comercial; revisar para uso comercial) |

| Desvantagem | Detalhe |
|---|---|
| Peso | Modelo ~1.8–2 GB de download |
| Velocidade | Muito lento em CPU (ver acima) |
| RAM | Pico de ~3–4 GB durante inferência |
| Requer sample | Precisa de áudio de referência limpo para clonar |

---

## 3. Arquitetura proposta

### 3.1 Modelo de dados de voz (engine-aware)

Adicionar `engine` ao tipo de voz:

```ts
// src/shared/types.ts
export interface TtsVoice {
  id: string;
  name: string;
  gender: "feminino" | "masculino";
  engine?: "kokoro" | "xtts";       // default: "kokoro"
  sample?: string;                  // caminho relativo do sample (só XTTS)
  note?: string;                    // ex.: "clonada", "sample 12s"
}
```

### 3.2 Roteamento no backend (`server/tts.ts`)

```
synthesizeTtsBuffer(options)
  ├─ resolve voice by id
  ├─ if engine === "kokoro" → synthesizeKokoro(...)   (fluxo atual)
  └─ if engine === "xtts"   → synthesizeXtts(...)     (novo)
```

Ambos reaproveitam:
- `normalizeTextForTts()` (limpeza de markdown/caracteres)
- `splitTextIntoChunks()` (divisão)
- concatenação com **FFmpeg** (já implementada)

### 3.3 Bridge Python do XTTS

Criar script dedicado `server/scripts/xtts_speak.py`:

```
Uso: python xtts_speak.py --text-file <txt> --out <wav> --speaker-wav <ref.wav> --language pt
```

Implementação:
```python
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
tts.tts_to_file(
    text=text,
    speaker_wav=speaker_wav,
    language="pt",
    file_path=out_wav,
)
```

Chamado via `execAsync` com timeout alto e leitura do `.wav` resultante.

### 3.4 Vozes iniciais XTTS (samples)

Criar pasta `server/voices/xtts/` com samples de referência (áudio limpo, 10–20s, sem música):

```
server/voices/xtts/
  narrador-a.wav
  narradora-b.wav
  ...
```

> ⚠️ Só usar samples com **direito de uso** (voz própria, banco de vozes licenciado, ou domínio público). Não clonar vozes de terceiros sem autorização.

### 3.5 UI (src/App.tsx)

- Agrupar o seletor de vozes por engine: **"Locais (Kokoro)"** e **"XTTS (clonagem)"**.
- Exibir aviso de tempo estimado quando engine = XTTS.
- Manter as 3 vozes Kokoro como seleção padrão.
- Botão de geração já mostra `Gerando áudio...`; adicionar texto `pode levar vários minutos no XTTS`.
- Prévia: usar snippet curto (≤ 60 caracteres) para não travar.

---

## 4. Plano de execução por fases

### Fase 0 — Preparação (30 min)
- [ ] Confirmar espaço em disco (≥ 4 GB livres).
- [ ] Baixar o modelo XTTS v2 (primeira execução baixa automaticamente, ou pré-baixar):
      `python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"`
- [ ] Medir tempo real de uma frase curta em CPU e registrar o **fator de velocidade** (baseline).
- [ ] Decidir se vale instalar `torch` com CUDA (não há GPU dedicada → provavelmente não).

### Fase 1 — Backend (2–3 h)
- [ ] Criar `server/scripts/xtts_speak.py`.
- [ ] Adicionar `synthesizeXttsBuffer()` em `server/tts.ts`.
- [ ] Estender `TtsVoice` com `engine`/`sample`.
- [ ] Registrar vozes XTTS em `ptBrVoices` (ou nova lista `xttsVoices`).
- [ ] Roteamento por engine em `synthesizeTtsBuffer`.
- [ ] Reaproveitar chunking + concatenação FFmpeg.
- [ ] Tratamento de erro claro ("modelo XTTS não encontrado", "sample inválido").

### Fase 2 — UI (1–2 h)
- [ ] Agrupar vozes por engine no modal de narração.
- [ ] Aviso de tempo/CPU para XTTS.
- [ ] Manter Kokoro como padrão.
- [ ] Ajustar contagem de "vozes disponíveis".

### Fase 3 — Samples e qualidade (1–2 h)
- [ ] Adicionar 2–4 samples de referência licenciados.
- [ ] Testar entonação em PT-BR (números, siglas, pausas).
- [ ] Ajustar `splitTextIntoChunks` para XTTS (chunks menores, ex. 400–600 caracteres, melhor prosódia e menos RAM).

### Fase 4 — Robustez (1–2 h)
- [ ] Timeout por chunk (ex. 20–30 min) e limpeza de temporários.
- [ ] Retomada/reprocessamento por bloco em caso de falha.
- [ ] Log de progresso por chunk no backend.
- [ ] Testes: `tests/tts.test.ts` para roteamento e chunking XTTS.

### Fase 5 — Documentação (30 min)
- [ ] Atualizar `docs/NARRATION_RULES.md` com seção XTTS.
- [ ] Atualizar `AGENTS.md` (novas vozes/engine).
- [ ] README técnico do bridge Python.

---

## 5. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Lentidão extrema em CPU | Alto | XTTS opcional; aviso na UI; chunks pequenos; geração em background |
| Estouro de RAM (~8 GB) | Alto | Processar 1 chunk por vez; liberar modelo entre execuções se necessário |
| Modelo não baixado / offline | Médio | Detectar e retornar erro claro com instrução de download |
| Qualidade do sample | Médio | Validar duração/ruído; documentar requisitos de sample |
| Licença (uso comercial) | Médio | Documentar restrição; não usar em produção comercial sem revisão |
| Direitos de voz clonada | Alto | Só samples próprios/licenciados; nunca clonar terceiros sem autorização |

---

## 6. Critérios de aceite

- [ ] As 3 vozes Kokoro continuam funcionando exatamente como hoje.
- [ ] É possível selecionar uma voz XTTS e gerar um MP3 completo em `assets/`.
- [ ] Textos longos (> 10k caracteres) geram sem erro (chunk + concat).
- [ ] Erros de modelo/sample retornam mensagem clara na UI.
- [ ] Nenhuma regressão nos testes existentes.
- [ ] Documentação atualizada.

---

## 7. Alternativas consideradas (e por que não agora)

| Alternativa | Situação |
|---|---|
| **Edge TTS** (`edge-tts-universal`, já instalado) | Depende de rede; teste local travou (serviço online instável/bloqueado). Descartado por ora. |
| **Coqui `tts_models/pt/cv/vits`** (já baixado) | Qualidade inferior ao Kokoro; não vale como upgrade. |
| **Piper TTS** | Boas vozes PT-BR e leve, mas exige novo binário/modelos; reavaliar no futuro. |
| **F5-TTS / Bark** | Mais pesados e/ou menos estáveis em CPU; XTTS v2 é o melhor custo/benefício local. |

---

## 8. Próximo passo recomendado

Quando for implementar: começar pela **Fase 0** (baixar modelo + medir velocidade real). Se o fator de velocidade for pior que ~10x realtime, reconsiderar e priorizar o **Piper TTS** (leve, CPU-friendly, várias vozes PT-BR) em vez do XTTS v2.
