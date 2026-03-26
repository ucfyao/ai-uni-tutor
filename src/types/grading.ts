export interface GradingResponse {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  maxPoints: number;
  feedback: string;
}

export interface GradingSummary {
  overallFeedback: string;
  improvements: string[];
  formatWarning?: string;
}

export interface GradingResult {
  responses: GradingResponse[];
  totalScore: number;
  maxScore: number;
  summary: GradingSummary;
}
