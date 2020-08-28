/**************************************************** jQuery Plugin **/
/* TODO:
 * 	- basic functionality 
 * 		- setup / options
 * 		- navigation
 * 	- events
 * 		- onPromote
 * 		- onDemote
 *
 * This will do the folowing:
 * 	- build the basic elemnt tree needed for the viewer
 * 		we will need a seporate component to:
 * 			- init the visual controls
 * 				ImageGridUIButtons
 * 			- init the keyboard controls
 * 				ImageGridUIKeyboard
 * 			- init the touch/swipe controls
 * 				ImageGridUITouch
 *
 * 		the other components must be usable independently
 *
 *
 * see: jquery.ImageGrid.scafold.js for a generated scafold example...
 */
(function($){$.fn.ImageGridUI = function(options) {
	// NOTE: this refers to the element this was ivoked on...
	
	var options = $.extend({
		// default options...
	}, options)

	// XXX chose the method architecture...
	// 		possible options:
	// 			- use jQuery style message passing...
	// 				$.ImageGridUI(<message-name>, <arguments> ...)
	// 					- too singleton-ish
	// 			- use a constructor and native methods...
	// 				var ui = $(...).ImageGridUI(<options>)
	// 				ui.method(<arguments>)
	// 					- ui may be a collection...
	// 					- need to query by ImageGridUI to get the objects again 
	// 					  instead of re-constructing...

  

	// jQuery chainability...
	// XXX do we use this or return construct and an ImageGridUI object instead?
	return this
}})(jQuery)


// vim:set ts=4 sw=4 nowrap :
