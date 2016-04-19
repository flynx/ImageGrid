/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

// import features...
var core = require('features/core')

require('features/base')
require('features/location')
require('features/history')
require('features/app')
require('features/ui')
require('features/ui-single-image')
require('features/ui-chrome')
require('features/keyboard')
require('features/ui-status')
require('features/ui-marks')
require('features/ui-widgets')
require('features/ui-slideshow')
require('features/external-editor')
require('features/metadata')
require('features/meta')

require('features/experimental')
require('features/demo')

// node features...
if(typeof(window) == 'undefined' || window.nodejs != null){
	require('features/filesystem')
	require('features/cli')
}


//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
