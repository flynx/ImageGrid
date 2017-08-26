/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// Meta features...
//
// XXX need to make a set of basic configurations:
// 		- commandline		- everything but no UI
// 		- viewer-minimal	- basic browser compatible viewer
// 		- viewer			- full viewer
// 		- editor			- editing capability
//

core.ImageGridFeatures.Feature('viewer-commandline', [
	'lifecycle',
	'commandline',
])


core.ImageGridFeatures.Feature('viewer-minimal', [
	'lifecycle',
	'base-full',

	'peer',

	'image-marks',
	'image-bookmarks',

	'fs',
	'sharp',

	'metadata',
])


core.ImageGridFeatures.Feature('viewer-testing', [
	'viewer-commandline',
	'viewer-minimal',

	'collections',

	// XXX remove when done testing...
	'-fs-collections',


	'alias',

	// read-only mode...
	// XXX at this point this needs some more tuneup, the following 
	// 		features are completely disabled when 'edit' is not present
	// 			- sort
	// 			- ...
	// 		...should be split into view/edit sub-features...
	// XXX might also be a good idea to make basic marking and bookmarking
	// 		editable (save to localStorage???)
	//'-edit',

	'peer',

	'workspace',
	'ui',
	'ui-introspection',
	'keyboard',

	// XXX use one...
	//'ui-blank-render',
	'ui-ribbons-render',
	'ui-preact-render',
	//'ui-vdom-render',
	//'ui-react-render',

	// features...
	'ui-cursor',
	'ui-unfocused-lock',

	'ui-single-image',

	/*/ XXX has bugs -- non-current ribbons are not always aligned...
	'ui-partial-ribbons-2',
		'-ui-partial-ribbons',
	//*/
	/*/ XXX EXPERIMENTAL: virtual-dom based ribbons...
	'ui-partial-ribbons-vdom',
		//'-ui-image-marks',
		//'-ui-image-bookmarks',
		'-ui-partial-ribbons',
		'-ui-partial-ribbons-2',
	//*/
	
	'marks',
	'ui-range',

	// local storage + url...
	'config-local-storage',
	'ui-url-hash',
	'url-history',

	'external-editor',
	'ui-drag-n-drop',

	'ui-preview-filters',

	// chrome...
	'ui-app-buttons',
	'ui-buttons',
	'ui-progress',
	'ui-status-log',
	'ui-scale',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		// NOTE: only one of these can be set...
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
	//*/
	//'ui-base-ribbon-indicator',
	'ui-passive-base-ribbon-indicator',
	'ui-status-bar',
	'ui-url-history',

	'ui-browse-actions',
		'ui-context-action-menu',
		'ui-widget-test',

	// slideshow...
	'ui-slideshow',

	// ui control...
	//'ui-clickable',
	//'ui-direct-control-jquery',
	// XXX BUG: on touch down and first move this gets offset by a distance
	// 		not sure why...
	// 		...seems to be related to scaling
	//'ui-direct-control-gsap',
	//'ui-direct-control-hammer',
	//'ui-indirect-control',
	'ui-control',

	// experimental and optional features...
	//'auto-single-image',
	//'auto-ribbon',
	
	'ui-app-control',

	// XXX not yet fully tested...
	'journal',


	'fail-safe-devtools',

	'-tests',
	'-experiments',

	// missing suggested feature test...
	'missing-feature',
])

/*
core.ImageGridFeatures.Feature('viewer-minimal', [
	'base',
	'ui',
	'ui-ribbon-align-to-order',
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
	'ui-action-tree',
])
*/



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
