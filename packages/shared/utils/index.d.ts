export declare const formatDate: (date: Date | string) => string;
export declare const formatDateOnly: (date: Date | string) => string;
export declare const generateHash: (str: string) => string;
export declare const isValidEmail: (email: string) => boolean;
export declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
export declare const throttle: <T extends (...args: any[]) => any>(func: T, limit: number) => ((...args: Parameters<T>) => void);
export declare const deepClone: <T>(obj: T) => T;
export declare const sleep: (ms: number) => Promise<void>;
