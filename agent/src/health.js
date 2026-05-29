import { isConnected } from './obs.js';
import { isReachable } from './ptz.js';

export async function getSnapshot() {
  const [obs, ptz] = await Promise.all([
    Promise.resolve(isConnected()),
    isReachable(),
  ]);
  return { obs, ptz, timestamp: Date.now() };
}
