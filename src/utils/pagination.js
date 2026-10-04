/**
 * utils/pagination.js
 *
 * Freshdesk paginates list endpoints with page + per_page query parameters.
 *   - Default page size: 30
 *   - Maximum page size: 100
 *   - Maximum page number: 300 (so at most 30 000 records via pagination)
 *
 * This helper converts caller-friendly limit/offset semantics into the
 * page/per_page params Freshdesk expects, and handles cursor advancement.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_NUMBER = 300;

/**
 * Convert limit/offset into Freshdesk page params.
 *
 * @param {object} opts
 * @param {number} [opts.limit=30]   Max records to return (1–100).
 * @param {number} [opts.page=1]     1-based page number.
 * @returns {{ page: number, per_page: number }}
 */
export function buildPageParams({ limit = DEFAULT_PAGE_SIZE, page = 1 } = {}) {
  const per_page = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const safePage = Math.min(Math.max(1, page), MAX_PAGE_NUMBER);
  return { page: safePage, per_page };
}

/**
 * Fetch all pages of a paginated Freshdesk list endpoint.
 *
 * Stops when the API returns fewer records than per_page (last page) or
 * when the maximum page number is reached.
 *
 * @param {Function} fetchPage  Async fn(page: number) → array of records
 * @param {number}   [perPage=100]
 * @returns {Promise<Array>}
 */
export async function fetchAllPages(fetchPage, perPage = MAX_PAGE_SIZE) {
  const results = [];
  let page = 1;

  while (page <= MAX_PAGE_NUMBER) {
    const records = await fetchPage(page);
    results.push(...records);

    if (records.length < perPage) break; // last page
    page++;
  }

  return results;
}
