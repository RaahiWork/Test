document.addEventListener('DOMContentLoaded', function () {
    // Left (rooms/users) pane
    var leftToggle = document.querySelector('.side-pane-toggle.left-toggle');
    var leftPane = document.querySelector('.side-pane.left-pane');
    // Right (optional, e.g. user list) pane
    var rightToggle = document.querySelector('.side-pane-toggle.right-toggle');
    var rightPane = document.querySelector('.side-pane.right-pane');

    if (leftToggle && leftPane) {
        leftToggle.addEventListener('click', function () {
            leftPane.classList.toggle('open');
            // Optionally close right pane if open
            if (rightPane) rightPane.classList.remove('open');
        });
    }
    if (rightToggle && rightPane) {
        rightToggle.addEventListener('click', function () {
            rightPane.classList.toggle('open');
            // Optionally close left pane if open
            if (leftPane) leftPane.classList.remove('open');
        });
    }
    // Optional: close pane when clicking outside (mobile only)
    document.addEventListener('click', function (e) {
        if (window.innerWidth > 768) return;
        if (leftPane && leftPane.classList.contains('open')) {
            if (!leftPane.contains(e.target) && !leftToggle.contains(e.target)) {
                leftPane.classList.remove('open');
            }
        }
        if (rightPane && rightPane.classList.contains('open')) {
            if (!rightPane.contains(e.target) && !rightToggle.contains(e.target)) {
                rightPane.classList.remove('open');
            }
        }
    });
});
