import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codenames.app',
  appName: 'Codenames Duet',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'http'
  },
  plugins: {
    CapacitorNodeJS: {
      nodeDir: 'nodejs',
      startMode: 'manual'  // manual so we can pass NODE_OPTIONS before engine starts
    }
  }
};

export default config;
