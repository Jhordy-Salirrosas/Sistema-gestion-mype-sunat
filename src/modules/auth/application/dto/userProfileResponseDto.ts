export interface CompanyProfileResponse {
  id: string;
  ruc: string;
  legalName: string;
  tradeName: string | null;
  isActive: boolean;
}

export interface UserProfileResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  company: CompanyProfileResponse;
}
