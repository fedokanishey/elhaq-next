/**
 * Global fetcher function for SWR
 * Handles JSON responses and errors
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // Attach extra info to the error object
    const errorData = await res.json().catch(() => ({}));
    throw Object.assign(error, errorData);
  }

  return res.json();
};

/**
 * Fetcher with custom options
 */
export const fetcherWithOptions = async ([url, options]: [string, RequestInit]) => {
  const res = await fetch(url, { ...options, cache: "no-store" });
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    const errorData = await res.json().catch(() => ({}));
    throw Object.assign(error, errorData);
  }

  return res.json();
};
