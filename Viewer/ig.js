#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.CLI entry point...
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

require('v8-compile-cache')
// NOTE: this fixes several issues with lib/util conflicting with stuff...
require('repl')


// setup module loaders...
require = require('./cfg/requirejs')(require).requirejs
require.main = {filename: (nodeRequire.main || {}).filename}


var core = require('features/core')
// XXX for some reason if this is not loaded here things break in CLI...
// 		...setting priority does not help...
var cli = require('features/cli')
var meta = require('features/meta')



/*********************************************************************/

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures

// setup actions and start...
ImageGridFeatures
	.setup([
		'imagegrid-testing',
		'imagegrid-commandline',
	])
	.start()




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
