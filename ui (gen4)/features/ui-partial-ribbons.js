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

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
// XXX try using .ribbons.resizeRibbon(..) for basic tasks...
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = actions.Actions({
	config: {
		// number of screen widths to load...
		'ribbon-size-screens': 7,

		// number of screen widths to edge to trigger reload...
		'ribbon-resize-threshold': 1.5,

		// timeout before a non-forced ribbon size update happens after
		// the action...
		// NOTE: if set to null, the update will be sync...
		'ribbon-update-timeout': 120,

		// how many non-adjacent images to preload...
		'preload-radius': 5,

		// sources to preload...
		'preload-sources': ['bookmark', 'selected'],
	},

	// NOTE: this will not work from chrome when loading from a local fs...
	// XXX experimental...
	startCacheWorker: ['Interface/',
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
	// 					  (default: ['bookmark', 'selected']) 
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
				? this.ribbons.getElemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target)
					|| this.data.getImage(target, 'after'))

			sources = sources || this.config['preload-sources'] || ['bookmark', 'selected']
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

	// NOTE: this will force sync resize if one of the following is true:
	// 		- the target is not loaded
	// 		- we are less than screen width from the edge
	// 		- threshold is set to 0
	// XXX this is not signature compatible with data.updateRibbon(..)
	// XXX do not do anything for off-screen ribbons...
	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target)
					|| this.data.getImage(target, 'after'))

			w = w || this.screenwidth

			// get config data and normalize...
			size = (size 
				|| this.config['ribbon-size-screens'] 
				|| 5) * w
			threshold = threshold == 0 ? threshold
				: (threshold 
					|| this.config['ribbon-resize-threshold'] 
					|| 1) * w

			var timeout = this.config['ribbon-update-timeout']

			// next/prev loaded... 
			var img = this.ribbons.getImage(target)
			var nl = img.nextAll('.image:not(.clone)').length
			var pl = img.prevAll('.image:not(.clone)').length

			// next/prev available...
			// NOTE: we subtract 1 to remove the current and make these 
			// 		compatible with: nl, pl
			var na = this.data.getImages(target, size, 'after').length - 1
			var pa = this.data.getImages(target, size, 'before').length - 1

			// do the update...
			// no threshold means force load...
			if(threshold == 0 
					// the target is not loaded...
					|| img.length == 0
					// passed hard threshold on the right...
					|| (nl < w && na > nl) 
					// passed hard threshold on the left...
					|| (pl < w && pa > pl)){

				this.resizeRibbon(target, size)

			// do a late resize...
			// loaded more than we need (crop?)...
			} else if(na + pa < nl + pl
					// passed threshold on the right...
					|| (nl < threshold && na > nl) 
					// passed threshold on the left...
					|| (pl < threshold && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > size + threshold){

				return function(){
					// sync update...
					if(timeout == null){
						this.resizeRibbon(target, size)

					// async update...
					} else {
						// XXX need to check if we are too close to the edge...
						var that = this
						//setTimeout(function(){ that.resizeRibbon(target, size) }, 0)
						if(this.__update_timeout){
							clearTimeout(this.__update_timeout)
						}
						this.__update_timeout = setTimeout(function(){ 
							delete that.__update_timeout
							that.resizeRibbon(target, size) 
						}, timeout)
					}
				}
			}
		}],
	// XXX do we handle off-screen ribbons here???
	resizeRibbon: ['- Interface/Resize ribbon to n images',
		function(target, size){
			size = size 
				|| (this.config['ribbon-size-screens'] * this.screenwidth)
				|| (5 * this.screenwidth)
			var data = this.data
			var ribbons = this.ribbons

			// NOTE: we can't get ribbon via target directly here as
			// 		the target might not be loaded...
			var r_gid = data.getRibbon(target)

			if(r_gid == null){
				return
			}

			// localize transition prevention... 
			// NOTE: for the initial load this may be empty...
			var r = ribbons.getRibbon(r_gid)

			// XXX do we need to for example ignore unloaded (r.length == 0)
			// 		ribbons here, for example not load ribbons too far off 
			// 		screen??
			
			ribbons
				.preventTransitions(r)
				.updateRibbon(
					data.getImages(target, size), 
					r_gid,
					target)
				.restoreTransitions(r, true)
		}]
})

// NOTE: I do not fully understand it yet, but PartialRibbons must be 
// 		setup BEFORE RibbonAlignToFirst, otherwise the later will break
// 		on shifting an image to a new ribbon...
// 			To reproduce:
// 				- setupe RibbonAlignToFirst first
// 				- go to top ribbon
// 				- shift image up
// 		XXX The two should be completely independent.... (???)
var PartialRibbons = 
module.PartialRibbons = core.ImageGridFeatures.Feature({
	title: 'Partial Ribbons',
	doc: 'Maintains partially loaded ribbons, this enables very lage '
		+'image sets to be hadled eficiently.',

	// NOTE: partial ribbons needs to be setup first...
	// 		...the reasons why things break otherwise is not too clear.
	priority: 'high',

	tag: 'ui-partial-ribbons',
	depends: ['ui'],


	actions: PartialRibbonsActions,

	handlers: [
		['focusImage.pre centerImage.pre', 
			function(target, list){
				// NOTE: we have to do this as we are called BEFORE the 
				// 		actual focus change happens...
				// XXX is there a better way to do this???
				target = list != null ? target = this.data.getImage(target, list) : target

				this.updateRibbon(target)
			}],
		['focusImage.post', 
			function(_, target){
				this.preCacheJumpTargets(target)
			}],

		['resizing.pre',
			function(unit, size){
				if(unit == 'scale'){
					this.updateRibbon('current', this.screenwidth / size || 1)

				} else if(unit == 'screenwidth'){
					this.updateRibbon('current', size || 1)

				} else if(unit == 'screenheight'){
					size = size || 1

					// convert target height in ribbons to width in images...
					// NOTE: this does not account for compensation that 
					// 		.updateRibbon(..) makes for fitting whole image
					// 		counts, this is a small enough error so as not
					// 		to waste time on...
					var s = this.ribbons.scale()
					var h = this.ribbons.getScreenHeightRibbons()
					var w = this.ribbons.getScreenWidthImages()
					var nw = w / (h/size)

					this.updateRibbon('current', nw)
				}

				//this.preCacheJumpTargets()
			}],



	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
