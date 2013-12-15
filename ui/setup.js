/**********************************************************************
* 
*
**********************************************************************/

// A threshold after which the image block ratio will be changed to 
// 'fit-viewer' in single image mode...
//
// NOTE: if null this feature will be disabled.
var PROPORTIONS_RATIO_THRESHOLD = 1.5

var CONTEXT_INDICATOR_UPDATERS = []

// list of functions to setup different bindings
//
// each function must be of the form:
// 	setupBinding(viewer) -> viewer
//
var SETUP_BINDINGS = []



/**********************************************************************
* Setup
*/

function setupIndicators(){
	showGlobalIndicator(
			'single-ribbon-mode', 
			'Single ribbon mode (F3)')
		.css('cursor', 'hand')
		.click(function(){ toggleSingleRibbonMode() })
}


function makeContextIndicatorUpdater(image_class){
	var _updater = function(image){
		var indicator = $('.context-mode-indicators .current-image-'+image_class)
		if(image.hasClass(image_class)){
			indicator.addClass('shown')
		} else {
			indicator.removeClass('shown')
		}
	}
	CONTEXT_INDICATOR_UPDATERS.push(_updater)
	return _updater
}


function updateContextIndicators(image){
	image = image == null ? getImage() : $(image)

	// marked...
	CONTEXT_INDICATOR_UPDATERS.map(function(update){
		update(image)
	})	
}



// Setup event handlers for data bindings...
//
// This does two jobs:
// 	- maintain DATA state
// 		- editor actions
// 		- focus
// 		- marking
// 	- maintain view consistency
// 		- centering/moving (roll)
// 		- shifting (expand/contract)
// 		- zooming (expand/contract)
//
function setupDataBindings(viewer){
	viewer = viewer == null ? $('.viewer') : viewer

	SETUP_BINDINGS.forEach(function(setup){
		setup(viewer)
	})

}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
