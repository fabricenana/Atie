/* ATIE — global theme behaviour */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		// Mobile navigation toggle.
		var toggle = document.querySelector( '.nav-toggle' );
		var nav = document.getElementById( 'primary-nav' );

		if ( toggle && nav ) {
			toggle.addEventListener( 'click', function () {
				var open = nav.classList.toggle( 'is-open' );
				toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			} );

			// Close the menu when a link is tapped.
			nav.addEventListener( 'click', function ( e ) {
				if ( e.target.closest( 'a' ) ) {
					nav.classList.remove( 'is-open' );
					toggle.setAttribute( 'aria-expanded', 'false' );
				}
			} );
		}
	} );
}() );
