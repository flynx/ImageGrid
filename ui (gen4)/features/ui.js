/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var data = require('data')
var images = require('images')
var ribbons = require('ribbons')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/


var reloadAfter =
module.reloadAfter =
function(force){
	return function(){
		return function(){
			// NOTE: this may seem like cheating, but .reload() should
			// 		be very efficient, reusing all of the items loaded...
			this.reload(force)
		}
	}
}


// XXX make this compatible with multiple images...
// XXX for muptiple targets this will just do a .reload()...
var updateImagePosition =
module.updateImagePosition =
function updateImagePosition(actions, target){
	if(actions.ribbons.getRibbonSet().length == 0){
		return
	}

	target = target || actions.current
	target = target instanceof jQuery 
		? actions.ribbons.getElemGID(target) 
		: target

	var source_ribbon = actions.ribbons.getElemGID(actions.ribbons.getRibbon(target))
	var source_order = actions.data.getImageOrder(target)

	return function(){
		actions.ribbons.preventTransitions()

		// XXX hack...
		if(target.constructor === Array){
			actions.reload()
			return
		}

		var target_ribbon = actions.data.getRibbon(target)

		// nothing changed...
		if(source_ribbon == target_ribbon 
				&& actions.data.getImageOrder(target) == source_order){
			return
		}

		// place image at position...
		var to = actions.data.getImage(target, 'next')
		if(to != null){
			actions.ribbons.placeImage(target, to, 'before')

		} else {
			// place image after position...
			to = actions.data.getImage(target, 'prev')
			if(to != null){
				actions.ribbons.placeImage(target, to, 'after')

			// new ribbon...
			} else {
				to = actions.data.getRibbon(target)

				if(actions.ribbons.getRibbon(to).length == 0){
					actions.ribbons.placeRibbon(to, actions.data.getRibbonOrder(target))
				}

				actions.ribbons.placeImage(target, to)
			}
		}

		if(actions.data.getImages(source_ribbon).length == 0){
			actions.ribbons.getRibbon(source_ribbon).remove()
		}

		actions.focusImage()

		actions.ribbons.restoreTransitions(true)
	}
}



/*********************************************************************/

