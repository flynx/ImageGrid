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

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')



/*********************************************************************/

var demo_data =
module.demo_data = {
	varsion: '3.0',

	current: '3',
	base: 'r0',

	order: [],

	ribbon_order: ['r0', 'r1'],
	ribbons: {
		r1: ['1', '2', '3'],
		r0: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
			 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x',
			 'y', 'z']
	},

	tags: {
		selected: ['b', 'z'],
		bookmark: ['1', 'c', 'z'],
	},

	// NOTE: group gids do not have to be present in .order, they will 
	// 		get added on .collapseGroup(..)...
	groups: {
		g0: ['a', 'b', 'c'],
		g1: ['l', 'y'],
	},
}
Object.keys(demo_data.ribbons).forEach(function(k){ 
	demo_data.order = demo_data.order.concat(demo_data.ribbons[k]) 
})



/*********************************************************************/

var Demo = 
module.Demo = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'demo',
	depends: [
		'base',
	],

	actions: actions.Actions({
		loadDemoIndex: ['File/Load demo data',
			function(){
				this.load({
					data: data.Data(demo_data),
					images: images.Images(),
				})
			}],
	})
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
