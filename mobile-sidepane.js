document.addEventListener('DOMContentLoaded', function () {
    var leftToggle = document.querySelector('.side-pane-toggle.left-toggle');
    var rightToggle = document.querySelector('.side-pane-toggle.right-toggle');
    var leftPane = document.querySelector('.side-pane.left-pane');
    var rightPane = document.querySelector('.side-pane.right-pane');

    // Open left pane (rooms/users)
    if (leftToggle && leftPane) {
        leftToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            leftPane.classList.toggle('open');
            if (rightPane) rightPane.classList.remove('open');
        });
    }

    // Open right pane (users/other)
    if (rightToggle && rightPane) {
        rightToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            rightPane.classList.toggle('open');
            if (leftPane) leftPane.classList.remove('open');
        });
    }

    // Close panes when clicking outside (mobile only)
    document.addEventListener('click', function (e) {
        if (window.innerWidth > 768) return;
        if (leftPane && leftPane.classList.contains('open')) {
            if (!leftPane.contains(e.target) && (!leftToggle || !leftToggle.contains(e.target))) {
                leftPane.classList.remove('open');
            }
        }
        if (rightPane && rightPane.classList.contains('open')) {
            if (!rightPane.contains(e.target) && (!rightToggle || !rightToggle.contains(e.target))) {
                rightPane.classList.remove('open');
            }
        }
    });

    // Optional: close on ESC key
    document.addEventListener('keydown', function (e) {
        if (window.innerWidth > 768) return;
        if (e.key === 'Escape') {
            if (leftPane) leftPane.classList.remove('open');
            if (rightPane) rightPane.classList.remove('open');
        }
    });
});
