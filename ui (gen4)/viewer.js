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

var features = require('features/all')


//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	features.ImageGridFeatures



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
