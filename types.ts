
export type Screen = 'loading' | 'onboarding' | 'signup' | 'location' | 'disaster' | 'dashboard' | 'aiplan' | 'emergencykit' | 'securehome' | 'evacuation' | 'resources' | 'mangrove';

export interface UserProfile {
  userName: string;
  location: string;
  disasters: string[];
}

export interface Progress {
  [key: string]: boolean;
}

export interface AIRecommendations {
  urgentActions: string[];
  weeklyTips: string[];
  locationSpecific: string;
}
