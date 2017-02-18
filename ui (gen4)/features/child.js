/**********************************************************************
* 
* Setup a node.js child_process communications channel and listen and 
* exec commands...
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var ChildActions = actions.Actions({
})

var Child = 
module.Child = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'child',

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: ChildActions, 
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
