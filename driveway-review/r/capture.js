(function () {
  'use strict';

  const S = window.DrivewayReviewStorage;

  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('job');

  const errorState = document.getElementById('error-state');
  const formState = document.getElementById('form-state');
  const thankYouState = document.getElementById('thank-you-state');
  const jobInfo = document.getElementById('job-info');
  const jobService = document.getElementById('job-service');
  const jobAddress = document.getElementById('job-address');
  const reviewForm = document.getElementById('review-form');
  const reviewText = document.getElementById('review-text');
  const photoInput = document.getElementById('photo-input');
  const photoZone = document.getElementById('photo-zone');

  /** @type {string | null} */
  let photoDataUrl = null;

  if (!jobId) {
    showError();
  } else {
    const job = S.getJob(jobId);
    if (!job) {
      showError();
    } else {
      const existing = S.getResponsesForJob(jobId);
      if (existing.length > 0) {
        showThankYou();
      } else {
        showForm(job);
      }
    }
  }

  function showError() {
    errorState.classList.remove('hidden');
    formState.classList.add('hidden');
    thankYouState.classList.add('hidden');
  }

  function showThankYou() {
    errorState.classList.add('hidden');
    formState.classList.add('hidden');
    thankYouState.classList.remove('hidden');
  }

  function showForm(job) {
    jobInfo.hidden = false;
    jobService.textContent = job.service;
    jobAddress.textContent = job.address;
  }

  function renderPhotoPreview(dataUrl) {
    photoDataUrl = dataUrl;
    photoZone.classList.add('photo-upload__zone--has-photo');
    photoZone.innerHTML = `
      <img class="photo-preview" src="${dataUrl}" alt="Your uploaded photo" />
      <button type="button" class="photo-remove" id="btn-remove-photo">Remove photo</button>
    `;
    document.getElementById('btn-remove-photo').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetPhotoZone();
    });
  }

  function resetPhotoZone() {
    photoDataUrl = null;
    photoInput.value = '';
    photoZone.classList.remove('photo-upload__zone--has-photo');
    photoZone.innerHTML = `
      <span class="photo-upload__icon" aria-hidden="true">📷</span>
      <span class="photo-upload__text">Tap to add a photo</span>
      <span class="photo-upload__hint">Finished work, before/after, etc.</span>
    `;
    bindPhotoZone();
  }

  function bindPhotoZone() {
    photoZone.addEventListener('click', () => photoInput.click());
    photoZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        photoInput.click();
      }
    });
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Photo must be under 4 MB for this demo.');
      photoInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        renderPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  });

  bindPhotoZone();

  reviewForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const text = reviewText.value.trim();
    if (!text) {
      reviewText.focus();
      return;
    }

    const job = S.getJob(jobId);
    if (!job) {
      showError();
      return;
    }

    const googleDraft = S.buildGoogleDraft(job, text);

    S.saveResponse({
      id: S.createId('resp'),
      jobId: jobId,
      reviewText: text,
      photoDataUrl,
      googleDraft,
      submittedAt: Date.now()
    });

    showThankYou();
  });
})();
