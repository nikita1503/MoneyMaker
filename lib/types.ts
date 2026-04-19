export type SearchCompany = {
  name: string;
  linkedin_company_url?: string;
  linkedin_company_id?: string;
  industry?: string;
  company_type?: string;
  founded_year?: number;
  location?: string;
  headquarters?: { country?: string; geographicArea?: string; city?: string };
  employee_count?: number;
  employee_count_range?: string;
  employee_growth_percentages?: { timespan: string; percentage: number }[];
  specialties?: string[];
  revenue_range?: {
    estimatedMinRevenue?: { amount: number; unit: string; currencyCode: string };
    estimatedMaxRevenue?: { amount: number; unit: string; currencyCode: string };
  };
  decision_makers_count?: string;
  website?: string;
  company_website_domain?: string;
};

export type EnrichedCompany = {
  company_id?: number;
  company_name?: string;
  linkedin_profile_url?: string;
  linkedin_id?: string;
  company_website_domain?: string;
  domains?: string[];
  hq_country?: string;
  hq_state?: string;
  headquarters?: string;
  year_founded?: string;
  employee_count_range?: string;
  company_type?: string;
  estimated_revenue_lower_bound_usd?: number;
  estimated_revenue_higher_bound_usd?: number;
  headcount?: { linkedin_headcount?: number };
  industry?: string;
  specialties?: string[];
  [k: string]: any;
};

export type RankedCompany = SearchCompany & {
  id: string; // stable id we assign
  score: number;
  reasons: string[];
  domain?: string;
};

export type LandingPage = {
  id: string; // same as RankedCompany.id
  company: RankedCompany;
  enriched?: EnrichedCompany;
  planMd?: string;
  html?: string;
  file?: string; // relative path under /data/sites
  generatedAt?: number;
  error?: string;
};

export type OutreachResult = {
  id: string;
  companyName: string;
  recipient?: { name?: string; email?: string; title?: string };
  screenshot?: string;
  subject?: string;
  body?: string;
  sent?: boolean;
  savedEml?: string;
  error?: string;
};

export type AppConfig = {
  price: number;
  paymentDetails: string;
  fromName: string;
  fromEmail: string;
};
