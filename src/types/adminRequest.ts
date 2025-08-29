export interface AdminRequest {
  id: number;
  shareholderId: string;
  shareholderName: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'completed' | 'rejected';
  completedBy?: string;
  completedAt?: string;
  reason: string;
  createdAt: string;
}
