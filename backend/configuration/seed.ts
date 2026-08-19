import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../libs/database/src';
import { config } from './configuration';
import { LOGIN_ROLE } from '../libs/database/prisma/generated/enums';

(async (): Promise<void> => {
  const database = new DatabaseService(new ConfigService(config()));
  const currentDate = new Date();
  const defaultPassword = bcrypt.hashSync('123456', 10);

  const accounts = [
    {
      username: 'admin',
      password: defaultPassword,
      email: 'admin@test.com',
      role: LOGIN_ROLE.ADMIN,
    },
    {
      username: 'support',
      password: defaultPassword,
      email: 'support@test.com',
      role: LOGIN_ROLE.MASTER,
    },
    {
      username: 'user',
      password: defaultPassword,
      email: 'user@test.com',
      role: LOGIN_ROLE.USER,
    },
  ];

  await Promise.all(
    accounts.map((account) =>
      database.logins.upsert({
        where: { username: account.username },
        update: {},
        create: {
          ...account,
          created_at: currentDate,
        },
      }),
    ),
  );

  await database.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
