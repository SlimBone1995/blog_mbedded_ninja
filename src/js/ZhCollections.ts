import { getCollection, type CollectionEntry } from 'astro:content';

export type PageEntry = CollectionEntry<'pages'>;
export type ZhPageEntry = CollectionEntry<'pagesZh'>;

/**
 * A routable Chinese page. Every English page gets a route under /zh/, even
 * when no translation exists yet; in that case `zhEntry` is undefined and the
 * route renders the English entry with a fallback notice.
 */
export interface ZhRoute {
  /** Same id as the English entry, e.g. "electronics/.../i2c-communication-protocol". */
  slug: string;
  enEntry: PageEntry;
  zhEntry?: ZhPageEntry;
}

/**
 * The glob loader slugifies path segments, so `index.zh.mdx` becomes
 * `indexzh` in the entry id. Normalize it back to the English id:
 *   "a/b/indexzh" -> "a/b"
 *   "indexzh"     -> "index"
 *   "foozh"       -> "foo"
 */
export function normalizeZhId(id: string): string {
  return id.replace(/zh$/, '').replace(/\/index$/, '');
}

/**
 * Returns one route for every English page, paired with its translation when
 * one exists.
 */
export async function getZhRoutes(): Promise<ZhRoute[]> {
  const [enPages, zhPages] = await Promise.all([
    getCollection('pages'),
    getCollection('pagesZh'),
  ]);

  const zhById = new Map(
    zhPages.map((entry) => [normalizeZhId(entry.id), entry]),
  );

  return enPages.map((enEntry) => ({
    slug: enEntry.id,
    enEntry,
    zhEntry: zhById.get(enEntry.id),
  }));
}

/** Title shown in the Chinese sidebar/breadcrumb, falling back to English. */
export function zhTitle(route: ZhRoute): string {
  return route.zhEntry?.data.title ?? route.enEntry.data.title;
}
