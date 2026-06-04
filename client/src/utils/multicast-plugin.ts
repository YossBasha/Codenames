import { registerPlugin } from '@capacitor/core';

export interface MulticastPluginInterface {
  acquire(): Promise<void>;
  release(): Promise<void>;
  sendNativeBroadcast(options: { payload: string; port: number }): Promise<void>;
  getDeviceIP(): Promise<{ ip: string }>;
}

const Multicast = registerPlugin<MulticastPluginInterface>('Multicast');
export default Multicast;
