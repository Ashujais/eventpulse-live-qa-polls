const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('eventpulse_host_token');
  const participantId = localStorage.getItem('eventpulse_participant_id');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (participantId) {
    headers['x-participant-id'] = participantId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle file downloads (e.g. CSV exports)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) {
      throw new ApiError('Failed to download CSV export', response.status);
    }
    return (await response.text()) as unknown as T;
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch (err) {
    // Empty or non-JSON body
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data.details);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request<any>('/auth/me'),

  // Sessions
  createSession: (body: any) => request<any>('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getHostSessions: () => request<any>('/sessions/host'),
  getSession: (code: string) => request<any>(`/sessions/${code}`),
  joinSession: (code: string, displayName: string, participantId?: string) =>
    request<any>('/sessions/join', {
      method: 'POST',
      body: JSON.stringify({ code, displayName, participantId })
    }),
  updateSessionStatus: (id: string, is_active: boolean) =>
    request<any>(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    }),
  exportSessionUrl: (code: string, format: 'csv' | 'json' = 'csv') =>
    `${API_BASE}/sessions/${code}/export?format=${format}`,

  // Questions
  getQuestions: (sessionCode: string, participantId?: string, isHost = false) => {
    const params = new URLSearchParams();
    if (participantId) params.append('participantId', participantId);
    if (isHost) params.append('isHost', 'true');
    return request<any>(`/sessions/${sessionCode}/questions?${params.toString()}`);
  },
  createQuestion: (sessionCode: string, body: { content: string; participantId: string; isAnonymous?: boolean }) =>
    request<any>(`/sessions/${sessionCode}/questions`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  upvoteQuestion: (sessionCode: string, questionId: string, participantId: string) =>
    request<any>(`/sessions/${sessionCode}/questions/${questionId}/upvote`, {
      method: 'POST',
      body: JSON.stringify({ participantId })
    }),
  removeUpvote: (sessionCode: string, questionId: string, participantId: string) =>
    request<any>(`/sessions/${sessionCode}/questions/${questionId}/upvote`, {
      method: 'DELETE',
      body: JSON.stringify({ participantId })
    }),
  moderateQuestion: (sessionCode: string, questionId: string, updates: { is_answered?: number; is_hidden?: number; is_pinned?: number }) =>
    request<any>(`/sessions/${sessionCode}/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
  deleteQuestion: (sessionCode: string, questionId: string) =>
    request<any>(`/sessions/${sessionCode}/questions/${questionId}`, {
      method: 'DELETE'
    }),

  // Polls
  getPolls: (sessionCode: string, participantId?: string) => {
    const params = new URLSearchParams();
    if (participantId) params.append('participantId', participantId);
    return request<any>(`/sessions/${sessionCode}/polls?${params.toString()}`);
  },
  getActivePoll: (sessionCode: string, participantId?: string) => {
    const params = new URLSearchParams();
    if (participantId) params.append('participantId', participantId);
    return request<any>(`/sessions/${sessionCode}/polls/active?${params.toString()}`);
  },
  createPoll: (sessionCode: string, body: { question: string; options: string[]; status?: 'draft' | 'active'; show_results?: boolean }) =>
    request<any>(`/sessions/${sessionCode}/polls`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  votePoll: (sessionCode: string, pollId: string, optionId: string, participantId: string) =>
    request<any>(`/sessions/${sessionCode}/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId, participantId })
    }),
  updatePollStatus: (sessionCode: string, pollId: string, updates: { status?: 'draft' | 'active' | 'closed'; show_results?: boolean }) =>
    request<any>(`/sessions/${sessionCode}/polls/${pollId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
  deletePoll: (sessionCode: string, pollId: string) =>
    request<any>(`/sessions/${sessionCode}/polls/${pollId}`, {
      method: 'DELETE'
    })
};
