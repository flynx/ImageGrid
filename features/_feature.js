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

var FeatureActions = actions.Actions({
	emptyAction: ['- Demo/Empty action',
		function(){
			// XXX
		}],
})

var Feature = 
module.Feature = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX
	tag: 'feature-tag',
	depends: [
		// XXX
	],

	actions: FeatureActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
