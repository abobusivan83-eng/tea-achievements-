const svg = (content: string) => `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;

export const DEFAULT_AVATAR_URL = svg(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#243447"/>
        <stop offset="100%" stop-color="#0d141d"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="48" fill="url(#bg)"/>
    <circle cx="128" cy="100" r="44" fill="#d9e2ec" fill-opacity="0.92"/>
    <path d="M56 214c11-37 39-58 72-58s61 21 72 58" fill="#d9e2ec" fill-opacity="0.92"/>
  </svg>
`);

export const DEFAULT_BANNER_URL = svg(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 520">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#17212c"/>
        <stop offset="50%" stop-color="#243447"/>
        <stop offset="100%" stop-color="#0b1016"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="520" fill="url(#bg)"/>
    <circle cx="270" cy="120" r="140" fill="#66c0f4" fill-opacity="0.13"/>
    <circle cx="1320" cy="420" r="180" fill="#ffd56a" fill-opacity="0.1"/>
    <circle cx="880" cy="100" r="120" fill="#c084fc" fill-opacity="0.08"/>
  </svg>
`);

export function resolveAvatarUrl(url?: string | null) {
  return url ?? DEFAULT_AVATAR_URL;
}

export function resolveBannerUrl(url?: string | null) {
  return url ?? DEFAULT_BANNER_URL;
}
