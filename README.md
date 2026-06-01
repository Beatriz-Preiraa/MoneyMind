# MoneyMind — Backend API

API REST do sistema de controle financeiro pessoal MoneyMind.
Desenvolvida com TypeScript, Node.js, Express e PostgreSQL.

## Tecnologias

- Node.js + TypeScript
- Express
- PostgreSQL (banco de dados)
- JWT (autenticacao)
- Swagger (documentacao)
- bcryptjs (criptografia de senhas)

## Como rodar localmente

### 1. Pre-requisitos

- Node.js 18 ou superior instalado
- PostgreSQL instalado e rodando
- Um banco de dados criado (ex: `moneymind`)

### 2. Instalar dependencias

```bash
cd moneymind-backend
npm install
```

### 3. Configurar variaveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com os dados do seu banco de dados local.

### 4. Criar as tabelas no banco

```bash
npm run db:migrate
```

### 5. Rodar em modo desenvolvimento

```bash
npm run dev
```

O servidor vai iniciar em `http://localhost:3333`.
A documentacao Swagger estara em `http://localhost:3333/api/docs`.

## Endpoints principais

| Metodo | Rota                         | Descricao                        |
|--------|------------------------------|----------------------------------|
| POST   | /api/auth/register           | Cria nova conta                  |
| POST   | /api/auth/login              | Login — retorna token JWT        |
| GET    | /api/auth/me                 | Dados do usuario autenticado     |
| GET    | /api/transactions            | Lista transacoes (com filtros)   |
| POST   | /api/transactions            | Cria transacao                   |
| PUT    | /api/transactions/:id        | Atualiza transacao               |
| DELETE | /api/transactions/:id        | Remove transacao                 |
| GET    | /api/dashboard/summary       | Dados do dashboard               |
| GET    | /api/dashboard/suggestions   | Sugestoes de economia            |
| GET    | /api/categories              | Lista categorias                 |
| POST   | /api/categories              | Cria categoria                   |
| DELETE | /api/categories/:id          | Remove categoria                 |

## Autenticacao

Todas as rotas (exceto `/api/auth/login` e `/api/auth/register`) exigem o cabeçalho HTTP de autorização abaixo:

```http
Authorization: Bearer <seu_token_jwt>

O token e retornado no login e tem validade de 7 dias.

```

## Estrutura do projeto

```
src/
  config/
    database.ts     — conexao com o PostgreSQL
    migrate.ts      — criacao das tabelas
    swagger.ts      — configuracao da documentacao
  controllers/
    authController.ts         — cadastro e login
    transactionController.ts  — CRUD de transacoes
    dashboardController.ts    — dados para o dashboard
    categoryController.ts     — CRUD de categorias
  middleware/
    auth.ts           — verificacao do JWT
    errorHandler.ts   — tratamento de erros
  models/
    types.ts          — tipos TypeScript do projeto
  routes/
    authRoutes.ts
    transactionRoutes.ts
    dashboardRoutes.ts
    categoryRoutes.ts
  server.ts           — ponto de entrada
```

## 🧠 Funcionalidades de Inteligência Artificial
```
O projeto utiliza um módulo híbrido de IA e Machine Learning (localizado na pasta `moneymind_ml`) para empoderar o controle financeiro do usuário:

* **Categorização Automática:** Motor em Python (`categorizer.py`) que utiliza um modelo preditivo treinado (`modelo_categorias.pkl`) para ler a descrição de uma transação e categorizá-la automaticamente (ex: "Uber" vira "Transporte").
* **Previsão de Gastos:** Algoritmo preditivo (`predictor.py`) que analisa o histórico financeiro para prever os gastos dos próximos meses.
* **Consultoria Financeira Avançada (Groq):** Sistema de processamento de mensagens (`process_message.py`) integrado à **Groq Cloud**, oferecendo insights ultravelozes e dicas personalizadas de economia baseadas no perfil do usuário.

```
