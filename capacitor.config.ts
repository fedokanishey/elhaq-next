import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.elhaq.app',
  appName: 'الحق',
  webDir: 'out',
  server: {
    url: 'https://elhaq-next.vercel.app',
    cleartext: true
  }
};

export default config;
