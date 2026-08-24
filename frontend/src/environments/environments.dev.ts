const PATH_PREFIX = '/api/v1';

export const environment = {
  production: false,
  endpoints: {
    accounts: {
      login: `${PATH_PREFIX}/accounts/authentication`,
      list: `${PATH_PREFIX}/accounts/list`,
      create: `${PATH_PREFIX}/accounts/create`,
    },
  },
  local_storage_keys: {
    jwt: 'ticketin_jwt',
  },
};