// Workspaces:
// 	ui-chrome-hidden		- all features handling chrome elements 
// 								should hide all the chrome when this 
// 								workspace loads.
// 								NOTE: other workspace functionality 
// 									should be handled without change.
//
// NOTE: this uses the base feature API but does not need it imported...
//
// XXX split this into read and write actions...
var ViewerActions = 
module.ViewerActions = actions.Actions({
	config: {
		// The maximum screen width allowed when zooming...
		'max-screen-images': 30,

		// A step (multiplier) used by .zoomIn()/.zoomOut() actions.
		// NOTE: this is rounded to the nearest whole screen width in images
		// 		and current fit-overflow added.
		'zoom-step': 1.2,

		// added to odd number of images to fit to indicate scroll ability...
		// ...this effectively sets the closest distance an image can be from
		// the viewer edge...
		'fit-overflow': 0.2,

		
		// Theme to set on startup...
		'theme': null,

		// Supported themes...
		'themes': [
			'gray', 
			'dark', 
			'light',
		],

		'ribbon-theme': 'black',
		'ribbon-themes': [
			'black-ribbon',
			'gray-ribbon',
			'light-gray-ribbon',
			'transparent-ribbon',
		],

		// XXX BUG: for some reason this get's shadowed by base.config...
		'ribbon-focus-modes': [
			'visual',	// select image closest visually 

			'order',	// select image closest to current in order
			'first',	// select first image
			'last',		// select last image
		],
		'ribbon-focus-mode': 'visual',
	},

	// Images...
	// XXX this seems like a hack...
	// 		...should this be here???
	get images(){
		return this.ribbons != null ? this.ribbons.images : null
	},
	// NOTE: if ribbons are null this will have no effect...
	set images(value){
		if(this.ribbons != null){
			this.ribbons.images = value
		}
	},

	get screenwidth(){
		return this.ribbons != null ? this.ribbons.getScreenWidthImages() : null
	},
	set screenwidth(n){
		this.fitImage(n)
	},

	get screenheight(){
		return this.ribbons != null ? this.ribbons.getScreenHeightRibbons() : null
	},
	set screenheight(n){
		this.fitRibbon(n)
	},


	load: [
		function(data){
			return function(){
				// recycle the viewer if one is not given specifically...
				var viewer = data.viewer
				viewer = viewer == null && this.ribbons != null 
					? this.ribbons.viewer 
					: viewer

				if(this.ribbons == null){
					this.ribbons = ribbons.Ribbons(viewer, this.images)
					// XXX is this correct???
					this.ribbons.__image_updaters = [this.updateImage.bind(this)]

				} else {
					this.ribbons.clear()
					this.ribbons.images = this.images
				}

				this.reload()
			}
		}],
	// NOTE: this will pass the .ribbons.updateData(..) a custom ribbon 
	// 		updater if one is defined here as .updateRibbon(target) action
	//
	// XXX HACK: two sins:
	// 		- actions.updateRibbon(..) and ribbons.updateRibbon(..)
	// 		  are NOT signature compatible...
	// 		- we depend on the internals of a custom add-on feature
	reload: ['Interface/Reload viewer',
		function(force){
			this.ribbons.preventTransitions()

			// NOTE: this essentially sets the update threshold to 0...
			// XXX this should be a custom arg...
			force = force ? 0 : null

			return function(){
				// see if we've got a custom ribbon updater...
				var that = this
				var settings = this.updateRibbon != null 
					// XXX this should be: { updateRibbon: this.updateRibbon.bind(this) }
					? { updateRibbon: function(_, ribbon){ 
							return that.updateRibbon(ribbon, null, null, force) 
						} }
					: null

				this.ribbons.updateData(this.data, settings)

				this
					// XXX should this be here???
					.refresh()
					.focusImage()

				this.ribbons.restoreTransitions()
			}
		}],
	// NOTE: this will trigger .updateImage hooks...
	refresh: ['Interface/Refresh images without reloading',
		function(gids){
			gids = gids || '*'
			this.ribbons.updateImage(gids)
		}],
	clear: [
		function(){ this.ribbons && this.ribbons.clear() }],
	clone: [function(full){
		return function(res){
			if(this.ribbons){
				// NOTE: this is a bit wasteful as .ribbons will clone 
				// 		their ref to .images that we will throw away...
				res.ribbons = this.ribbons.clone()
				res.ribbons.images = res.images
			} 
		}
	}],


	replaceGid: [
		function(from, to){
			return function(res){
				res && this.ribbons.replaceGid(from, to)
			}
		}],

	// This is called by .ribbons, the goal is to use it to hook into 
	// image updating from features and extensions...
	//
	// NOTE: not intended for calling manually, use .refresh(..) instead...
	//
	// XXX experimental...
	// 		...need this to get triggered by .ribbons
	// 		at this point manually triggering this will not do anything...
	// XXX problem: need to either redesign this or distinguish from 
	// 		other actions as I keep calling it expecting results...
	// XXX hide from user action list...
	updateImage: ['- Interface/Update image (This will do nothing)',
		'This will be called by .refresh(..) and intended for use as an '
			+'trigger for handlers, and not as a callable acation.',
		function(gid, image){ }],


	// General UI stuff...
	// NOTE: this is applicable to all uses...
	toggleTheme: ['Interface/Toggle viewer theme', 
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			function(){ return this.config.themes },
			function(state){ this.config.theme = state }) ],
	toggleRibbonTheme: ['Interface/Toggle ribbon theme', 
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			function(){ return this.config['ribbon-themes'] },
			function(state){ this.config['ribbon-theme'] = state }) ],
	setEmptyMsg: ['- Interface/Set message to be displayed when nothing is loaded.',
		function(msg, help){ this.ribbons 
			&& this.ribbons.length > 0 
			&& this.ribbons.setEmptyMsg(msg, help) }],


	// align modes...
	// XXX these should also affect up/down navigation...
	// 		...navigate by proximity (closest to center) rather than by
	// 		order...
	// XXX skip off-screen ribbons (???)
	alignByOrder: ['Interface/Align ribbons by image order',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			// NOTE: the ordering of calls here makes it simpler to load
			// 		data into ribbons based on target gid... i.e. first
			// 		we know the section we need then align it vertically...
			this
				.centerImage(gid)
				.centerRibbon(gid)

			// if we are going fast we might skip an update... 
			if(this._align_timeout != null){
				clearTimeout(this._align_timeout)
				this._align_timeout = null
			}
			var that = this
			this._align_timeout = setTimeout(function(){
				this._align_timeout = null
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons... (???)

					// center...
					// XXX is there a 'last' special case here???
					var t = data.getImage(gid, r)
					if(t == null){
						var f = data.getImage('first', r)
						// nothing found -- empty ribbon?
						if(f == null){
							continue
						}
						that.centerImage(f, 'before')
					} else {
						that.centerImage(t, 'after')
					}
				}
			}, 50)
		}],
	alignByFirst: ['Interface/Align ribbons except current to first image',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			this
				.centerRibbon(gid)
				.centerImage(gid)

			var that = this
			//setTimeout(function(){
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons...

					// XXX see if we need to do some loading...

					// center...
					var f = data.getImage('first', r)
					// nothing found -- empty ribbon?
					if(f == null){
						continue
					}
					that.centerImage(f, 'before')
				}
			//}, 0)
		}],

	// NOTE: this will align only a single image...
	// XXX do we need these low level primitives here???
	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align)
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerRibbon(target)
		}],
	centerViewer: ['- Interface/Center the viewer',
		function(target){
			this
				.centerImage(target)
				.centerRibbon(target)
				.ribbons
					.origin(target)
		}],

	focusImage: [
		function(target, list){
			var ribbons = this.ribbons
			var data = this.data

			// NOTE: we do not need to do anything in the alternative 
			// 		case as it's done in data/Client, so we'll just 
			// 		peek there later...
			if(data == null){
				target = ribbons.focusImage(target)
				var gid = ribbons.getElemGID(target)
			}

			return function(){
				if(data != null){
					// use the data for all the heavy lifting...
					// NOTE: this will prevent sync errors...
					var gid = data.getImage()

					target = ribbons.focusImage(gid)
				}
			}
		}],
	focusRibbon: [
		function(target, mode){
			mode = mode || this.config['ribbon-focus-mode']

			var c = this.data.getRibbonOrder()
			var i = this.data.getRibbonOrder(target)
			// NOTE: we are not changing the direction here based on 
			// 		this.direction as swap will confuse the user...
			var direction = c < i ? 'before' : 'after'

			if(mode == 'visual'){
				var ribbons = this.ribbons
				var r = this.data.getRibbon(target)
				var t = ribbons.getImageByPosition('current', r)

				if(t.length > 1){
					t = t.eq(direction == 'before' ? 0 : 1)
				}

				t = ribbons.getElemGID(t)

				this.focusImage(t, r)
			}
		}],
	setBaseRibbon: [
		function(target){
			var r = this.data.getRibbon(target)
			r =  r == null ? this.ribbons.getRibbon(target) : r
			this.ribbons.setBaseRibbon(r)
		}],

	// NOTE: these prioritize whole images, i.e. each image will at least
	// 		once be fully shown.
	prevScreen: ['Navigate/Screen width back',
		function(){
			// NOTE: the 0.2 is added to compensate for alignment/scaling
			// 		errors -- 2.99 images wide counts as 3 while 2.5 as 2.
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.prevImage(w)
		}],
	nextScreen: ['Navigate/Screen width forward',
		function(){
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.nextImage(w)
		}],

	// zooming...
	//
	// Zooming is done by multiplying the current scale by config['zoom-step']
	// and rounding to nearest discrete number of images to fit on screen.
	zoomIn: ['Zoom/Zoom in',
		function(){ 
			this.ribbons.origin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())-1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.scale() * d
			var n = Math.floor(this.ribbons.getScreenWidthImages(s))
		
			this.fitImage(n <= 0 ? 1 : n)
		}],
	zoomOut: ['Zoom/Zoom out',
		function(){ 
			this.ribbons.origin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())+1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.scale() / d
			var n = Math.ceil(this.ribbons.getScreenWidthImages(s))

			var max = this.config['max-screen-images']
			this.fitImage(n > max ? max : n)
		}],

	fitOrig: ['Zoom/Fit to original scale',
		function(){ 
			this.ribbons.scale(1) 
			this.refresh()
		}],
	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	// NOTE: this will add .config['fit-overflow'] to odd counts if no 
	// 		overflow if passed.
	// 		...this is done to add ability to control scroll indication.
	fitImage: ['Zoom/Fit image',
		function(count, overflow){
			if(count != null){
				overflow = overflow == false ? 0 : overflow
				var o = overflow != null ? overflow 
					: count % 2 != 1 ? 0
					: (this.config['fit-overflow'] || 0)
				count += o
			}
			this.ribbons.fitImage(count)
			this.refresh()
		}],
	fitMax: ['Zoom/Fit the maximum number of images',
		function(){ this.fitImage(this.config['max-screen-images']) }],


	// XXX the question with these is how to make these relatively 
	// 		similar across platforms...
	// 		...for this we need to get display dpi...
	fitSmall: ['Zoom/Show small image',
		function(){  }],
	fitNormal: ['Zoom/Show normal image',
		function(){  }],
	fitScreen: ['Zoom/Fit image to screen',
		function(){  }],


	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count){
			this.ribbons.fitRibbon(count)
			this.refresh()
		}],


	// NOTE: these work by getting the target position from .data...
	shiftImageTo: [ 
		function(target){ return updateImagePosition(this, target) }],
	shiftImageUp: [ 
		function(target){ return updateImagePosition(this, target) }],
	shiftImageDown: [
		function(target){ return updateImagePosition(this, target) }],
	shiftImageLeft: [
		function(target){ this.ribbons.placeImage(target, -1) }],
	shiftImageRight: [
		function(target){ this.ribbons.placeImage(target, 1) }],

	/*
	// XXX how should these animate???
	travelImageUp: [
		function(){
		}],
	travelImageDown: [
		function(){
		}],
	*/

	shiftRibbonUp: [
		function(target){
			target = this.ribbons.getRibbon(target)
			var i = this.ribbons.getRibbonOrder(target)
			if(i > 0){
				this.ribbons.placeRibbon(target, i-1)
			}
		}],
	shiftRibbonDown: [
		function(target){
			target = this.ribbons.getRibbon(target)
			var i = this.ribbons.getRibbonOrder(target)
			if(i < this.data.ribbon_order.length-1){
				this.ribbons.placeRibbon(target, i+1)
			}
		}],

	reverseImages: [ reloadAfter() ],
	reverseRibbons: [ reloadAfter() ],


	// basic image editing...
	//
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: [ 
		function(target){ this.ribbons.rotateCW(target) }],
	rotateCCW: [ 
		function(target){ this.ribbons.rotateCCW(target) }],
	flipVertical: [ 
		function(target){ this.ribbons.flipVertical(target, 'view') }],
	flipHorizontal: [
		function(target){ this.ribbons.flipHorizontal(target, 'view') }],


	// tags...
	tag: [ 
		function(tags, gids){ 
			gids = gids != null && gids.constructor !== Array ? [gids] : gids
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],
	untag: [
		function(tags, gids){ 
			gids = gids != null && gids.constructor !== Array ? [gids] : gids
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],


	// group stuff...
	group: [ reloadAfter(true) ],
	ungroup: [ reloadAfter(true) ],
	groupTo: [ reloadAfter(true) ],
	groupMarked: [ reloadAfter(true) ],
	expandGroup: [ reloadAfter(true) ],
	collapseGroup: [ reloadAfter(true) ],


	// XXX BUG? reloadAfter() here does not remove some images...
	crop: [ reloadAfter(true) ],
	// XXX BUG? reloadAfter() produces an align error...
	uncrop: [ reloadAfter(true) ],
	// XXX might be a good idea to do this in a new viewer in an overlay...
	cropGroup: [ reloadAfter() ],


	// XXX experimental: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	toggleRibbonList: ['Interface/Toggle ribbons as images view',
		function(){
			if(this._full_data == null){
				// XXX do a better name here...
				this._full_data = this.data

				// generate the view...
				this.data = this.data.cropRibbons()

			} else {
				var data = this._full_data
				delete this._full_data

				// restore...
				this.data = data.mergeRibbonCrop(this.data)
			}

			this.reload()
		}],
})

