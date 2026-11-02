export interface Host {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface Session {
  id: string;
  code: string;
  title: string;
  description?: string;
  host_id: string;
  is_active: number;
  require_approval: number;
  allow_anonymous: number;
  created_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  display_name: string;
  joined_at: string;
}

export interface Question {
  id: string;
  session_id: string;
  participant_id: string;
  author_name: string;
  content: string;
  is_anonymous: number;
  is_answered: number;
  is_hidden: number;
  is_pinned: number;
  upvotes_count: number;
  created_at: string;
  has_voted?: boolean; // Computed per requesting participant
}

export interface QuestionVote {
  question_id: string;
  participant_id: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  votes_count: number;
  sort_order: number;
  percentage?: number;
}

export interface Poll {
  id: string;
  session_id: string;
  question: string;
  status: 'draft' | 'active' | 'closed';
  show_results: number;
  created_at: string;
  options?: PollOption[];
  total_votes?: number;
  user_voted_option_id?: string | null;
}

export interface PollVote {
  poll_id: string;
  participant_id: string;
  option_id: string;
  created_at: string;
}
