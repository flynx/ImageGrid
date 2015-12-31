/**********************************************************************
* 
* Base architecture:
*
* 	Two trees are maintained:
* 		- no-gui
* 		- gui
*
* 	no-gui:
* 		aggregates:
* 			data
* 			images
* 		defines universal set of actions to manage and control state
*
* 	gui:
* 		extends no-gui and adds:
* 			ribbons
* 		extends and defines a set of gui control and state actions
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

// import features...
// XXX should this be auto-loaded???
var core = require('features/core')
var base = require('features/base')
var location = require('features/location')
var history = require('features/history')
var app = require('features/app')
var ui = require('features/ui')
var marks = require('features/ui-marks')
var widgets = require('features/ui-widgets')
var meta = require('features/meta')
var experimental = require('features/experimental')

if(window.nodejs != null){
	var filesystem = require('features/filesystem')
	var cli = require('features/cli')
}


//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