var Viewer =
module.Viewer = core.ImageGridFeatures.Feature({
	title: 'Graphical User Interface',

	tag: 'ui',

	depends: [
		'lifecycle',
		'base',
		'workspace',
	],

	actions: ViewerActions,

	// check if we are running in a UI context...
	// NOTE: this will prevent loading of any features dependant on the 
	// 		UI in a non UI context...
	isApplicable: function(){ return typeof(window) == typeof({}) },

	handlers: [
		['start',
			function(){
				var that = this

				// load themes from config...
				this.config.theme 
					&& this.toggleTheme(this.config.theme)
				this.config['ribbon-theme'] 
					&& this.toggleRibbonTheme(this.config['ribbon-theme'])

				// center viewer on resize events...
				if(!this.__viewer_resize){
					this.__viewer_resize = function(){
						if(that.__centering_on_resize){
							return
						}
						// this will prevent centering calls from overlapping...
						that.__centering_on_resize = true

						that.centerViewer()

						delete that.__centering_on_resize
					}

					$(window).resize(this.__viewer_resize)
				}

				// setup basic workspaces...
				if(this.workspaces['ui-chrome-hidden'] == null){
					this.workspaces['ui-chrome-hidden'] = {}
				}
			}],
		['stop', 
			function(){
				if(this.__viewer_resize){
					$(window).off('resize', this.__viewer_resize) 
					delete this.__viewer_resize
				}
			}],
	],
})



//---------------------------------------------------------------------

// Format:
// 	{
// 		<action>: <undo-action> | <undo-function> | null,
// 		...
// 	}
var journalActions = {
	clear: null,
	load: null,

	setBaseRibbon: null,

	// XXX need to account for position change, i.e. if action had no 
	// 		effect then do nothing...
	// 		...take target position before and after...
	shiftImageTo: null,

	shiftImageUp: 'shiftImageDown',
	shiftImageDown: 'shiftImageUp',
	shiftImageLeft: 'shiftImageRight',
	shiftImageRight: 'shiftImageLeft',
	shiftRibbonUp: 'shiftRibbonDown',
	shiftRibbonDown: 'shiftRibbonUp',

	rotateCW: 'rotateCCW',
	rotateCCW: 'rotateCW',
	flipHorizontal: 'flipHorizontal',
	flipVertical: 'flipVertical',

	sortImages: null,
	reverseImages: 'reverseImages',
	reverseRibbons: 'reverseRibbons',

	crop: null,
	uncrop: null,

	tag: null, 
	untag: null,

	group: null,
	ungroup: null,
	expandGroup: null,
	collapseGroup: null,

	runJournal: null,
}

function logImageShift(action){
	return [action.slice(-4) != '.pre' ? 
			action + '.pre' 
			: action,
		function(target){
			target = this.data.getImage(target)
			var args = args2array(arguments)

			var o = this.data.getImageOrder(target)
			var r = this.data.getRibbon(target)
			var current = this.current

			return function(){
				var on = this.data.getImageOrder(target)
				var rn = this.data.getRibbon(target)

				if(o == on || r == rn){ 
					/*
					this.journalPush(
						this.current, 
						action, 
						args,
						{
							before: [r, o],
							after: [rn, on],
						})
					*/
					this.journalPush({
						type: 'shift',
						current: current, 
						target: target,
						action: action, 
						args: args,
						undo: journalActions[action],
						diff: {
							before: [r, o],
							after: [rn, on],
						},
					})
				}
				
			}
		}]
}


// XXX is this the right level for this???
// 		...data seems to be a better candidate...
// XXX would be great to add a mechanism define how to reverse actions...
// 		...one way to do this at this point is to revert to last state
// 		and re-run the journal until the desired event...
// XXX need to define a clear journaling strategy in the lines of:
// 		- save state clears journal and adds a state load action
// 		- .load(..) clears journal
// XXX needs careful testing...
var Journal = 
module.Journal = core.ImageGridFeatures.Feature({
	title: 'Action Journal',

	tag: 'system-journal',

	depends: ['base'],

	actions: actions.Actions({

		journal: null,
		rjournal: null,

		clone: [function(full){
				return function(res){
					res.rjournal = null
					res.journal = null
					if(full && this.hasOwnProperty('journal') && this.journal){
						res.journal = JSON.parse(JSON.stringify(this.journal))
					}
				}
			}],

		// XXX might be good to add some kind of metadata to journal...
		journalPush: ['- Journal/Add an item to journal',
			function(data){
				this.journal = (this.hasOwnProperty('journal') 
						|| this.journal) ? 
					this.journal 
					: []
				this.journal.push(data)
			}],
		clearJournal: ['Journal/Clear the action journal',
			function(){
				if(this.journal){
					// NOTE: overwriting here is better as it will keep
					// 		shadowing the parent's .journal in case we 
					// 		are cloned.
					// NOTE: either way this will have no effect as we 
					// 		only use the local .journal but the user may
					// 		get confused...
					//delete this.journal
					this.journal = null
				}
			}],
		runJournal: ['- Journal/Run journal',
			function(journal){
				var that = this
				journal.forEach(function(e){
					// load state...
					that
						.focusImage(e.current)
						// run action...
						[e.action].apply(that, e.args)
				})
			}],

		// XXX need to clear the rjournal as soon as we do something...
		// 		...at this point it is really easy to mess things up by
		// 		undoing something, and after some actions doing a 
		// 		.redoLast(..)
		// XXX this is not ready for production...
		undoLast: ['Journal/Undo last',
			function(){
				var journal = this.journal
				this.rjournal = (this.hasOwnProperty('rjournal') 
						|| this.rjournal) ? 
					this.rjournal 
					: []

				for(var i = journal.length-1; i >= 0; i--){
					var a = journal[i]

					// we undo only a very specific set of actions...
					if(a.undo && a.type == 'shift' && a.args.length == 0){
						this
							.focusImage(a.current)
							[a.undo].call(this, a.target)

						// pop the undo command...
						this.journal.pop()
						this.rjournal.push(journal.splice(i, 1)[0])
						break
					}
				}
			}],
		_redoLast: ['Journal/Redo last',
			function(){
				if(!this.rjournal || this.rjournal.length == 0){
					return
				}

				this.runJournal([this.rjournal.pop()])
			}],
	}),

	// log state, action and its args... 
	// XXX need to drop journal on save...
	// XXX rotate/truncate journal???
	// XXX need to check that all the listed actions are clean -- i.e.
	// 		running the journal will produce the same results as user 
	// 		actions that generated the journal.
	// XXX would be good if we could know the name of the action in the 
	// 		handler, thus enabling us to define a single handler rather
	// 		than generating a custom handler per action...
	handlers: [
		logImageShift('shiftImageTo'),
		logImageShift('shiftImageUp'),
		logImageShift('shiftImageDown'),
		logImageShift('shiftImageLeft'),
		logImageShift('shiftImageRight'),
		logImageShift('shiftRibbonUp'),
		logImageShift('shiftRibbonDown'),

	].concat([
			'clear',
			'load',

			'setBaseRibbon',

			'rotateCW',
			'rotateCCW',
			'flipHorizontal',
			'flipVertical',

			'sortImages',
			'reverseImages',
			'reverseRibbons',

			'crop',
			'uncrop',

			'tag', 
			'untag',

			'group',
			'ungroup',
			'expandGroup',
			'collapseGroup',

			//'runJournal',
		].map(function(action){
			return [
				action+'.pre', 
				function(){
					this.journalPush({
						type: 'basic',
						current: this.current, 
						action: action, 
						args: args2array(arguments),
					})
				}]
		})), 
})



//---------------------------------------------------------------------

