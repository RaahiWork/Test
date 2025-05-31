document.addEventListener('DOMContentLoaded', function () {
    var leftToggle = document.querySelector('.side-pane-toggle.left-toggle');
    var rightToggle = document.querySelector('.side-pane-toggle.right-toggle');
    var leftPane = document.querySelector('.side-pane.left-pane');
    var rightPane = document.querySelector('.side-pane.right-pane');

    // Only run on mobile
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // Ensure toggles are visible on mobile
    function updateToggleVisibility() {
        if (leftToggle) leftToggle.style.display = isMobile() ? 'flex' : 'none';
        if (rightToggle) rightToggle.style.display = isMobile() ? 'flex' : 'none';
    }
    updateToggleVisibility();
    window.addEventListener('resize', updateToggleVisibility);

    // Fix: Remove pointer-events:none from side-pane when open (in case CSS disables interaction)
    function enablePanePointerEvents() {
        if (leftPane) leftPane.style.pointerEvents = leftPane.classList.contains('open') ? 'auto' : '';
        if (rightPane) rightPane.style.pointerEvents = rightPane.classList.contains('open') ? 'auto' : '';
    }

    // Add event listeners for toggles
    if (leftToggle && leftPane) {
        leftToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!isMobile()) return;
            leftPane.classList.toggle('open');
            if (rightPane) rightPane.classList.remove('open');
            enablePanePointerEvents();
        });
    }
    if (rightToggle && rightPane) {
        rightToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!isMobile()) return;
            rightPane.classList.toggle('open');
            if (leftPane) leftPane.classList.remove('open');
            enablePanePointerEvents();
        });
    }

    // Prevent main scroll when side pane is open
    function preventScroll(e) {
        if ((leftPane && leftPane.classList.contains('open')) ||
            (rightPane && rightPane.classList.contains('open'))) {
            e.preventDefault();
        }
    }
    document.addEventListener('touchmove', preventScroll, { passive: false });

    // Close panes when clicking outside (mobile only)
    document.addEventListener('click', function (e) {
        if (!isMobile()) return;
        if (leftPane && leftPane.classList.contains('open')) {
            if (!leftPane.contains(e.target) && (!leftToggle || !leftToggle.contains(e.target))) {
                leftPane.classList.remove('open');
                enablePanePointerEvents();
            }
        }
        if (rightPane && rightPane.classList.contains('open')) {
            if (!rightPane.contains(e.target) && (!rightToggle || !rightToggle.contains(e.target))) {
                rightPane.classList.remove('open');
                enablePanePointerEvents();
            }
        }
    });

    // Optional: close on ESC key
    document.addEventListener('keydown', function (e) {
        if (!isMobile()) return;
        if (e.key === 'Escape') {
            if (leftPane) leftPane.classList.remove('open');
            if (rightPane) rightPane.classList.remove('open');
            enablePanePointerEvents();
        }
    });

    // Optional: close panes on window resize to desktop
    window.addEventListener('resize', function () {
        if (!isMobile()) {
            if (leftPane) leftPane.classList.remove('open');
            if (rightPane) rightPane.classList.remove('open');
            enablePanePointerEvents();
        }
    });
});
