// inject.js
// Runs in MAIN world to intercept window.open calls and bypass popup blocking
(function() {
  // Mark main world as loaded for helper.js
  document.documentElement.setAttribute('data-ai-main-loaded', 'true');

  // Listen for clicks requested by content script
  window.addEventListener("AI_JOB_APPLY_TRIGGER_CLICK", (e) => {
    if (e.detail && e.detail.targetId) {
      const el = document.querySelector(`[data-ai-click-target="${e.detail.targetId}"]`);
      if (el) {
        console.log("[AI Job Apply Inject] Clicking element in MAIN world:", el);
        const opts = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
      }
    }
  });

  if (window.location.hostname === "fr.glassdoor.ca") {
    window.location.replace(window.location.href.replace("fr.glassdoor.ca", "www.glassdoor.ca"));
    return;
  }

  const originalOpen = window.open;
  window.open = function(url, name, specs) {
    console.log("[AI Job Apply Intercept] window.open intercepted:", url);
    if (url && (url.includes("smartapply.indeed.com") || url.includes("linkedin.com/checkout") || url.includes("linkedin.com/jobs") || url.includes("indeed.com/viewjob"))) {
      window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_INTERCEPTED_OPEN", { 
        detail: { url } 
      }));
      return { closed: false, close: () => {} }; // Return a mock window object to avoid page errors
    }
    return originalOpen.apply(this, arguments);
  };
})();