// XXX add setup/taredown...
var Clickable = 
module.Clickable = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-clickable',
	depends: ['ui'],

	handlers: [
		// setup click targets...
		// XXX click only if we did not drag...
		['updateImage', 
			function(res, gid){
				var that = this
				var img = this.ribbons.getImage(gid)

				// set the clicker only once...
				if(!img.prop('clickable')){
					var x, y
					img
						.prop('clickable', true)
						.on('mousedown touchstart', function(){ 
							x = event.clientX
							y = event.clientY
							t = Date.now()
						})
						.on('mouseup touchend', function(){ 
							if(x != null 
								&& Math.max(
									Math.abs(x - event.clientX), 
									Math.abs(y - event.clientY)) < 5){
								// this will prevent double clicks...
								x = null
								y = null
								that.focusImage(that.ribbons.getElemGID($(this)))
							}
						})
				}
			}],
	],
})



//---------------------------------------------------------------------
// Auto-hide cursor...

// NOTE: removing the prop 'cursor-autohide' will stop hiding the cursor
// 		and show it on next timeout/mousemove.
// 		This will not stop watching the cursor, this setting the prop back
// 		on will re-enable autohide.
// 		XXX needs testing...
// NOTE: chrome 49 + devtools open appears to prevent the cursor from being hidden...
var AutoHideCursor = 
module.AutoHideCursor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-autohide-cursor',
	depends: ['ui'],

	config: {
		'cursor-autohide-timeout': 1000,
		'cursor-autohide-threshold': 10,
	},

	actions: actions.Actions({
		toggleAutoHideCursor: ['Interface/Toggle cursor auto hiding',
			toggler.CSSClassToggler(
				function(){ return this.ribbons.viewer }, 
				'cursor-hidden',
				function(state){
					var that = this
					var viewer = this.ribbons.viewer

					// setup...
					if(state == 'on'){
						var x, y
						var timer
						var timeout = this.config['cursor-autohide-timeout'] || 1000

						var handler 
							= this.__cursor_autohide_handler 
							= (this.__cursor_autohide_handler 
								|| function(){
									timer && clearTimeout(timer)

									var threshold = that.config['cursor-autohide-threshold'] || 0
									x = x || event.clientX
									y = y || event.clientY

									// show only if cursor moved outside of threshold...
									if(threshold > 0){ 
										if(Math.max(Math.abs(x - event.clientX), 
												Math.abs(y - event.clientY)) > threshold){
											x = y = null
											that.ribbons.viewer
												.removeClass('cursor-hidden')
										}

									// show right away -- no threshold...
									} else {
										that.ribbons.viewer
											.removeClass('cursor-hidden')
									}

									var timeout = that.config['cursor-autohide-timeout'] || 1000
									if(timeout && timeout > 0){
										timer = setTimeout(function(){
											var viewer = that.ribbons.viewer

											if(!viewer.prop('cursor-autohide')){
												viewer.removeClass('cursor-hidden')
												return
											}

											timer && viewer.addClass('cursor-hidden')
										}, timeout)
									}
								})

						// do the base setup...
						!viewer.prop('cursor-autohide')
							&& viewer
								.prop('cursor-autohide', true)
								.addClass('cursor-hidden')
								// prevent multiple handlers...
								.off('mousemove', this.__cursor_autohide_handler)
								.mousemove(handler)

					// teardown...
					} else {
						viewer
							.off('mousemove', this.__cursor_autohide_handler)
							.prop('cursor-autohide', false)
							.removeClass('cursor-hidden')
						delete this.__cursor_autohide_handler
					}
				})],
	}),
})


// This will store/restore autohide state for single-image and ribbon 
// views...
//
// NOTE: chrome 49 + devtools open appears to prevent the cursor from being hidden...
//
// XXX hiding cursor on navigation for some reason does not work...
var AutoHideCursorSingleImage = 
module.AutoHideCursorSingleImage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-autohide-cursor-single-image-view',
	depends: [
		'ui-autohide-cursor',
		'ui-single-image-view',
	],

	config: {
		'cursor-autohide-single-image-view': 'on',
		'cursor-autohide-ribbon-view': 'off',

		//'cursor-autohide-on-navigate': true, 
	},

	handlers: [
		// setup...
		['load',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-single-image-view'
					: 'cursor-autohide-ribbon-view'

				this.toggleAutoHideCursor(this.config[mode] || 'off')
			}],
		// store state for each mode...
		['toggleAutoHideCursor',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-single-image-view'
					: 'cursor-autohide-ribbon-view'

				this.config[mode] = this.toggleAutoHideCursor('?')
			}],
		// restore state per mode...
		['toggleSingleImage', 
			function(){
				if(this.toggleSingleImage('?') == 'on'){
					this.toggleAutoHideCursor(this.config['cursor-autohide-single-image-view'])

				} else {
					this.toggleAutoHideCursor(this.config['cursor-autohide-ribbon-view'])
				}
			}],
		/* XXX for some reason this does not work...
		// autohide on navigation...
		['focusImage', 
			function(){
				//if(this.config['cursor-autohide-on-navigate'] 
				//		&& this.toggleAutoHideCursor('?') == 'on'){
				//	this.toggleAutoHideCursor('on')
				//}
				if(this.config['cursor-autohide-on-navigate'] 
						&& this.toggleAutoHideCursor('?') == 'on'
						&& this.ribbons.viewer.prop('cursor-autohide')){
					this.ribbons.viewer
						.addClass('cursor-hidden')
				}
			}],
		*/
	]
})



//---------------------------------------------------------------------

var ConfigLocalStorageActions = actions.Actions({
	config: {
		'config-local-storage-key': 'config',
		
		// NOTE: this is in seconds...
		// NOTE: if this is null or 0 the timer will not start...
		'config-auto-save-local-storage-interval': 3*60,

		// XXX not sure what should be the default...
		'config-local-storage-save-diff': true,
	},

	// XXX should we store this in something like .default_config and
	// 		clone it???
	// 		...do not think so, as the __base_config xhould always be set
	// 		to the values set in code... (check this!)
	__base_config: null,
	__config_loaded: null,
	__auto_save_config_timer: null,

	// Disable localStorage in child, preventing two viewers from messing
	// things up in one store...
	clone: [function(){
		return function(res){
			res.config['config-local-storage-key'] = null
		}
	}],

	storeConfig: ['File/Store configuration',
		function(key){
			var key = key || this.config['config-local-storage-key']

			if(key != null){
				// build a diff...
				if(this.config['config-local-storage-save-diff']){
					var base = this.__base_config || {}
					var cur = this.config
					var config = {}
					Object.keys(cur)
						.forEach(function(e){
							if(cur.hasOwnProperty(e) 
									&& base[e] != cur[e] 
									// NOTE: this may go wrong for objects
									// 		if key order is different...
									// 		...this is no big deal as false
									// 		positives are not lost data...
									|| JSON.stringify(base[e]) != JSON.stringify(cur[e])){
								config[e] = cur[e]
							}
						})

				// full save...
				} else {
					var config = this.config
				}

				// store...
				localStorage[key] = JSON.stringify(config) 
			}
		}],
	loadStoredConfig: ['File/Load stored configuration',
		function(key){
			key = key || this.config['config-local-storage-key']

			if(key && localStorage[key]){
				// get the original (default) config and keep it for 
				// reference...
				// NOTE: this is here so as to avoid creating 'endless'
				// 		config inheritance chains...
				base = this.__base_config = this.__base_config || this.config

				var loaded = JSON.parse(localStorage[key])
				loaded.__proto__ = base

				this.config = loaded 
			}
		}],
	// XXX need to load the reset config, and not just set it...
	resetConfig: ['File/Reset configuration to default state',
		function(){
			this.config = this.__base_config || this.config
		}],

	toggleAutoStoreConfig: ['File/Store configuration',
		toggler.Toggler(null, function(_, state){ 
				if(state == null){
					return this.__auto_save_config_timer || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-local-storage-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// this cleans up before 'on' and fully handles 'off' action...
					if(this.__auto_save_config_timer != null){
						clearTimeout(this.__auto_save_config_timer)
						delete this.__auto_save_config_timer
					}

					if(state == 'running' 
							&& interval 
							&& this.__auto_save_config_timer == null){

						var runner = function(){
							clearTimeout(that.__auto_save_config_timer)

							//that.logger && that.logger.emit('config', 'saving to local storage...')
							that.storeConfig()

							var interval = that.config['config-auto-save-local-storage-interval']
							if(!interval){
								delete that.__auto_save_config_timer
								return
							}
							interval *= 1000

							that.__auto_save_config_timer = setTimeout(runner, interval)
						}

						runner()
					}
				}
			},
			'running')],
})

