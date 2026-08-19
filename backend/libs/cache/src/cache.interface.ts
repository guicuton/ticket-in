export interface CacheGet {
  key: string;
  item: string;
}

export interface CacheSet {
  key: string;
  item?: string;
  data: unknown;
  ttl?: string | number;
}
