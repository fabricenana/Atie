/**
 * ATIE Presence pages: receptionist preview dialog and sign-up summary.
 * Without this script the preview links simply lead to the sign-up page.
 */
(function () {
	var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reduced) {
		document.querySelectorAll('.presence-card video').forEach(function (v) {
			v.removeAttribute('autoplay');
			v.pause();
		});
	}

	// The bubble plays the same file as the first card: load it once the page is done.
	window.addEventListener('load', function () {
		document.querySelectorAll('.presence-bubble video[data-src]').forEach(function (v) {
			v.src = v.getAttribute('data-src');
			if (!reduced) {
				v.play().catch(function () {});
			}
		});
	});

	var dialog = document.getElementById('presence-preview');
	if (dialog && dialog.showModal) {
		var show = function (id) {
			dialog.querySelectorAll('[data-preview-panel]').forEach(function (panel) {
				var active = panel.getAttribute('data-preview-panel') === id;
				var video = panel.querySelector('video');
				panel.hidden = !active;
				if (!video) {
					return;
				}
				if (!active) {
					video.pause();
					return;
				}
				if (!video.getAttribute('src')) {
					video.src = video.getAttribute('data-src');
				}
				if (!reduced) {
					video.play().catch(function () {});
				}
			});
			dialog.querySelectorAll('[data-preview-tab]').forEach(function (tab) {
				tab.setAttribute('aria-pressed', tab.getAttribute('data-preview-tab') === id ? 'true' : 'false');
			});
		};

		document.addEventListener('click', function (event) {
			var target = event.target.closest('[data-presence-preview], [data-preview-tab], [data-preview-close], [data-presence-open]');
			if (!target) {
				// A click on the backdrop lands on the dialog itself.
				if (event.target === dialog) {
					dialog.close();
				}
				return;
			}
			if (target.hasAttribute('data-presence-preview')) {
				event.preventDefault();
				show(target.getAttribute('data-presence-preview'));
				if (!dialog.open) {
					dialog.showModal();
				}
			} else if (target.hasAttribute('data-preview-tab')) {
				show(target.getAttribute('data-preview-tab'));
			} else if (dialog.open) {
				dialog.close(); // Close button, link to the prices, or the live widget opening.
			}
		});

		dialog.addEventListener('close', function () {
			dialog.querySelectorAll('video').forEach(function (v) {
				v.pause();
			});
		});
	}

	// Sign-up: the summary follows the plan and receptionist chosen in the form.
	var form = document.querySelector('.presence-form');
	if (form) {
		var sync = function (name, attribute) {
			var checked = form.querySelector('input[name="' + name + '"]:checked');
			document.querySelectorAll('[' + attribute + ']').forEach(function (block) {
				block.hidden = !checked || block.getAttribute(attribute) !== checked.value;
			});
		};
		form.addEventListener('change', function () {
			sync('plan', 'data-summary-plan');
			sync('receptionist', 'data-summary-persona');
		});
	}
})();