var ConfigLocalStorage = 
module.ConfigLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'config-local-storage',
	depends: [
		'ui',
	],
	priority: 80,

	isApplicable: function(){ 
		return typeof(localStorage) != 'undefined' 
			&& localStorage != null },

	actions: ConfigLocalStorageActions,

	handlers: [
		// NOTE: considering that allot depends on this it must be 
		// 		first to run...
		['start.pre',
			function(){ 
				this.logger && this.logger.emit('loaded', 'config')
				this
					.loadStoredConfig() 
					.toggleAutoStoreConfig('on')
			}],
		['stop.pre',
			function(){ 
				this.logger && this.logger.emit('loaded', 'config')
				this
					.storeConfig() 
					.toggleAutoStoreConfig('off')
			}],
	],
})



//---------------------------------------------------------------------

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
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

			// get a stet of paths...
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
					//|| this.ribbons.getImage(target).length == 0
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
		['fitImage.pre', 
			function(n){
				this.updateRibbon('current', n || 1)
				//this.preCacheJumpTargets()
			}],
		['fitRibbon.pre', 
			function(n){
				n = n || 1

				// convert target height in ribbons to width in images...
				// NOTE: this does not account for compensation that 
				// 		.updateRibbon(..) makes for fitting whole image
				// 		counts, this is a small enough error so as not
				// 		to waste time on...
				var s = this.ribbons.scale()
				var h = this.ribbons.getScreenHeightRibbons()
				var w = this.ribbons.getScreenWidthImages()
				var nw = w / (h/n)

				this.updateRibbon('current', nw)
				//this.preCacheJumpTargets()
			}],
	],
})



//---------------------------------------------------------------------

var SingleImageActions = actions.Actions({
	config: {
		// NOTE: these will get overwritten if/when the user changes the scale...
		'single-image-scale': null,
		'ribbon-scale': null,
	},

	toggleSingleImage: ['Interface/Toggle single image view', 
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			'single-image-mode') ],
})

// helper...
// XXX should this be an action???
function updateImageProportions(){
	// XXX
}


// XXX an ideal case would be:
//
// A)
//       viewer
//      +---------------+
//      |     image     |   - small image
//      |     +---+     |   - square image block
//      |     |   |     |   - smaller than this the block is always square
//      |     +---+     |   - we just change scale
//      |               |
//      +---------------+
//
//
// B)
//       viewer
//      +---------------+
//      | +-----------+ |   - bigger image
//      | | image     | |   - block close to viewer proportion
//      | |    <-->   | |   - image block growing parallel to viewer
//      | |           | |     longer side
//      | +-----------+ |   - this stage is not affected specific by image
//      +---------------+     proportions and can be done in bulk
//
//
// C)
//       viewer
//      +---------------+
//      | image         |   - image block same size as viewer
//      |               |   - need to account for chrome
//      |               |
//      |               |
//      |               |
//      +---------------+
//
//
// D)
//       image
//      + - - - - - - - +
//      .               .
//      +---------------+
//      | viewer        |   - image bigger than viewer in one dimension
//      |       ^       |   - block grows to fit image proportions
//      |       |       |   - need to account for individual image 
//      |       v       |     proportions
//      |               |   - drag enabled
//      +---------------+
//      .               .
//      + - - - - - - - +
//
//
// E) 
//     image
//    + - - - - - - - - - +
//    .                   .
//    . +---------------+ .
//    . | viewer        | . - image bigger than viewer 
//    . |               | . - image block same proportion as image
//    . |               | . - we just change scale
//    . |               | . - drag enabled
//    . |               | .
//    . +---------------+ .
//    .                   .
//    + - - - - - - - - - +
//
//
var SingleImageView =
module.SingleImageView = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view',
	depends: ['ui'],

	actions: SingleImageActions,

	handlers:[
		['fitImage.post',
			function(){ 

				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)

					this.config['single-image-scale'] = this.screenwidth

				} else {
					this.config['ribbon-scale'] = this.screenwidth
				}
			}],
		// NOTE: this is not part of the actual action above because we 
		// 		need to see if the state has changed and doing this with 
		// 		two separate pre/post callbacks (toggler callbacks) is 
		// 		harder than with two nested callbacks (action callbacks)
		// XXX this uses .screenwidth for scale, is this the right way to go?
		['toggleSingleImage.pre', 
			function(){ 
				var pre_state = this.toggleSingleImage('?')

				return function(){
					var state = this.toggleSingleImage('?')

					// singe image mode -- set image proportions...
					if(state == 'on'){
						updateImageProportions.call(this)

						// update scale...
						if(state != pre_state){
							var w = this.screenwidth
							this.config['ribbon-scale'] = w
							this.screenwidth = this.config['single-image-scale'] || w
						}

					// ribbon mode -- restore original image size...
					} else {
						this.ribbons.viewer.find('.image:not(.clone)').css({
							width: '',
							height: ''
						})

						// update scale...
						if(state != pre_state){
							var w = this.screenwidth
							this.config['single-image-scale'] = w
							this.screenwidth = this.config['ribbon-scale'] || w
						}
					}
				}
			}],
	],
})


var SingleImageViewLocalStorage =
module.SingleImageViewLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view-local-storage',
	depends: [
		'ui-single-image-view',
		'config-local-storage',
	],

	handlers:[
		// set scale...
		['load',
			function(){
				// prevent this from doing anything while no viewer...
				if(!this.ribbons || !this.ribbons.viewer || this.ribbons.viewer.length == 0){
					return
				}

				if(this.toggleSingleImage('?') == 'on'){
					this.screenwidth = this.config['single-image-scale'] || this.screenwidth

				} else {
					this.screenwidth = this.config['ribbon-scale'] || this.screenwidth
				}
			}],
	],
})


//---------------------------------------------------------------------
// These feature glue traverse and ribbon alignment...


// XXX manual align needs more work...
var AutoAlignRibbons = 
module.AutoAlignRibbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-auto-align',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		// control ribbon alignment...
		//
		// NOTE: when this is null then 'ribbon-focus-mode' will be used...
		// NOTE: this supports the same modes as 'ribbon-focus-mode'...
		'ribbon-align-modes': [
			'none',		// use .config['ribbon-focus-mode']'s value
			'visual',
			'order',
			'first',
			//'last',
			'manual',
		],
		'ribbon-align-mode': null,
	},

	actions: actions.Actions({
		toggleRibbonAlignMode : ['Interface/Toggle ribbon align mode',
			core.makeConfigToggler('ribbon-align-mode', 
				function(){ return this.config['ribbon-align-modes'] })],
	}),

	handlers: [
		['focusImage.post', 
			function(){ 
				var mode = this.config['ribbon-align-mode'] 
					|| this.config['ribbon-focus-mode']

				if(mode == 'visual' || mode == 'order'){
					this.alignByOrder() 

				} else if(mode == 'first'){
					this.alignByFirst()

				// manual...
				// XXX is this correct???
				} else {
					this
						.centerRibbon()
						.centerImage()
				}
			}],
	],
})


// XXX should .alignByOrder(..) be a feature-specific action or global 
// 		as it is now???
var AlignRibbonsToImageOrder = 
module.AlignRibbonsToImageOrder = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-order',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		//'ribbon-focus-mode': 'order',
		'ribbon-focus-mode': 'visual',
	},

	handlers: [
		['focusImage.post', function(){ this.alignByOrder() }]
	],
})


var AlignRibbonsToFirstImage = 
module.AlignRibbonsToFirstImage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-first',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		'ribbon-focus-mode': 'first',
	},

	handlers: [
		['focusImage.post', function(){ this.alignByFirst() }],
	],
})

// XXX needs more work...
// XXX need to save position in some way, ad on each load the same 
// 		initial state will get loaded...
// 		...also would need an initial state...
var ManualAlignRibbons = 
module.ManualAlignRibbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-manual-align',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		'ribbon-focus-mode': 'visual',
	},

	handlers: [
		['focusImage.post', function(){ 
			this
				.centerRibbon()
				.centerImage()
		}],
	],
})



