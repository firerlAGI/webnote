export const API_BASE_URL = '/api';
export const API_TIMEOUT = 30000; // 30秒
export const SYNC_INTERVAL = 5 * 60 * 1000; // 5分钟
export const SYNC_BATCH_SIZE = 50;
export const ERROR_CODES = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500
};
export const STORAGE_KEYS = {
    TOKEN: 'token',
    USER: 'user',
    SETTINGS: 'settings',
    DRAFT: 'draft'
};
export const THEME = {
    LIGHT: 'light',
    DARK: 'dark'
};
export const SORT_OPTIONS = {
    NEWEST: 'newest',
    OLDEST: 'oldest',
    ALPHABETICAL: 'alphabetical'
};
