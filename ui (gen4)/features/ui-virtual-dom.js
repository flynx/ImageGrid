/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var vdom = require('ext-lib/virtual-dom')

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var VirtualDomActions = actions.Actions({
})

var VirtualDom = 
module.VirtualDom = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-vdom-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX
	],

	actions: VirtualDomActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
