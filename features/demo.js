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

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')



/*********************************************************************/

var demo_data =
module.demo_data = {
	version: '3.1',

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
		tags: {
			marked: ['b', 'z'],
			bookmark: ['1', 'c', 'z'],
		},
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

var demo_images =
module.demo_images = {
	a: {
		orientation: 90,
		tags: ['test'],
	},
	d: {
		tags: ['test', 'bookmark']
	},
	f: {
		orientation: 270,
	},
	2: {
		orientation: 270,
	},
	z: {
		flipped: ['horizontal'],
	},
}

// sync tags with images...
//demo_data = data.Data(demo_data)
//	.tagsToImages(demo_images, 'merge')
//	.tagsFromImages(demo_images, 'merge')
//	.json()



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
			{mode: 'advancedBrowseModeAction'},
			function(){
				this.load({
					data: data.Data(demo_data),
					//images: images.Images(),
					images: images.Images(demo_images),

					location: {
						path: 'Demo data',
						load: 'loadDemoIndex',
						sync: 'loadDemoIndex',
						check: true,
					} }) }],
	})
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
