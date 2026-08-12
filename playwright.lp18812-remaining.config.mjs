import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'lp18812-remaining-runtime.spec.mjs',workers:1,retries:0,reporter:'line',timeout:300000,use:{browserName:'chromium',channel:'chromium',headless:true,viewport:{width:390,height:844},serviceWorkers:'block',trace:'off',video:'off'}});
