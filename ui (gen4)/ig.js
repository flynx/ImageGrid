#!/usr/bin/env node
/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var requirejs = require('requirejs')
requirejs.config({
	nodeRequire: require,
	//baseUrl: __dirname,

	// XXX this does not work on direct filesystem access...
	//urlArgs: 'bust='+Date.now(),
})

var _require = require
require = requirejs


var core = require('features/core')
var base = require('features/base')
var location = require('features/location')
var history = require('features/history')
var app = require('features/app')
var marks = require('features/ui-marks')
var filesystem = require('features/filesystem')
var cli = require('features/cli')
var experimental = require('features/experimental')

var meta = require('features/meta')



//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures




/*********************************************************************/

// XXX stub action set -- this needs to be auto-generated...
var a = actions.Actions()

// used switch experimental actions on (set to true) or off (unset or false)...
//a.experimental = true

//a.logger = a.logger || {emit: function(e, v){ console.log('    ', e, v) }}

// setup actions...
// XXX this will fail because we did not load ui...
ImageGridFeatures
	.setup(a, [
		'viewer-commandline',

		// XXX this is not for production...
		'experiments',
	])
	.start()


/*
// report stuff...
// XXX we also have .conflicts and .missing
a.features.excluded.length > 0 
	&& console.warn('Features excluded (%d):',
		a.features.excluded.length, 
		a.features.excluded)
console.log('Features not applicable (%d):', 
	a.features.unapplicable.length, 
	a.features.unapplicable)
console.log('Features loaded (%d):',
	a.features.features.length, 
	a.features.features)

*/




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