//---------------------------------------------------------------------

// XXX at this point this does not support target lists...
// XXX shift up/down to new ribbon is not too correct...
var ShiftAnimation =
module.ShiftAnimation = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-animation',
	depends: ['ui'],

	handlers: [
		//['shiftImageUp.pre shiftImageDown.pre '
		//		+'travelImageUp.pre travelImageDown.pre', 
		['shiftImageUp.pre shiftImageDown.pre',
			function(target){
				// XXX do not do target lists...
				if(target != null && target.constructor === Array 
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target, true)
				return function(){ s() }
			}],
		// NOTE: this will keep the shadow in place -- the shadow will not
		// 		go to the mountain, the mountain will come to the shadow ;)
		['shiftImageLeft.pre shiftImageRight.pre', 
			function(target){
				// XXX do not do target lists...
				if(target != null && target.constructor === Array
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target)
				return function(){ s() }
			}],
	],
})



//---------------------------------------------------------------------

var BoundsIndicatorsActions = actions.Actions({
	flashIndicator: ['- Interface/Flash an indicator',
		function(direction){
			if(this.ribbons.getRibbonSet().length == 0){
				return
			}
			var cls = {
				// shift up/down...
				up: '.up-indicator',
				down: '.down-indicator',
				// hit start/end/top/bottom of view...
				start: '.start-indicator',
				end: '.end-indicator',
				top: '.top-indicator',
				bottom: '.bottom-indicator',
			}[direction]

			var indicator = this.ribbons.viewer.find(cls)

			if(indicator.length == 0){
				indicator = $('<div>')
					.addClass(cls.replace('.', '') +' '+ this.tag)
					.appendTo(this.ribbons.viewer)
			}

			return indicator
				// NOTE: this needs to be visible in all cases and key press 
				// 		rhythms... 
				.show()
				.delay(100)
				.fadeOut(300)
		}],
})

// helper...
function didAdvance(indicator){
	return function(){
		var img = this.data.current
		return function(){
			if(img == this.data.current){
				this.flashIndicator(indicator)
			}
		}
	}
}

var BoundsIndicators = 
module.BoundsIndicators = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-bounds-indicators',
	depends: ['ui'],

	actions: BoundsIndicatorsActions,

	handlers: [
		// basic navigation...
		['nextImage.pre lastImage.pre', didAdvance('end')],
		['prevImage.pre firstImage.pre', didAdvance('start')],
		['nextRibbon.pre lastRibbon.pre', didAdvance('bottom')],
		['prevRibbon.pre firstRibbon.pre', didAdvance('top')],

		// vertical shifting...
		['shiftImageUp.pre',
			function(target){ 
				target = target || this.current
				var r = this.data.getRibbonOrder(target)

				var l = this.data.getImages(r).length
				var l0 = this.data.getImages(0).length

				return function(){
					// when shifting last image of top ribbon (i.e. length == 1)
					// up the state essentially will not change...
					if((r == 0 && l == 1) 
							// we are shifting to a new empty ribbon...
							|| (r == 1 && l == 1 && l0 == 0)){
						this.flashIndicator('top')
					} else {	
						this.flashIndicator('up')
					}
				}
			}],
		['shiftImageDown.pre',
			function(target){ 
				target = target || this.current
				var r0 = this.data.getRibbonOrder(target)
				var l = this.data.getImages(r0).length

				return function(){
					var r1 = this.data.getRibbonOrder(target)
					if(r0 == r1 && r0 == this.data.ribbon_order.length-1 && l == 1){
						this.flashIndicator('bottom')
					} else {
						this.flashIndicator('down') 
					}
				}
			}],

		// horizontal shifting...
		['shiftImageLeft.pre',
			function(target){ 
				if(target == null 
						//&& actions.data.getImageOrder('ribbon') == 0){
						&& this.data.getImage('prev') == null){
					this.flashIndicator('start')
				}
			}],
		['shiftImageRight.pre',
			function(target){ 
				if(target == null 
						&& this.data.getImage('next') == null){
					this.flashIndicator('end')
				}
			}],
	],
})



//---------------------------------------------------------------------

var CurrentImageIndicatorActions = actions.Actions({
	config: {
		'current-image-border': 3,
		'current-image-min-border': 2,

		'current-image-border-timeout': 200,
		'current-image-shift-timeout': 200,

		'current-image-indicator-fadein': 500,

		'current-image-indicator-hide-timeout': 250,

		// this can be:
		// 	'hide'			- simply hide on next/prev screen action
		// 					  and show on focus image.
		// 	'hide-show'		- hide on fast scroll through screens and 
		// 					  show when slowing down.
		'current-image-indicator-screen-nav-mode': 'hide',
	},

	updateCurrentImageIndicator: ['- Interface/Update current image indicator',
		function(target, update_border){
			var ribbon_set = this.ribbons.getRibbonSet()

			if(ribbon_set.length == 0){
				return
			}

			var scale = this.ribbons.scale()
			var cur = this.ribbons.getImage(target)
			// NOTE: cur may be unloaded...
			var ribbon = this.ribbons.getRibbon(cur.length > 0 ? target : this.currentRibbon)

			var marker = ribbon.find('.current-marker')

			// remove marker if current image is not loaded...
			if(cur.length == 0){
				marker.remove()
				return
			}

			// get config...
			var border = this.config['current-image-border']
			var min_border = this.config['current-image-min-border']
			var border_timeout = this.config['current-image-border-timeout']
			var fadein = this.config['current-image-indicator-fadein']

			// no marker found -- either in different ribbon or not created yet...
			if(marker.length == 0){
				// get marker globally...
				marker = this.ribbons.viewer.find('.current-marker')

				// no marker exists -- create a marker...
				if(marker.length == 0){
					var marker = $('<div/>')
						.addClass('current-marker ui-current-image-indicator')
						.css({
							opacity: '0',
							// NOTE: these are not used for positioning
							// 		but are needed for correct absolute
							// 		placement...
							top: '0px',
							left: '0px',
						})
						.appendTo(ribbon)
						.animate({
							'opacity': 1
						}, fadein)
					this.ribbons.dom.setOffset(marker, 0, 0)

				// add marker to current ribbon...
				} else {
					marker.appendTo(ribbon)
				}
			}

			// NOTE: we will update only the attrs that need to be updated...
			var css = {}

			var w = cur.outerWidth(true)
			var h = cur.outerHeight(true)

			// keep size same as the image...
			if(marker.outerWidth() != w || marker.outerHeight() != h){
				css.width = w
				css.height = h
			}

			// update border...
			if(update_border !== false){
				var border = Math.max(min_border, border / scale)

				// set border right away...
				if(update_border == 'before'){
					css.borderWidth = border

				// set border with a delay...
				// NOTE: this is to prevent the ugly border resize before
				// 		the scale on scale down animation starts...
				} else {
					setTimeout(function(){ 
						marker.css({ borderWidth: border }) 
					}, border_timeout)
				}
			}

			//css.left = cur[0].offsetLeft
			this.ribbons.dom.setOffset(marker, cur[0].offsetLeft, 0)

			marker.css(css)
		}],
})

