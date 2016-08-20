/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// import features...
var core = require('features/core')

require('features/base')
require('features/sort')
require('features/tags')
require('features/location')
require('features/recover')
require('features/history')
require('features/app')
require('features/ui')
require('features/ui-partial-ribbons')
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
	require('features/sharp')
	require('features/cli')
}


//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
