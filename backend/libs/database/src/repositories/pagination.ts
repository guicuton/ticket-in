import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';

export function emptyPaginationData(): TPaginationData {
  return {
    data: [],
    meta: {
      count: 0,
      totalOfPages: 0,
      around: [],
    },
  } as unknown as TPaginationData;
}
