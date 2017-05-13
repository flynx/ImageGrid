#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.CLI entry point...
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

global.requirejs = global.requirejs || require('requirejs')
requirejs.config({
	nodeRequire: require,
	//baseUrl: __dirname,

	// XXX this does not work on direct filesystem access...
	//urlArgs: 'bust='+Date.now(),
	
	paths: {
		//text: 'node_modules/requirejs-plugins/lib/text',
		//json: 'node_modules/requirejs-plugins/src/json',

		'lib/object': 'node_modules/ig-object/object',
		'lib/actions': 'node_modules/ig-actions/actions',
		'lib/features': 'node_modules/ig-features/features',
	},	
	map: {
		'*': {
			// back-refs
			// ...these enable the npm modules reference each other in 
			// a cross-platform manner....
			'ig-object': 'lib/object',
			'ig-actions': 'lib/actions',
			'ig-features': 'lib/features',

			//'ig-keyboard': 'lib/keyboard',
		},
	},
})
var _require = require
require = requirejs


//---------------------------------------------------------------------

// XXX need to automate this...
var core = require('features/core')
var base = require('features/base')
var cli = require('features/cli')

var meta = require('features/meta')



/*********************************************************************/

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures


//---------------------------------------------------------------------

// setup actions and start...
ImageGridFeatures
	.setup([
		'viewer-testing',
		'viewer-commandline',
	])
	.start()



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
