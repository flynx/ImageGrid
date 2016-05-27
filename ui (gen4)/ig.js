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
	.setup(['viewer-commandline'])
	.start()



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
