#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.CLI entry point...
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// Global scope pollution test...
if(process.env.IMAGEGRID_DEBUG){
	global.__global = global.__global || {...global}
	global.scopeDiff = function(cur=global, base=__global){
		return Object.keys(cur)
			.filter(function(k){ return base[k] !== cur[k] }) 
			.reduce(function(res, k){
				res[k] = cur[k]
				return res }, {})} }



/*********************************************************************/

require('v8-compile-cache')
// NOTE: importing this before require fixes several issues with lib/util 
// 		conflicting with stuff...
require('repl')

var path = require('path')

// setup module loaders...
require = require('./cfg/requirejs')(require, path.resolve(__dirname)).requirejs
require.main = {filename: (nodeRequire.main || {}).filename}

var core = require('features/core')
// XXX for some reason if this is not loaded here things break in CLI...
// 		...setting priority does not help...
var cli = require('features/cli')
var meta = require('features/meta')



/*********************************************************************/

// XXX SETUP
//require('features/all')

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures

// setup actions and start...
ImageGridFeatures
	.setup([
		// XXX SETUP should this do a full setup...
		//'imagegrid-testing',
		'imagegrid-commandline',
	])
	.start()




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
