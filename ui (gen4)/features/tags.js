/**********************************************************************
* 
*
*
**********************************************************************/
(typeof(define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// Persistent tags (tree) 
//
// XXX add save/load tree to fs...

var PersistentTagsActions = actions.Actions({
})


var PersistentTags = 
module.PersistentTags = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'persistent-tags',
	depends: [
		'base',
	],

	actions: PersistentTagsActions, 

	handlers: [],
})



//---------------------------------------------------------------------
// Persistent tags UI...
//
// Provide the following interfaces:
// 	- cloud
// 	- tree
//
// Use-cases:
// 	- edit tag tree
// 	- edit image tags
//

var TagUIActions = actions.Actions({
})


var TagUI = 
module.TagUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX
	tag: 'ui-tags',
	depends: [
		// XXX
	],

	actions: TagUIActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
