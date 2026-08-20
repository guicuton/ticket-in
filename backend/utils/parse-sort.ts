interface IParseSort {
  column: string;
  direction: 'asc' | 'desc';
}

export const parseSort = (rawSort: string): IParseSort => {
  const isDescending = rawSort.startsWith('-');

  return {
    column: isDescending ? rawSort.slice(1) : rawSort,
    direction: isDescending ? 'desc' : 'asc',
  };
};
