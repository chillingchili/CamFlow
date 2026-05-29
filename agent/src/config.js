// CamFlow Agent Configuration
// Loads and validates required environment variables.

const REQUIRED_VARS = ['CLOUD_WS_URL', 'AGENT_SHARED_SECRET', 'OBS_PORT', 'OBS_PASSWORD', 'PTZ_IP'];

const missing = REQUIRED_VARS.filter(name => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = {
  CLOUD_WS_URL: process.env.CLOUD_WS_URL,
  AGENT_SHARED_SECRET: process.env.AGENT_SHARED_SECRET,
  OBS_PORT: parseInt(process.env.OBS_PORT, 10) || 4455,
  OBS_PASSWORD: process.env.OBS_PASSWORD,
  PTZ_IP: process.env.PTZ_IP,
  // Protocol for PTZ camera communication: 'rest' (HTTP API) or 'ndi-direct'
  PTZ_PROTOCOL: process.env.PTZ_PROTOCOL || 'rest',
};

export default config;
