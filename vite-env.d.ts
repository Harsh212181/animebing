/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string; // Tumhara custom env var
  // Add more if needed, e.g., readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare module 'swiper/css';
declare module 'swiper/css/pagination';
declare module 'swiper/css/navigation';
declare module 'swiper/css/autoplay';