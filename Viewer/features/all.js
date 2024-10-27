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
require('features/store')
require('features/collections')
require('features/sort')
require('features/tags')
require('features/marks')
require('features/location')
require('features/recover')
require('features/config')
require('features/history')
require('features/app')
require('features/peer')
require('features/alias')
require('features/comments')
require('features/ui')
// XXX
require('features/ui-blank-render')
require('features/ui-ribbons')
// XXX
require('features/ui-partial-ribbons-precache')
require('features/ui-partial-ribbons-2')
require('features/ui-single-image')
require('features/ui-chrome')
require('features/ui-progress')
require('features/keyboard')
require('features/ui-status')
require('features/ui-ranges')
require('features/ui-widgets')
require('features/ui-slideshow')
require('features/ui-drag-n-drop')
require('features/external-editor')
require('features/metadata')
require('features/meta')

// XXX EXPERIMENTAL...
require('features/virtual-blocks')

require('features/experimental')
require('features/tests')
require('features/demo')
require('features/examples')

// node features...
if(typeof(window) == 'undefined' || window.nodejs != null){
	require('features/filesystem')
	require('features/sharp')
	require('features/cli') }


//---------------------------------------------------------------------

// NOTE: this is here to simplify importing...
var ImageGridFeatures =
module.ImageGridFeatures = 
	core.ImageGridFeatures



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
