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

var PreCacheActions = actions.Actions({
	config: {
		// How many non-adjacent images to preload...
		'preload-radius': 5,

		// Sources to preload...
		'preload-sources': ['bookmark', 'marked'],
	},

	// NOTE: this will not work from chrome when loading from a local fs...
	// XXX experimental...
	startCacheWorker: ['Interface/',
		{mode: 'advancedBrowseModeAction'},
		function(){
			// a worker is started already...
			if(this.cacheWorker != null){
				return
			}

			var b = new Blob([[
				'addEventListener(\'message\', function(e) {',
				'	var urls = e.data',
				'	urls = urls.constructor !== Array ? [urls] : urls',
				'	var l = urls.length',
				'	urls.forEach(function(url){',
				'		var xhr = new XMLHttpRequest()',
				'		xhr.responseType = \'blob\'',
				/*
				'		xhr.onload = xhr.onerror = function(){',
				'			l -= 1',
				'			if(l <= 0){',
				'				postMessage({status: \'done.\', urls: urls})',
				'			}',
				'		}',
				*/
				'		xhr.open(\'GET\', url, true)',
				'		xhr.send()',
				'	})',
				'}, false)',
			].join('\n')])

			var url = URL.createObjectURL(b)

			this.cacheWorker = new Worker(url)
			this.cacheWorker.url = url
		}],
	stopCacheWorker: ['Interface/',
		{mode: 'advancedBrowseModeAction'},
		function(){
			if(this.cacheWorker){
				this.cacheWorker.terminate()
				URL.revokeObjectURL(this.cacheWorker.url)
				delete this.cacheWorker
			}
		}],


	// Pre-load images...
	//
	// Sources supported:
	// 	<tag>			- pre-load images tagged with <tag> 
	// 					  (default: ['bookmark', 'marked']) 
	// 	<ribbon-gid>	- pre-cache from a specific ribbon
	// 	'ribbon'		- pre-cache from current ribbon
	// 	'order'			- pre-cache from images in order
	//
	// NOTE: workers when loaded from file:// in a browser context 
	// 		will not have access to local images...
	//
	// XXX need a clear strategy to run this...
	// XXX might be a good idea to make the worker queue the lists...
	// 		...this will need careful prioritization logic...
	// 			- avoid loading the same url too often
	// 			- load the most probable urls first
	// 				- next targets
	// 					- next/prev
	// 						.preCacheJumpTargets(target, 'ribbon', this.screenwidth)
	// 					- next/prev marked/bookmarked/order
	// 						.preCacheJumpTargets(target, 'marked')
	// 						.preCacheJumpTargets(target, 'bookmarked')
	// 						.preCacheJumpTargets(target, 'order')
	// 					- next/prev screen
	// 						.preCacheJumpTargets(target, 'ribbon',
	// 							this.config['preload-radius'] * this.screenwidth)
	// 					- next/prev ribbon
	// 						.preCacheJumpTargets(target, this.data.getRibbon(target, 1))
	// 						.preCacheJumpTargets(target, this.data.getRibbon(target, -1))
	// 				- next blocks
	// 					- what resize ribbon does...
	// XXX coordinate this with .resizeRibbon(..)
	// XXX make this support an explicit list of gids....
	// XXX should this be here???
	preCacheJumpTargets: ['- Interface/Pre-cache potential jump target images',
		function(target, sources, radius, size){
			target = target instanceof jQuery 
				? this.ribbons.elemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target)
					|| this.data.getImage(target, 'after'))

			sources = sources || this.config['preload-sources'] || ['bookmark', 'marked']
			sources = sources.constructor !== Array ? [sources] : sources
			radius = radius || this.config['preload-radius'] || 9

			var that = this

			// get preview...
			var _getPreview = function(c){
				return that.images[c] 
					&& that.images.getBestPreview(c, size, true).url
			}

			// get a set of paths...
			// NOTE: we are also ordering the resulting gids by their 
			// 		distance from target...
			var _get = function(i, lst, source, radius, oddity, step){
				var found = oddity
				var max = source.length 

				for(var j = i+step; (step > 0 && j < max) || (step < 0 && j >= 0); j += step){
					var c = source[j]

					if(c == null || that.images[c] == null){
						continue
					}

					// build the URL...
					lst[found] = _getPreview(c)

					found += 2
					if(found >= radius*2){
						break
					}
				}
			}

			// run the actual preload...
			var _run = function(){
				sources.forEach(function(tag){
					// order...
					if(tag == 'order'){
						var source = that.data.order

					// current ribbon...
					}else if(tag == 'ribbon'){
						var source = that.data.ribbons[that.data.getRibbon()]

					// ribbon-gid...
					} else if(tag in that.data.ribbons){
						var source = that.data.ribbons[tag]
				
					// nothing tagged then nothing to do...
					} else if(that.data.tags == null 
							|| that.data.tags[tag] == null 
							|| that.data.tags[tag].length == 0){
						return 

					// tag...
					} else {
						var source = that.data.tags[tag]
					}

					size = size || that.ribbons.getVisibleImageSize() 

					var i = that.data.order.indexOf(target)
					var lst = []

					// get the list of URLs before and after current...
					_get(i ,lst, source, radius, 0, 1)
					_get(i, lst, source, radius, 1, -1)

					// get target preview in case the target is not loaded...
					var p = _getPreview(that.data.getImage(target))
					p && lst.splice(0, 0, p)

					// web worker...
					if(that.cacheWorker != null){
						that.cacheWorker.postMessage(lst)

					// async inline...
					} else {
						// do the actual preloading...
						lst.forEach(function(url){
							var img = new Image()
							img.src = url
						})
					}
				})
			}

			if(that.cacheWorker != null){
				_run()

			} else {
				setTimeout(_run, 0)
			}
		}],
})

var PreCache = 
module.PreCache = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-partial-ribbons-precache',
	depends: [
		'ui',
	],

	actions: PreCacheActions, 

	handlers: [
		['focusImage.post', 
			function(_, target){ 
				this.preCacheJumpTargets(target) }],
		/*/
		['resizing.pre',
			function(unit, size){ 
				this.preCacheJumpTargets() }],
		//*/
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
