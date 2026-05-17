(function () {
  // ── 1. Read demoId from the script tag that loaded this file ─────────────────
  var demoId = document.currentScript && document.currentScript.dataset.demoId;
  if (!demoId) {
    console.warn('[shocase-tracker] No data-demo-id found on the script tag. Tracking disabled.');
  }

  // ── 2. Retrieve or generate an anonymous, persistent viewerId ─────────────────
  var STORAGE_KEY = 'shocase_viewer_id';
  var viewerId = localStorage.getItem(STORAGE_KEY);
  if (!viewerId) {
    viewerId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, viewerId);
  }

  // ── 4. Fire-and-forget event sender ──────────────────────────────────────────
  function sendEvent(eventType) {
    fetch('http://localhost:3001/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demoId:    demoId,
        viewerId:  viewerId,
        event:     eventType,
        timestamp: new Date().toISOString(),
      }),
    }).catch(function (err) {
      console.warn('[shocase-tracker] Failed to send event "' + eventType + '":', err);
    });
  }

  // ── 6. Defer setup until the DOM is ready ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // ── 3. Locate the video element ─────────────────────────────────────────────
    var video = document.querySelector('video');
    if (!video) {
      console.warn('[shocase-tracker] No <video> element found on this page. Tracking disabled.');
      return;
    }

    // If demoId was missing, still exit gracefully (warning already logged above)
    if (!demoId) return;

    // ── 5a-c. Basic playback events ──────────────────────────────────────────────
    video.addEventListener('play',   function () { sendEvent('play');   });
    video.addEventListener('pause',  function () { sendEvent('pause');  });
    video.addEventListener('ended',  function () { sendEvent('ended');  });

    // ── 5d. Quartile tracking ────────────────────────────────────────────────────
    var firedQuartiles = new Set();

    video.addEventListener('timeupdate', function () {
      // Guard: duration must be a positive finite number
      if (!video.duration || video.duration <= 0) return;

      var pct = video.currentTime / video.duration;

      if (pct >= 0.25 && !firedQuartiles.has('25')) {
        sendEvent('progress_25');
        firedQuartiles.add('25');
      }
      if (pct >= 0.50 && !firedQuartiles.has('50')) {
        sendEvent('progress_50');
        firedQuartiles.add('50');
      }
      if (pct >= 0.75 && !firedQuartiles.has('75')) {
        sendEvent('progress_75');
        firedQuartiles.add('75');
      }
      // 100% is handled by the 'ended' event — no quartile fired here
    });
  });
}());
