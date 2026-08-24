export const CACHE_TTL = {
  minute: 60, // 1min
  five: 60 * 5, // 5min
  ten: 60 * 10, // 10min
  quarter: 60 * 15, // 15 minutes
  half: 60 * 30, // 30 minutes
  hour: 60 * 60, // 1 hour
  day: 60 * 60 * 24, // 1day
};

export const PAGINATION_OPTIONS = {
  aroundRange: 4,
  perPage: [5, 10, 30, 100, 300, 1000],
  compare: ['lte', 'gte', 'lt', 'gt'],
};
