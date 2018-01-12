#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.CLI entry point...
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

require('./cfg/requirejs')

nodeRequire =
global.nodeRequire = 
	require

require = 
requirejs = 
global.requirejs = 
	require('requirejs')



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
		'imagegrid-testing',
		'imagegrid-commandline',
	])
	.start()



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
