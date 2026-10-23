(function (global) {
  'use strict';

  /** @type {Record<string, { title: string, fileUrl: string, author: string, authorUrl: string, license: string, licenseUrl: string }>} */
  const SAMPLE_HOOD_FILTER_CREDITS = {
    before: {
      title: 'Long-uncleaned kitchen hood filter, close-up',
      fileUrl:
        'https://commons.wikimedia.org/wiki/File:Long-uncleaned_kitchen_hood_filter,_close-up.jpg',
      author: 'Veikk0.ma',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Veikk0.ma',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
    },
    after: {
      title: 'Kitchen hood filter after being washed in a dishwasher, close-up',
      fileUrl:
        'https://commons.wikimedia.org/wiki/File:Kitchen_hood_filter_after_being_washed_in_a_dishwasher,_close-up.jpg',
      author: 'Veikk0.ma',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Veikk0.ma',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
    }
  };

  const SAMPLE_PHOTO_DISCLAIMER = 'Sample photos, not from a real job.';

  const SAMPLE_PHOTO_CHANGE_NOTE = 'Recompressed, not cropped.';

  global.HoodCertPhotoCredits = {
    SAMPLE_HOOD_FILTER_CREDITS,
    SAMPLE_PHOTO_DISCLAIMER,
    SAMPLE_PHOTO_CHANGE_NOTE
  };
})(typeof window !== 'undefined' ? window : globalThis);
