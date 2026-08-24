export interface IPaginationQuery {
  per_page: number;
  sort: string;
  offset: number;
}

export interface IPaginationMetaItem {
  offset: number;
  isCurrent: boolean;
  page: number;
}

export interface IPaginationMetaBase {
  count: number;
  totalOfPages: number;
  first: IPaginationMetaItem;
  last: IPaginationMetaItem;
  previous: IPaginationMetaItem;
  around: IPaginationMetaItem[];
  next: IPaginationMetaItem;
}

export interface IPagination<Item> {
  data: Item[];
  meta: IPaginationMetaBase;
}