var CurrentImageIndicator = 
module.CurrentImageIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator',
	depends: ['ui'],

	actions: CurrentImageIndicatorActions,

	handlers: [
		// move marker to current image...
		['focusImage.post',
			function(){ this.updateCurrentImageIndicator() }],
		// prevent animations when focusing ribbons...
		['focusRibbon.pre',
			function(){
				var m = this.ribbons.viewer.find('.current-marker')
				this.ribbons.preventTransitions(m)
				return function(){
					this.ribbons.restoreTransitions(m)
				}
			}],
		// this is here to compensate for position change on ribbon 
		// resize...
		// NOTE: hide/show of indicator on resize appears to have solved
		// 		the jumpy animation issue.
		// 		this might cause some blinking on slow resizes (visible 
		// 		only on next/prev screen)... 
		// 		...still not sure why .preventTransitions(m) did not
		// 		do the job.
		['resizeRibbon.pre',
			function(target, s){
				var m = this.ribbons.viewer.find('.current-marker')
				// only update if marker exists and we are in current ribbon...
				if(m.length != 0 && this.currentRibbon == this.data.getRibbon(target)){
					//this.ribbons.preventTransitions(m)
					m.hide()

					return function(){
						this.updateCurrentImageIndicator(target, false)
						//this.ribbons.restoreTransitions(m, true)
						m
							.show()
							// NOTE: keeping display in inline style will
							// 		prevent the element from being hidden
							// 		by css...
							.css({display: ''})
					}
				}
			}],
		// Change border size in the appropriate spot in the animation:
		// 	- before animation when scaling up
		// 	- after when scaling down
		// This is done to make the visuals consistent...
		['fitImage.pre fitRibbon.pre',
			function(w1){ 
				var w0 = this.screenwidth
				w1 = w1 || 1
				return function(){
					this.updateCurrentImageIndicator(null, w0 > w1 ? 'before' : 'after') 
				}
			}],
		['shiftImageLeft.pre shiftImageRight.pre',
			function(){
				this.ribbons.viewer.find('.current-marker').hide()
				if(this._current_image_indicator_timeout != null){
					clearTimeout(this._current_image_indicator_timeout)
					delete this._current_image_indicator_timeout
				}
				return function(){
					var ribbons = this.ribbons
					var fadein = this.config['current-image-indicator-fadein']
					this._current_image_indicator_timeout = setTimeout(function(){ 
						ribbons.viewer.find('.current-marker').fadeIn(fadein)
					}, this.config['current-image-shift-timeout'])
				}
			}],
	],
})


var CurrentImageIndicatorHideOnFastScreenNav = 
module.CurrentImageIndicatorHideOnFastScreenNav = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-fast-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],


	handlers: [
		// hide indicator on screen next/prev...
		//
		// XXX experimental -- not sure if we need this...
		// XXX need to think about the trigger mechanics here and make 
		// 		them more natural...
		['prevScreen.pre nextScreen.pre',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')
				var t = this.config['current-image-indicator-hide-timeout']

				var cur = this.current

				return function(){
					var that = this

					// delay fadeout...
					if(cur != this.current 
							&& m.css('opacity') == 1
							&& this.__current_indicator_t0 == null){
						this.__current_indicator_t0 = setTimeout(function(){
							delete that.__current_indicator_t0

							m.css({ opacity: 0 })
						}, t)
					}

					// cancel/delay previous fadein...
					if(this.__current_indicator_t1 != null){
						clearTimeout(this.__current_indicator_t1)
					}

					// cancel fadeout and do fadein...
					this.__current_indicator_t1 = setTimeout(function(){
						delete that.__current_indicator_t1

						// cancel fadeout...
						if(that.__current_indicator_t0 != null){
							clearTimeout(that.__current_indicator_t0)
							delete that.__current_indicator_t0
						} 

						// show...
						m.animate({ opacity: '1' })
					}, t-50)
				}
			}],
	],
})

var CurrentImageIndicatorHideOnScreenNav = 
module.CurrentImageIndicatorHideOnScreenNav = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],


	handlers: [
		// 	this does the following:
		// 		- hide on screen jump
		// 		- show on any other action
		//
		// NOTE: we use .pre events here to see if we have moved...
		['prevScreen.post nextScreen.post',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')

				m.css({ opacity: 0 })
			}],
		['focusImage.post',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')

				m.css({ opacity: '' })
			}],
	],
})



//---------------------------------------------------------------------
// XXX this should:
// 	- float to the left of a ribbon if image #1 is fully visible (working)
// 	- float at left of viewer if image #1 is off screen...
// 	- float on the same level as the base ribbon...

// XXX make this an action...
var updateBaseRibbonIndicator = function(img){
	var scale = this.ribbons.scale()
	var base = this.ribbons.getRibbon('base')
	img = this.ribbons.getImage(img)
	var m = base.find('.base-ribbon-marker')

	if(base.length == 0){
		return
	}

	if(m.length == 0){
		m = this.ribbons.viewer.find('.base-ribbon-marker')

		// make the indicator...
		if(m.length == 0){
			m = $('<div>')
				.addClass('base-ribbon-marker')
				.text('base ribbon')
		}

		m.prependTo(base)
	}

	// XXX this is wrong -- need to calculate the offset after the move and not now...
	if(base.offset().left < 0){
		m.css('left', (img.position().left + img.width()/2 - this.ribbons.viewer.width()/2) / scale)

	} else {
		m.css('left', '')
	}
}

var BaseRibbonIndicator = 
module.BaseRibbonIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-base-ribbon-indicator',
	depends: ['ui'],

	handlers: [
		// move marker to current image...
		['focusImage.pre',
			function(target){ 
				updateBaseRibbonIndicator.call(this, target)
			}],
		// prevent animations when focusing ribbons...
		['focusRibbon.pre setBaseRibbon',
			function(){
				updateBaseRibbonIndicator.call(this)

				/*
				this.ribbons.preventTransitions(m)
				return function(){
					this.ribbons.restoreTransitions(m)
				}
				*/
			}],
	]
})


var PassiveBaseRibbonIndicator = 
module.PassiveBaseRibbonIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-passive-base-ribbon-indicator',
	depends: ['ui'],

	config: {
		'ui-show-passive-base-ribbon-indicator': true,
	},

	actions: actions.Actions({
		togglePassiveBaseRibbonIndicator: ['Interface/Toggle passive base ribbon indicator',
			toggler.CSSClassToggler(
				function(){ return this.ribbons.viewer }, 
				'show-passive-base-ribbon-indicator',
				function(state){ 
					this.config['ui-show-passive-base-ribbon-indicator'] = state == 'on' }) ],
	}),

	handlers: [
		['start',
			function(){
				this.togglePassiveBaseRibbonIndicator(
					this.config['ui-show-passive-base-ribbon-indicator'] ?
						'on' : 'off')
			}]
	],
})



//---------------------------------------------------------------------
// XXX experimental...

// 		...not sure if this is the right way to go...
// XXX need to get the minimal size and not the width as results will 
// 		depend on viewer format...
var AutoSingleImage = 
module.AutoSingleImage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'auto-single-image',

	// NOTE: this feature has no actions defined but needs the config...
	config: {
		'auto-single-image-in': 2,
		'auto-single-image-out': 7,
	},

	handlers: [
		['fitImage.pre',
			function(count){
				count = count || 1

				if(this.toggleSingleImage('?') == 'off' 
						&& count < this.config['auto-single-image-in']
						&& count < this.screenwidth){
					this.toggleSingleImage()

				} else if(this.toggleSingleImage('?') == 'on' 
						&& count >= this.config['auto-single-image-out']
						&& count > this.screenwidth){
					this.toggleSingleImage()
				}
			}],
	],
})

var AutoRibbon = 
module.AutoRibbon = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'auto-ribbon',

	handlers: [
		['nextRibbon prevRibbon',
			function(){
				this.toggleSingleImage('?') == 'on' 
					&& this.toggleSingleImage('off') }],
	],
})


//---------------------------------------------------------------------

// Adds user management of different back-ends for low level ribbon 
// alignment and placement...
var RibbonsPlacement = 
module.RibbonsPlacement = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbons-placement',
	depends: [ 'ui' ],

	config: {
		// NOTE: the adapter names bust be registered in the ribbons module
		// 		...not sure if this is good, but it's how it works now...
		'ui-ribbons-placement-modes': {
			'legacy': 'legacyDOMAdapter',
			'new': 'DOMAdapter',
		},
		'ui-ribbons-placement-mode': 'new',
	},

	actions: actions.Actions({
		toggleRibbonsPlacementMode: ['- Interface/',
			toggler.Toggler(null, function(_, state){ 
					if(state == null){
						return this.config['ui-ribbons-placement-mode']
					}

					this.config['ui-ribbons-placement-mode'] = state
					var modes = this.config['ui-ribbons-placement-modes']

					this.ribbons.dom = ribbons[modes[state]]

					// NOTE: this will lose any state/configuration that
					// 		was stored in ribbon dom...
					this.ribbons.clear('full')
					this.reload(true)
				},
				function(){ 
					return Object.keys(this.config['ui-ribbons-placement-modes']) } )],
	}),

	handlers: [
		['setup', 
			function(){
				this.toggleRibbonsPlacementMode(this.config['ui-ribbons-placement-mode'])
			}],
	]
})


