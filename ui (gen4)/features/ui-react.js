/**********************************************************************
* 
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

var ReactActions = actions.Actions({
})

var React = 
module.React = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-react-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX
	],

	actions: ReactActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
