/* ATIE — portfolio category filtering */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		var tabs = Array.prototype.slice.call( document.querySelectorAll( '.tabs .tab' ) );
		var cards = Array.prototype.slice.call( document.querySelectorAll( '.project-card' ) );

		if ( ! tabs.length || ! cards.length ) {
			return;
		}

		function applyFilter( filter ) {
			cards.forEach( function ( card ) {
				var cats = ( card.getAttribute( 'data-category' ) || '' ).split( /\s+/ );
				var show = 'all' === filter || cats.indexOf( filter ) !== -1;
				card.classList.toggle( 'is-hidden', ! show );
			} );
		}

		tabs.forEach( function ( tab ) {
			tab.addEventListener( 'click', function () {
				tabs.forEach( function ( t ) { t.classList.remove( 'is-active' ); } );
				tab.classList.add( 'is-active' );
				applyFilter( tab.getAttribute( 'data-filter' ) );
			} );
		} );
	} );
}() );
