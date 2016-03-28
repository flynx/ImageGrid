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

core.ImageGridFeatures.Feature('viewer-commandline', [
	'lifecycle',
	'commandline',
])


core.ImageGridFeatures.Feature('viewer-minimal', [
	'lifecycle',
	'base-full',

	'image-marks',
	'image-bookmarks',

	'fs-loader',
	'fs-writer',

	'metadata',
	'fs-metadata',
])


core.ImageGridFeatures.Feature('viewer-testing', [
	'viewer-commandline',
	'viewer-minimal',

	'workspace',
	'ui',

	'ui-ribbons-placement',

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


	// local storage + url...
	'config-local-storage',
	'ui-url-hash',
	'url-history-local-storage',
	'url-history-fs-writer',
	'ui-single-image-view-local-storage',


	// fs...
	'ui-fs-loader',
	'fs-url-history',
	'ui-fs-url-history',
	'ui-fs-writer',

	'metadata',
	'fs-metadata',
	'ui-metadata',

	'external-editor',
	'ui-external-editor',

	// chrome...
	'ui-status-log',
	'ui-scale',
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		// NOTE: only one of these can be set...
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
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
	'ui-clickable',
	//'ui-autohide-cursor',
	'ui-autohide-cursor-single-image-view',
	//'ui-direct-control-jquery',
	// XXX BUG: on touch down and first move this gets offset by a distance
	// 		not sure why...
	// 		...seems to be related to scaling
	//'ui-direct-control-gsap',
	'ui-indirect-control',

	// experimental and optional features...
	//'auto-single-image',
	//'auto-ribbon',
	
	'ui-app-control',

	// XXX not yet fully tested...
	'system-journal',
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
* vim:set ts=4 sw=4 :                                                */
return module })
