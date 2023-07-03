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

core.ImageGridFeatures.Feature({
	tag: 'tests',
	depends: [],
	suggested: [
		'a-feature-loop-test',
		'b-feature-loop-test',
	],
})

// Type A dependency cycle...
core.ImageGridFeatures.Feature({
	tag: 'a-feature-loop-test',
	depends: [ 'a-feature-loop-test-2' ],
})
core.ImageGridFeatures.Feature({
	tag: 'a-feature-loop-test-2',
	depends: [ 'a-feature-loop-test' ],
})

// Type B dependency cycle...
core.ImageGridFeatures.Feature({
	tag: 'b-feature-loop-test',
	depends: [ 
		'b-feature-loop-test-2',
	],
})
core.ImageGridFeatures.Feature({
	tag: 'b-feature-loop-test-2',
	depends: [ 
		'b-feature-loop-test-3',
	],
})
core.ImageGridFeatures.Feature({
	tag: 'b-feature-loop-test-3',
	depends: [ 
		'b-feature-loop-test', 
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
