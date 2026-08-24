# Ticket-In

Projeto open-source desenvolvido em monorepo com infra, backend e frontend

# Tecnologias

- NestJS (Backend)
- Angular (frontend)
- Redis (Cache)
- Docker (Container)
- Postgres (Banco de dados)
- Prisma (ORM)

# Funções

- Gestão de usuários
- Usuário com níveis de acesso (ADMIN, MASTER e USER)
- Gestão de áreas
- Gestão de tickets

## Executando

### Produção

Requisito: Docker com Compose v2.

```bash
docker compose up --build -d
```

A stack sobe na ordem: Postgres e Redis, migrations, seed, backend e nginx.
A aplicação fica disponível em `http://localhost`. Nenhuma outra porta é
publicada no host — Postgres, Redis e backend só são alcançáveis dentro da
network `ticketin`.

Contas criadas pelo seed, todas com a senha `123456`:

| Usuário   | Papel  |
|-----------|--------|
| `admin`   | ADMIN  |
| `support` | MASTER |
| `user`    | USER   |

Para derrubar: `docker compose down`. Para derrubar apagando os volumes:
`docker compose down -v`.

### Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` sobe apenas Postgres e Redis em container, aguarda os
healthchecks, aplica as migrations e inicia backend e frontend na máquina com
hot reload. O Swagger fica em `http://localhost:3000/docs` — ele não é exposto
na stack de produção.

Scripts auxiliares:

| Script                     | O que faz |
|----------------------------|-----------|
| `npm run services:up`      | Sobe Postgres e Redis de desenvolvimento |
| `npm run services:down`    | Derruba os serviços de desenvolvimento |
| `npm run build`            | Gera o Prisma Client e compila backend e frontend |
| `npm run migration:deploy` | Aplica as migrations pendentes |
| `npm run migration:create` | Cria uma nova migration a partir do schema |
| `npm run migration:seed`   | Popula o banco com as contas padrão |
| `npm run prod:logs`        | Acompanha os logs da stack de produção |

## Melhorias

### JWT

Atualmente JWT expira em 60 minutos.
O ideal seria um TTL curto de 10~15 minutos com revalidação dinâmica conforme setado pelo usuário no momento do login.
