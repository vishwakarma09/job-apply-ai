// inject.js
// Runs in MAIN world to intercept window.open calls and bypass popup blocking
(function() {
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