//---------------------------------------------------------------------
// Direct control mode...
// XXX add vertical scroll...
// XXX add pinch-zoom...
// XXX disable drag in single image mode unless image is larger than the screen...

// XXX BUG: current image indicator gets shown in random places...
// XXX BUG: this does it's work via css left which is both slow and 
// 		messes up positioning...
var DirectControljQ = 
module.DirectControljQ = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-direct-control-jquery',
	exclusive: ['ui-direct-control'],
	depends: [
		'ui',
		// this is only used to trigger reoad...
		//'ui-partial-ribbons',
	],

	// XXX add setup/taredown...
	handlers: [
		// setup ribbon dragging...
		// XXX this is really sloooooow...
		// XXX hide current image indicator as soon as the image is not visible...
		// XXX inertia...
		// XXX limit scroll to at least one image being on screen (center?)...
		['updateRibbon', 
			function(_, target){
				var that = this
				var r = this.ribbons.getRibbon(target)

				var scale = 1

				// setup dragging...
				r.length > 0 
					&& !r.hasClass('ui-draggable')
					&& r.draggable({
						axis: 'x',

						start: function(evt, ui){
							scale = that.ribbons.scale()	
						},
						// compensate for ribbon scale...
						drag: function(evt, ui) {
							// compensate for scale...
							ui.position = {
								left: ui.originalPosition.left 
									+ (ui.position.left 
										- ui.originalPosition.left) / scale,
								top: ui.originalPosition.top 
									+ (ui.position.top 
										- ui.originalPosition.top) / scale,
							}
						},

						stop: function(){
							var c = that.ribbons.getImageByPosition('center', r)
							that
								.updateRibbon(c)
								// XXX is this correct???
								//.updateCurrentImageIndicator()
						}
					})
			}],
	],
})


// XXX BUG: this does not account for scale when setting the initial drag
// 		position, resulting in a jump...
// XXX do not use this for production -- GSAp has a bad license...
var DirectControlGSAP = 
module.DirectControlGSAP = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-direct-control-gsap',
	exclusive: ['ui-direct-control'],
	depends: [
		'ui',
		// this is only used to trigger reoad...
		//'ui-partial-ribbons',
	],

	// XXX add setup/taredown...
	handlers: [
		// setup ribbon dragging...
		['updateRibbon', 
			function(_, target){
				var that = this
				var r = this.ribbons.getRibbon(target)

				// setup dragging...
				if(r.length > 0 && !r.hasClass('draggable')){
					r.addClass('draggable')

					Draggable.create(r, {
						type: 'x',
						cursor: 'auto',
						onDragEnd: function(){
							var c = that.ribbons.getImageByPosition('center', r)
							that
								.updateRibbon(c)
						}})
				}
			}],
	],
})


// XXX try direct control with hammer.js
// XXX load state from config...
// XXX sometimes this makes the indicator hang for longer than needed...
// XXX BUG: this conflicts a bit whith ui-clickable...
// 		...use this with hammer.js taps instead...
// XXX might be a good idea to make a universal and extensible control 
// 		mode toggler...
// 		...obvious chice would seem to be a meta toggler:
// 			config['control-mode'] = {
// 				<mode-name>: <mode-toggler>
// 			}
// 			and the action will toggle the given mode on and the previous
// 			off...
// 			XXX this seems a bit too complicated...
var IndirectControl = 
module.IndirectControl = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-indirect-control',
	// XXX is this correct???
	exclusive: ['ui-direct-control'],
	depends: ['ui'],

	config: {
	},

	actions: actions.Actions({
		toggleSwipeHandling:['Interface/Toggle indirect control swipe handling',
			toggler.Toggler(null,
				function(_, state){

					if(state == null){
						return (this.ribbons 
								&& this.ribbons.viewer 
								&& this.ribbons.viewer.data('hammer')) 
							|| 'none'

					// on...
					} else if(state == 'handling-swipes'){
						var that = this
						var viewer = this.ribbons.viewer

						// prevent multiple handlers...
						if(viewer.data('hammer') != null){
							return
						}

						viewer.hammer()

						var h = viewer.data('hammer')
						h.get('swipe').set({direction: Hammer.DIRECTION_ALL})

						viewer
							.on('swipeleft', function(){ that.nextImage() })
							.on('swiperight', function(){ that.prevImage() })
							.on('swipeup', function(){ that.shiftImageUp() })
							.on('swipedown', function(){ that.shiftImageDown() })

					// off...
					} else {
						this.ribbons.viewer
							.off('swipeleft')
							.off('swiperight')
							.off('swipeup')
							.off('swipedown')
							.removeData('hammer')
					}

				},
				'handling-swipes')],
	}),

	handlers: [
		['load', 
			function(){ a.toggleSwipeHandling('on') }],
		['stop', 
			function(){ a.toggleSwipeHandling('off') }],
	],
})



//---------------------------------------------------------------------

// XXX make this work for external links in a stable manner...
// 		...a bit unpredictable when working in combination with history
// 		feature -- need to stop them from competing...
// 		...appears to be a bug in location....
var URLHash = 
module.URLHash = core.ImageGridFeatures.Feature({
	title: 'Handle URL hash',
	doc: '',

	tag: 'ui-url-hash',
	depends: ['ui'],

	//isApplicable: function(){ 
	//	return typeof(location) != 'undefined' && location.hash != null },
	isApplicable: function(){ return this.runtime == 'browser' },

	handlers: [
		// hanlde window.onhashchange event...
		['start',
			function(){
				var that = this
				var handler = this.__hashchange_handler = function(){
					var h = location.hash
					h = h.replace(/^#/, '')
					that.current = h
				}
				$(window).on('hashchange', handler)
			}],
		['stop',
			function(){
				this.__hashchange_handler 
					&& $(window).on('hashchange', this.__hashchange_handler)
			}],
		// store/restore hash when we focus images...
		['focusImage',
			function(res, a){
				if(this.current && this.current != ''){
					location.hash = this.current
				}
			}],
		['load.pre',
			function(){
				var h = location.hash
				h = h.replace(/^#/, '')

				return function(){
					if(h != '' && this.data.getImageOrder(h) >= 0){
						this.current = h
					}
				}
			}],
	],
})



//---------------------------------------------------------------------

// XXX make this work in browser
var UIScaleActions = actions.Actions({
	config: {
		// XXX
		'ui-scale-modes': {
			desktop: 0,
			touch: 3,
		},
	},

	// XXX need to account for scale in PartialRibbons
	// XXX should this be browser API???
	// XXX this does not re-scale the ribbons correctly in nw0.13
	toggleInterfaceScale: ['Interface/Toggle interface modes',
		core.makeConfigToggler('ui-scale-mode', 
			function(){ return Object.keys(this.config['ui-scale-modes']) },
			function(state){ 
				var gui = requirejs('nw.gui')
				var win = gui.Window.get()


				this.ribbons.preventTransitions()

				var w = this.screenwidth

				// NOTE: scale = Math.pow(1.2, zoomLevel)
				// XXX in nw0.13 this appears to be async...
				win.zoomLevel = this.config['ui-scale-modes'][state] || 0

				this.screenwidth = w
				this.centerViewer()

				this.ribbons.restoreTransitions()
			})],
})


// XXX enable scale loading...
// 		...need to make this play nice with restoring scale on startup...
var UIScale = 
module.UIScale = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-scale',
	depends: [
		'ui',
	],

	actions: UIScaleActions,

	// XXX test if in:
	// 	- chrome app
	// 	- nw
	// 	- mobile
	isApplicable: function(){ return this.runtime == 'nw' },

	// XXX show main window...
	handlers: [
		['start',
			function(){ 
				// XXX this messes up ribbon scale...
				// 		...too close/fast?
				//this.toggleInterfaceScale('!')
			}],
	],
})



//---------------------------------------------------------------------


// XXX console / log / status bar
// XXX title bar (???)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
