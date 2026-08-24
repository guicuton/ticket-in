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

## Melhorias

### JWT

Atualmente JWT expira em 60 minutos.
O ideal seria um TTL curto de 10~15 minutos com revalidação dinâmica conforme setado pelo usuário no momento do login.
