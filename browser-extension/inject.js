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

  window.addEventListener("AI_JOB_APPLY_SET_TYPEAHEAD_LOCATION", (e) => {
    if (e.detail && e.detail.location) {
      const location = e.detail.location;
      const $ = window.jQuery || window.$;
      if ($) {
        console.log("[AI Job Apply Inject] Setting typeahead location to:", location);
        const $loc = $("#locationstring");
        if ($loc.length && typeof $loc.typeahead === "function") {
          $loc.typeahead("val", location);
          $loc.typeahead("open");
          
          setTimeout(() => {
            const menu = $loc.parent().find(".tt-menu");
            const suggestions = menu.find(".tt-suggestion");
            let targetSuggestion = null;
            
            for (let i = 0; i < suggestions.length; i++) {
              const text = $(suggestions[i]).text().toLowerCase();
              if (!text.includes("no suggestion")) {
                targetSuggestion = $(suggestions[i]);
                break;
              }
            }
            
            if (targetSuggestion && targetSuggestion.length) {
              console.log("[AI Job Apply Inject] Clicking typeahead suggestion:", targetSuggestion.text());
              targetSuggestion.click();
              window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_TYPEAHEAD_SUCCESS", {
                detail: { selectedText: targetSuggestion.text() }
              }));
            } else {
              console.warn("[AI Job Apply Inject] No valid typeahead suggestions found.");
            }
          }, 1500);
        }
      }
    }
  });
})();
