/** jobs.ts — v2 background job management API */
import { v2delete, v2get, v2post } from './v2client';
import type { Job } from '@/store/jobStore';

export interface JobListResponse {
  jobs: Job[];
  total: number;
}

export interface RetryResponse {
  retried: boolean;
  original_job_id: string;
  new_job_id: string;
}

/** Fetch all recent jobs */
export async function listJobs(): Promise<JobListResponse> {
  return v2get('/jobs');
}

/** Fetch a single job by ID */
export async function getJob(jobId: string): Promise<Job> {
  return v2get(`/jobs/${jobId}`);
}

/** Cancel / delete a job */
export async function cancelJob(jobId: string): Promise<{ message: string }> {
  return v2delete(`/jobs/${jobId}`);
}

/** Retry a failed or cancelled job — returns a new job_id */
export async function retryJob(jobId: string): Promise<RetryResponse> {
  return v2post(`/jobs/${jobId}/retry`, {});
}
