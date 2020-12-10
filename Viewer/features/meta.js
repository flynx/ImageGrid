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

core.ImageGridFeatures.Feature('imagegrid-commandline', [
	'lifecycle',
	'commandline',
])


core.ImageGridFeatures.Feature('imagegrid-minimal', [
	'lifecycle',
	'alias',
	'peer',
	'fs',
	'sharp',

	'base-full',
	'marks',
	'collections',
	'metadata',
])


core.ImageGridFeatures.Feature('imagegrid-ui-minimal', [
	'imagegrid-minimal',

	'keyboard',
	'ui-cursor',
	'ui-control',
	'ui-drag-n-drop',

	// XXX use one...
	//'ui-blank-render',
	'ui-ribbons-render',
	'ui-preact-render',
	//'ui-vdom-render',
	//'ui-react-render',
	
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

	'ui-bounds-indicators',
	'ui-current-image-indicator',

	'ui-tags',
])


core.ImageGridFeatures.Feature('imagegrid-ui', [
	'imagegrid-ui-minimal',

	'app-control',

	'ui-progress',

	'ui-buttons',

	'ui-status-bar',

	'ui-url-history',
	'ui-browse-actions',
	'ui-context-action-menu',
])


// simple feature set to do read-only previews...
// XXX experimental...
core.ImageGridFeatures.Feature('imagegrid-ui-preview', [
	'imagegrid-ui-minimal',

	// stuff we do not need...
	'-ui-drag-n-drop',
	'-edit',
	'-collections',
	'-metadata',
	'-peer',
])


core.ImageGridFeatures.Feature('imagegrid-testing', [
	'imagegrid-commandline',
	'imagegrid-ui',

	//'-ui-partial-ribbons',
	
	// Add this to enable widget mode (will not touch the window)...
	// XXX needs testing...
	//'widget',


	// read-only mode...
	// XXX at this point this needs some more tuneup, the following 
	// 		...should be split into view/edit sub-features...
	// XXX features are completely disabled when '-edit' is not present:
	// 			- sort
	// 			- ...
	// XXX the following features are broken:
	// 		- crop
	// 		- ...
	// XXX might also be a good idea to make basic marking and bookmarking
	// 		editable (save to localStorage???)
	//'-edit',


	//------------------------------------------------------ system ---
	// XXX not yet fully tested...
	'journal',

	// NOTE: this is not strictly needed unless we need to save stuff,
	// 		added here mostly for testing purposes...
	// 		...this is best included by direct feature dependency.
	'index-format',

	// XXX testing...
	'store-config',
	//'config',

	'ui-url-hash',

	'fail-safe-devtools',


	//------------------------------------------------------ chrome ---
	'ui-status-log',
	//'ui-scale',
	// NOTE: only one of these can be set...
	'ui-current-image-indicator-hide-on-fast-screen-nav',
	//'ui-current-image-indicator-hide-on-screen-nav',
	//'ui-base-ribbon-indicator',
	'ui-passive-base-ribbon-indicator',


	//---------------------------------------------------- features ---
	'ui-introspection',
	'ui-single-image',
	'ui-slideshow',
	'ui-virtual-blocks',
	'ui-preview-filters',
	'url-history',
	'external-editor',

	// experimental features...
	//'ui-range',
	//'auto-single-image',
	//'auto-ribbon',
	

	//------------------------------------------------------- other ---
	'examples',


	//----------------------------------------------------- testing ---
	'experiments',
	'-tests',

	// XXX this is really slow on load, need to speed the search up...
	//'-comments',

	// missing suggested feature test -- should show up in .features.missing...
	'missing-feature',
])




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
