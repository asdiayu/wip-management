import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.storagecrusher.management',
  appName: 'Crusher Management',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
