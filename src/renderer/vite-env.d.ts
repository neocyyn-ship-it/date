/// <reference types="vite/client" />

import type { IEcomApi } from '@shared/types';

declare global {
  interface Window {
    ecomApi: IEcomApi;
  }
}
