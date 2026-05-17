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

  // ── 3. Generate a unique sessionId for this page load session ───────────────
  var sessionId = crypto.randomUUID();

  // ── 4. Event Queue System ────────────────────────────────────────────────────
  var queue = [];
  var isFlushing = false;

  // Queue a tracking event
  function sendEvent(eventType) {
    if (!demoId) return; // Silent exit if tracking disabled
    queue.push({
      demoId:    demoId,
      viewerId:  viewerId,
      sessionId: sessionId,
      event:     eventType,
      timestamp: new Date().toISOString()
    });
  }

  // Execute network request
  function sendRequest(eventData) {
    return fetch('http://localhost:3001/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    }).then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res;
    });
  }

  // Batch process the queue sequentially
  async function flushQueue() {
    if (isFlushing || queue.length === 0) return;
    isFlushing = true;

    while (queue.length > 0) {
      var eventData = queue[0];
      try {
        await sendRequest(eventData);
        queue.shift(); // Remove only after successful backend acknowledgment
      } catch (err) {
        console.warn('[shocase-tracker] Failed to dispatch event, will retry in next cycle:', err);
        break; // Stop execution, leaving the failed event (and rest of queue) intact
      }
    }

    isFlushing = false;
  }

  // Flush the queue periodically every 2 seconds
  setInterval(flushQueue, 2000);

  // ── 5. Defer setup until the DOM is ready ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Locate the video element on the host page
    var video = document.querySelector('video');
    if (!video) {
      console.warn('[shocase-tracker] No <video> element found on this page. Tracking disabled.');
      return;
    }

    // Stop early if missing tracking configuration
    if (!demoId) return;

    // Basic playback event listeners
    video.addEventListener('play',   function () { sendEvent('play');   });
    video.addEventListener('pause',  function () { sendEvent('pause');  });
    video.addEventListener('ended',  function () { sendEvent('ended');  });

    // Quartile progress tracking
    var firedQuartiles = new Set();

    video.addEventListener('timeupdate', function () {
      var duration = video.duration;
      var currentTime = video.currentTime;

      // Defensive checks for video metadata readiness and finite duration
      if (
        typeof duration !== 'number' ||
        isNaN(duration) ||
        !isFinite(duration) ||
        duration <= 0 ||
        typeof currentTime !== 'number' ||
        isNaN(currentTime)
      ) {
        return;
      }

      var pct = currentTime / duration;

      // Safe threshold checks ensuring each quartile event fires exactly once per session
      if (pct >= 0.25 && !firedQuartiles.has('25')) {
        firedQuartiles.add('25');
        sendEvent('progress_25');
      }
      if (pct >= 0.50 && !firedQuartiles.has('50')) {
        firedQuartiles.add('50');
        sendEvent('progress_50');
      }
      if (pct >= 0.75 && !firedQuartiles.has('75')) {
        firedQuartiles.add('75');
        sendEvent('progress_75');
      }
      // Note: 100% (Ended) is tracked via the native 'ended' event listener
    });
  });
}());
