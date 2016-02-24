/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// import features...
// XXX should this be auto-loaded???
var core = require('features/core')
var base = require('features/base')
var location = require('features/location')
var history = require('features/history')
var app = require('features/app')
var ui = require('features/ui')
var status = require('features/ui-status')
var marks = require('features/ui-marks')
var widgets = require('features/ui-widgets')
var exteditor = require('features/external-editor')
var metadata = require('features/metadata')
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
