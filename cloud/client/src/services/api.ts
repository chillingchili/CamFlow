export interface AgentStatus {
  connected: boolean;
  lastHeartbeat: number | null;
  health: {
    obs: boolean;
    ptz: boolean;
  };
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('camflow_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    localStorage.removeItem('camflow_token');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export async function login(passphrase: string): Promise<{ token: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  return handleResponse<{ token: string }>(response);
}

export async function switchScene(sceneName: string): Promise<{ requestId: string; status: string }> {
  const response = await fetch('/api/obs/scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ sceneName }),
  });
  return handleResponse<{ requestId: string; status: string }>(response);
}

export async function recallPreset(presetNumber: number): Promise<{ requestId: string; status: string }> {
  const response = await fetch('/api/ptz/preset/recall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ presetNumber }),
  });
  return handleResponse<{ requestId: string; status: string }>(response);
}

export async function savePreset(presetNumber: number): Promise<{ requestId: string; status: string }> {
  const response = await fetch('/api/ptz/preset/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ presetNumber }),
  });
  return handleResponse<{ requestId: string; status: string }>(response);
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const response = await fetch('/api/agent/status', {
    headers: getAuthHeaders(),
  });
  return handleResponse<AgentStatus>(response);
}
