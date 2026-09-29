import type { Writable } from "svelte/store";
export declare const theme: Writable<string>;
export declare function initTheme(): void;
export declare function apply(next: string): void;
export declare function toggle(): void;
