# IBGE 2026 — Painel de Estudos 📚

App de estudos (PWA) para o **PSS 02/2026 do IBGE** — Analista Censitário, Webdesign e Produção Gráfica (Instituto Avalia). Funciona no celular e no computador, offline, com sincronização entre dispositivos e professor de IA integrado.

**O que tem dentro:**

- 🏠 **Painel** — countdown para a prova (30/08/2026), progresso por disciplina e geral, revisões pendentes do dia
- 📚 **Os 3 cursos completos** — Língua Portuguesa (15 aulas), Raciocínio Lógico (10) e Conhecimentos Específicos (9), com botões flutuantes de notas e dúvidas dentro de cada aula
- 📕 **Caderno de erros** — com ciclo de revisão espaçada (D+1, D+7, D+16); exercícios errados nas aulas oferecem inclusão com 1 toque
- ⏱️ **Simulados** — cronômetro + registro de resultados com verificação automática do critério de aprovação (≥24/60 e ≥1 por disciplina) e gráfico de evolução
- 📝 **Anotações por aula** — feitas dentro do curso ou no painel, sempre juntas
- 🤖 **Professor de plantão (IA)** — dentro das aulas envia automaticamente o contexto (disciplina, aula e trecho selecionado); calibrado para a banca, incluindo a trava CS6 × CC
- 🔄 **Sincronização** — via Gist secreto do GitHub; celular e computador sempre com os mesmos dados

---

## 1. Publicar no GitHub Pages (~5 min)

1. Crie uma conta no [github.com](https://github.com) (se ainda não tiver).
2. Crie um repositório novo, **público**, ex.: `ibge-estudos`.
3. Envie **todo o conteúdo desta pasta** para o repositório (arraste os arquivos na própria página do GitHub em *Add file → Upload files* — inclua as pastas `cursos/` e `icons/`).
4. No repositório: **Settings → Pages → Branch: `main` → Save**.
5. Em ~1 minuto o app estará em `https://SEU-USUARIO.github.io/ibge-estudos/`.

> O repositório é público, mas **nenhuma chave ou dado seu fica nele** — só o app e o conteúdo das aulas. Chaves ficam apenas no seu navegador; dados de estudo, num Gist secreto seu.

## 2. Instalar como app

- **Android (Chrome):** abra o site → menu ⋮ → **Adicionar à tela inicial** (ou "Instalar app").
- **iPhone (Safari):** botão compartilhar → **Adicionar à Tela de Início**.
- **Computador (Chrome/Edge):** ícone de instalação na barra de endereço → **Instalar**.

Depois de instalado, abre em janela própria e funciona offline (a IA e a sincronização, claro, precisam de internet).

## 3. Ativar a sincronização entre dispositivos

1. No GitHub: **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
2. Dê um nome (ex.: `ibge-app`), validade *No expiration* (ou até setembro/2026) e marque **somente o escopo `gist`**. Gere e copie o token.
3. No app: **⚙️ Config → Sincronização → cole o token → Conectar**. Repita nos outros dispositivos com o mesmo token.

O app cria automaticamente um Gist **secreto** chamado `ibge-study-data.json` na sua conta e mantém tudo sincronizado (a cada alteração e ao abrir o app).

> Notas de segurança: o token fica salvo só no navegador de cada dispositivo — nunca no repositório. Um Gist "secreto" não aparece em buscas nem no seu perfil, mas quem tiver a URL exata consegue ler; por isso o app guarda nele **apenas dados de estudo** (progresso, notas, erros, simulados), nunca chaves. Se um token vazar, revogue-o no GitHub em segundos.

## 4. Configurar o professor de IA

### Opção A — Google Gemini (gratuito, recomendado)

1. Acesse [aistudio.google.com](https://aistudio.google.com) → **Get API key** → crie a chave (sem cartão de crédito).
2. No app: **⚙️ Config → IA → provedor "Google Gemini"** → cole a chave → **Salvar** → **Testar conexão**.

O tier gratuito (modelo `gemini-2.5-flash`) dá centenas de perguntas por dia — mais do que suficiente. Aviso: no tier gratuito o Google pode usar os prompts para melhorar seus modelos.

### Opção B — Grok (xAI) ou outra API padrão OpenAI

1. Crie a chave em [console.x.ai](https://console.x.ai) (a API da xAI é paga, por créditos pré-comprados).
2. No app: provedor **"API compatível com OpenAI"** → Base URL `https://api.x.ai/v1`, sua chave e o modelo desejado.

> Se algum provedor bloquear chamadas feitas direto do navegador (erro de CORS no teste de conexão), a solução é um **Cloudflare Worker** gratuito servindo de ponte — nesse arranjo a chave fica no Worker, nem passa pelo navegador. Me peça que eu gero o código do Worker pronto.

A chave de IA fica salva **somente no dispositivo** (não sincroniza) — cole-a uma vez em cada aparelho.

## 5. Rodar localmente (opcional)

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` direto do disco (file://) não funciona para sincronização/IA por restrições do navegador — use o comando acima ou o GitHub Pages.

---

## Estrutura

```
index.html      → Painel do Candidato (hub)
app.js          → dados, sincronização, IA e integração com os cursos
sw.js           → service worker (offline)
manifest.json   → manifesto do PWA
icons/          → ícones do app
cursos/         → os 3 cursos HTML (com a camada do app injetada)
```

## Backup manual

**⚙️ Config → Backup** exporta/importa um JSON com todos os dados — útil como segurança extra antes da reta final.

Bons estudos! 🍀 Prova: **30/08/2026 (tarde)** · Cartão de convocação: ~24/08.
