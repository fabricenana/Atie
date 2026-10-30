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

		// One step at a time. The browser's back button follows the steps through the URL hash.
		var panels = form.querySelectorAll('[data-step]');
		var last = panels.length;
		var stepper = document.querySelector('[data-stepper]');
		var back = form.querySelector('[data-step-back]');
		var next = form.querySelector('[data-step-next]');
		var submit = form.querySelector('[data-step-submit]');
		var current = 0;

		var valid = function (upTo) {
			for (var i = 0; i < panels.length && i < upTo; i++) {
				var fields = panels[i].querySelectorAll('input, textarea');
				for (var j = 0; j < fields.length; j++) {
					if (!fields[j].checkValidity()) {
						if (current !== i + 1) {
							show(i + 1, true);
						}
						fields[j].reportValidity();
						return false;
					}
				}
			}
			return true;
		};

		var show = function (step, focus) {
			current = step;
			panels.forEach(function (panel) {
				panel.hidden = +panel.getAttribute('data-step') !== step;
			});
			back.hidden = step === 1;
			next.hidden = step === last;
			submit.hidden = step !== last;
			stepper.querySelectorAll('[data-stepper-item]').forEach(function (item) {
				var number = +item.getAttribute('data-stepper-item');
				item.classList.toggle('is-current', number === step);
				item.classList.toggle('is-done', number < step);
				if (number === step) {
					item.setAttribute('aria-current', 'step');
				} else {
					item.removeAttribute('aria-current');
				}
			});
			form.querySelectorAll('[data-review]').forEach(function (cell) {
				var field = form.elements[cell.getAttribute('data-review')];
				cell.textContent = field ? field.value : '';
			});
			if (focus) {
				var title = form.querySelector('[data-step="' + step + '"] h2');
				title.focus({ preventScroll: true });
				window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
			}
		};

		var go = function (step) {
			if (step > current && !valid(step - 1)) {
				return;
			}
			if (window.location.hash !== '#etape-' + step) {
				window.location.hash = 'etape-' + step; // hashchange shows the step.
			} else {
				show(step, true);
			}
		};

		form.noValidate = true; // Fields of hidden steps cannot show the browser's message: valid() does it.
		document.documentElement.classList.add('presence-flow-on');
		stepper.hidden = false;
		var fromHash = /^#etape-([1-4])$/.exec(window.location.hash);
		show(fromHash ? +fromHash[1] : +form.getAttribute('data-start'), false);

		window.addEventListener('hashchange', function () {
			var match = /^#etape-([1-4])$/.exec(window.location.hash);
			show(match ? +match[1] : 1, true);
		});
		next.addEventListener('click', function () {
			go(current + 1);
		});
		back.addEventListener('click', function () {
			go(current - 1);
		});
		stepper.addEventListener('click', function (event) {
			var target = event.target.closest('[data-step-goto]');
			if (target) {
				go(+target.getAttribute('data-step-goto'));
			}
		});
		// Choosing a receptionist or a plan moves on by itself, like the buttons of a product page.
		form.addEventListener('change', function (event) {
			if (event.target.closest('.presence-pick__card, .presence-choice--plan')) {
				window.setTimeout(function () {
					go(current + 1);
				}, 220);
			}
		});
		form.addEventListener('submit', function (event) {
			if (!valid(last)) {
				event.preventDefault();
			}
		});
	}
})();
