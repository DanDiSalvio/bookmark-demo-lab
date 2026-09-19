(function (global) {
  'use strict';

  const STORAGE_KEY = 'driveway-review-v1';

  /** @typedef {'pending' | 'complete' | 'request_sent'} JobStatus */

  /**
   * @typedef {{
   *   id: string,
   *   customerName: string,
   *   address: string,
   *   service: string,
   *   phone: string,
   *   status: JobStatus,
   *   reviewRequestSentAt: number | null,
   *   createdAt: number
   * }} Job
   */

  /**
   * @typedef {{
   *   id: string,
   *   jobId: string,
   *   reviewText: string,
   *   photoDataUrl: string | null,
   *   googleDraft: string,
   *   submittedAt: number
   * }} ReviewResponse
   */

  /**
   * @typedef {{
   *   jobs: Job[],
   *   responses: ReviewResponse[]
   * }} Store
   */

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { jobs: [], responses: [] };
      }
      const parsed = JSON.parse(raw);
      return {
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        responses: Array.isArray(parsed.responses) ? parsed.responses : []
      };
    } catch {
      return { jobs: [], responses: [] };
    }
  }

  function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getJob(jobId) {
    const store = readStore();
    return store.jobs.find((job) => job.id === jobId) ?? null;
  }

  function saveJob(job) {
    const store = readStore();
    const index = store.jobs.findIndex((item) => item.id === job.id);
    if (index >= 0) {
      store.jobs[index] = job;
    } else {
      store.jobs.unshift(job);
    }
    writeStore(store);
    return job;
  }

  function saveResponse(response) {
    const store = readStore();
    const index = store.responses.findIndex((item) => item.id === response.id);
    if (index >= 0) {
      store.responses[index] = response;
    } else {
      store.responses.unshift(response);
    }
    writeStore(store);
    return response;
  }

  function getResponsesForJob(jobId) {
    return readStore().responses.filter((item) => item.jobId === jobId);
  }

  function getAllResponses() {
    return readStore().responses;
  }

  function getAllJobs() {
    return readStore().jobs;
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function buildCaptureUrl(jobId) {
    const base = `${window.location.origin}/driveway-review/r/`;
    return `${base}?job=${encodeURIComponent(jobId)}`;
  }

  function buildSmsText(job, captureUrl) {
    const firstName = job.customerName.split(' ')[0] || 'there';
    return `Hi ${firstName}! Thanks for choosing us today. Would you share a quick sentence about your ${job.service.toLowerCase()}? Takes 30 seconds: ${captureUrl}`;
  }

  function buildGoogleDraft(job, reviewText) {
    const trimmed = reviewText.trim();
    if (!trimmed) {
      return '';
    }
    const service = job.service.trim();
    const name = job.customerName.trim();
    return `${trimmed} ${service ? `— ${service}` : ''} Highly recommend! — ${name.split(' ')[0] || 'Happy customer'}`;
  }

  const SAMPLE_JOB = {
    id: 'job_sample_demo',
    customerName: 'Sarah Mitchell',
    address: '142 Oak Lane, Denver, CO 80205',
    service: 'Spring lawn cleanup & mulch',
    phone: '(555) 234-8891',
    status: 'complete',
    reviewRequestSentAt: null,
    createdAt: Date.now() - 15 * 60 * 1000
  };

  function seedSampleJob() {
    const store = readStore();
    const existing = store.jobs.find((job) => job.id === SAMPLE_JOB.id);
    if (!existing) {
      store.jobs.unshift({ ...SAMPLE_JOB });
      writeStore(store);
    }
    return SAMPLE_JOB.id;
  }

  function formatPhoneDisplay(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }

  function formatDateTime(timestamp) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp));
  }

  global.DrivewayReviewStorage = {
    STORAGE_KEY,
    SAMPLE_JOB,
    createId,
    readStore,
    writeStore,
    getJob,
    saveJob,
    saveResponse,
    getResponsesForJob,
    getAllResponses,
    getAllJobs,
    clearAll,
    buildCaptureUrl,
    buildSmsText,
    buildGoogleDraft,
    seedSampleJob,
    formatPhoneDisplay,
    formatRelativeTime,
    formatDateTime
  };
})(window);
