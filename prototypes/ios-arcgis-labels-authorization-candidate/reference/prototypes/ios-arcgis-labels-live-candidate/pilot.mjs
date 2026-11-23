import { createEsriProvider } from './esri.mjs';
import { createLabelsGateway } from './gateway.mjs';
import { createNodeHandler } from './http.mjs';

// Compose only on the isolated server. The default config, transport and
// verification ports provide no path to real provider traffic.
export function createPilotApplication({ environment = {}, state, origin, appId, transport,
  verifyPaid, verifyAttest, now = Date.now } = {}) {
  const enabled = () => environment.GRIDLY_LABELS_PILOT_ENABLED === 'true';
  const provider = createEsriProvider({ environment, transport, now,
    enabled: async () => enabled() && await state.isEnabled() === true });
  const gateway = createLabelsGateway({ state, origin, appId, provider, verifyPaid, verifyAttest, now, enabled });
  return createNodeHandler(gateway);
}
