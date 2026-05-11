(($: JQueryStatic) => {
    function openAndScrollTo(id: string): void {
        const el = document.getElementById(id);
        if (!el || el.tagName !== "DETAILS") {
            return;
        }

        const $details = $(el);

        // Open the accordion
        $details.attr("open", "");

        // Remove previous highlights
        $("details.highlighted").removeClass("highlighted");

        // Add highlight
        $details.addClass("highlighted");

        // Scroll into view after a brief delay so the browser can lay out the content
        setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    }

    function handleHash(): void {
        const hash = window.location.hash.slice(1);
        if (hash) {
            openAndScrollTo(decodeURIComponent(hash));
        }
    }

    const LINK_ICON =
        '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0z"/></svg>';

    const CHECK_ICON =
        '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>';

    // Inject copy-link buttons into every details[id] > summary
    function injectCopyButtons(): void {
        $("details[id] > summary").each(function () {
            const $btn = $('<button class="copy-link" title="Linki kopyala"></button>');
            $btn.html(LINK_ICON);
            $(this).append($btn);
        });
    }

    // Handle copy-link button click
    $(document).on("click", ".copy-link", function (e: JQuery.ClickEvent) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const $details = $btn.closest("details");
        const id = $details.attr("id");
        if (!id) return;

        const url = window.location.origin + window.location.pathname + "#" + id;

        navigator.clipboard.writeText(url).then(() => {
            $btn.addClass("copied").html(CHECK_ICON);
            setTimeout(() => {
                $btn.removeClass("copied").html(LINK_ICON);
            }, 1500);
        });
    });

    // Update URL hash when a summary is clicked
    $(document).on("click", "summary", function (e: JQuery.ClickEvent) {
        // Ignore clicks on the copy button
        if ($(e.target).closest(".copy-link").length) {
            return;
        }

        const $details = $(this).closest("details");
        const id = $details.attr("id");
        if (!id) {
            return;
        }

        // If the details element is currently closed (about to open), collapse others and update hash
        if (!$details.attr("open")) {
            $("details[open]").not($details).removeAttr("open");
            history.replaceState(null, "", "#" + id);

            // Scroll to the question after the browser lays out the content
            setTimeout(() => {
                $details[0].scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    });

    // Handle hash changes (e.g. back/forward navigation)
    $(window).on("hashchange", handleHash);

    // Handle initial hash on page load
    $(document).ready(() => {
        injectCopyButtons();
        handleHash();
    });
})(jQuery);
