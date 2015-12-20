/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

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

core.ImageGridFeatures.Feature('viewer-testing', [
	'lifecycle',
	'base-full',
	'ui',

	// features...
	'ui-ribbon-auto-align',
	//'ui-ribbon-align-to-order',
	//'ui-ribbon-align-to-first',
	//'ui-ribbon-manual-align',
	
	'ui-single-image-view',
	'ui-partial-ribbons',

	// XXX
	//'ui-keyboard-control',
	//'ui-direct-control',
	//'ui-indirect-control',

	'image-marks',
	'image-bookmarks',

	// local storage...
	'config-local-storage',
	'url-history-local-storage',
	'ui-single-image-view-local-storage',

	'fs-loader',
		'ui-fs-loader',
		'fs-url-history',
		'ui-fs-url-history',

	'fs-writer',
		'ui-fs-writer',

	'app-control',

	// chrome...
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		// NOTE: only one of these can be set...
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
	'ui-image-state-indicator',
	'ui-global-state-indicator',
	'ui-url-history',

	'ui-browse-actions',
		'ui-widget-test',

	//'ui-direct-control-jquery',
	'ui-direct-control-gsap',

	// experimental and optional features...
	//'auto-single-image',
	
	// XXX not yet fully tested...
	'system-journal',
])

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



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
