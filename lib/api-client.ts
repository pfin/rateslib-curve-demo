/**
 * Type-safe API client for Rateslib curve building
 */

export interface CurvePoint {
  date: string;
  forward_rate: number;
  zero_rate?: number;
}

export interface CurveResponse {
  status: string;
  curve_date: string;
  interpolation: string;
  points: CurvePoint[];
  metadata: {
    rateslib_version: string;
    nodes_count: number;
    points_generated: number;
  };
}

export interface ErrorResponse {
  status: 'error';
  error: string;
  type: string;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  rateslib_version: string;
  api_version: string;
}

export interface FOMCDatesResponse {
  [year: string]: string[];
}

export type InterpolationType = 'flat_forward' | 'log_linear';

export class RateslibAPIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '';
  }

  async buildCurve(
    curveDate: string = '2025-06-10',
    interpolation: InterpolationType = 'flat_forward',
    forwardTenorDays: number = 7
  ): Promise<CurveResponse> {
    const params = new URLSearchParams({
      curve_date: curveDate,
      interpolation: interpolation,
      forward_tenor_days: forwardTenorDays.toString()
    });

    const response = await fetch(`${this.baseUrl}/api/curves?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async buildCurveWithData(data: {
    curve_date: string;
    market_data?: any;
    interpolation: InterpolationType;
    forward_tenor_days?: number;
  }): Promise<CurveResponse> {
    const response = await fetch(`${this.baseUrl}/api/curves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  async getFOMCDates(): Promise<FOMCDatesResponse> {
    const response = await fetch(`${this.baseUrl}/api/fomc-dates`);
    
    if (!response.ok) {
      throw new Error(`Failed to get FOMC dates: ${response.status}`);
    }

    return response.json();
  }
}

// Singleton instance
export const apiClient = new RateslibAPIClient();