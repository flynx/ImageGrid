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

// XXX add setup / teardown...
// XXX might be a good idea to merge this with single image mode...
var makeStateIndicator = function(type){
	return $('<div>')
		.addClass('state-indicator-container ' + type || '')
}

// XXX do we need this???
var makeStateIndicatorItem = function(container, type, text){
	var item = $('<div>')
			.addClass('item '+ type || '')
			.attr('text', text)
	this.ribbons.viewer.find('.state-indicator-container.'+container)
		.append(item)
	return item
}

// XXX should we use this or makeStateIndicatorItem(..)???
// 		...investigate the features of the above...
// 			- .attr('text')???
var makeExpandingInfoItem = function(container, cls, align, full_only){
	var e = $('<span>')
		.addClass(cls + ' expanding-text ' + align +' '+ (full_only && 'full-only'))
		.append($('<span class="shown">'))
		.append($('<span class="hidden">'))
	container.append(e)
	return e
}
var makeInfoItem = function(container, cls, align, full_only){
	var e = $('<span>')
		.addClass(cls +' '+ align +' '+ (full_only && 'full_only'))
	container.append(e)
	return e
} 


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// XXX Add status messages and log...
var ImageStateIndicatorActions = actions.Actions({
	config: {
		// XXX might be a good idea to add custom components API...
		'global-state-indicator-elements': [
			// XXX should index be here or to the right???
			'index',
			//'path',
			'gid',

			// separates left/right aligned elements...
			'---',

			'mark',
			'bookmark',
		],

		'global-state-indicator-elements-full-only': [
			'gid',
		],

		'global-state-indicator-modes': [
			'none',
			'minimal',
			'full',
		],
		'global-state-indicator-mode': null,
	},

	get moo(){ return 321 },
	foo: 123,

	updateStateIndicators: ['- Interface/',
		function(gid){
			gid = gid || this.current

			var that = this

			// make/get indicator containers...
			/*
			var image = this.ribbons.viewer.find('.state-indicator-container.image-info')
			if(image.length == 0){
				image = makeStateIndicator('image-info') 
					.appendTo(this.ribbons.viewer)
			}
			*/

			var global = this.ribbons.viewer.find('.state-indicator-container.global-info')
			if(global.length == 0){
				//global = makeStateIndicator('global-info') 
				global = makeStateIndicator('global-info overlay-info') 

				var align = ''
				var order = this.config['global-state-indicator-elements'].slice()

				var i = order.indexOf('---')
				// rearrange the tail section...
				// NOTE: this is here as we need to push the floated
				// 		right items in reverse order...
				if(i >= 0){
					order = order.concat(order.splice(i+1, order.length).reverse())
				}

				order.forEach(function(elem){
					var full_only = that.config['global-state-indicator-elements-full-only'].indexOf(elem) >= 0
					// spacer...
					if(elem == '---'){
						align = 'float-right'

					// expanding indicators...
					} else if(elem == 'gid' || elem == 'path'){
						makeExpandingInfoItem(global, elem, align, full_only)

					// simple indicators...
					} else if(elem == 'index'){
						makeInfoItem(global, elem, align, full_only)

					// toggler indicators...
					} else if(elem == 'bookmark' || elem == 'mark'){
						makeInfoItem(global, elem+'ed', align, full_only)
							.click(function(){
								that['toggle'+elem.capitalize()]()
							})

					// XXX custom elements...
					// 		format:
					// 			{
					// 				<key>: <handler>,
					// 				<alias>: <key>|<alias>,
					// 				...
					// 			}
					// XXX the handler should take care of it's own updating...
					// 		...will also need a way to drop a handler if 
					// 		the list changes, otherwise this is a potential
					// 		leak...
					// XXX move other elements into this...
					// XXX need a better attr name...
					} else if(that.__state_indicator_elements){
						var handler = that.__state_indicator_elements[elem]
						// handle aliases...
						var seen = []
						while(typeof(handler) == typeof('str')){
							seen.push(handler)
							var handler = that.__state_indicator_elements[handler]
							// check for loops...
							if(seen.indexOf(handler) >= 0){
								console.error('state indicator alias loop detected at:', elem)
								handler = null
							}
						}

						// do the call...
						if(handler != null){
							// XXX simplify the constructors... (into one?)
							handler.call(that, elem, makeInfoItem, makeExpandingInfoItem)
						}
					}
				})

				global.appendTo(this.ribbons.viewer)

				// init in the correct state...
				if(this.config['global-state-indicator-mode']){
					this.toggleStateIndicator(this.config['global-state-indicator-mode'])
				}
			}

			if(!gid){
				return
			}


			// populate the info...

			var img = this.images && gid in this.images && this.images[gid]

			// gid..
			global.find('.gid .shown').text(gid.slice(-6))
			global.find('.gid .hidden').text(gid)

			// path...
			global.find('.path .shown').text(img && img.path || '---')
			global.find('.path .hidden').text(img && img.path || '---')

			// pos...
			global.find('.index')
				.text(
					(this.data.getImageOrder('ribbon', gid)+1) 
					+'/'+ 
					this.data.getImages(gid).len)

			// NOTE: we are not using .toggleMark('?') and friends 
			// 		here to avoid recursion as we might be handling 
			// 		them here...
			// 		...this also simpler than handling '?' and other
			// 		special toggler args in the handler...
			var tags = this.data.getTags(gid)

			// marks...
			global.find('.marked')[
				tags.indexOf('selected') < 0 ?
					'removeClass' 
					: 'addClass']('on')
			global.find('.bookmarked')[
				tags.indexOf('bookmark') < 0 ? 
					'removeClass' 
					: 'addClass']('on')
		}],
	toggleStateIndicator: ['Interface/Toggle state indicator modes',
		toggler.CSSClassToggler(
			function(){ 
				return this.ribbons.viewer.find('.state-indicator-container.global-info') }, 
			function(){ return this.config['global-state-indicator-modes'] },
			function(state){ this.config['global-state-indicator-mode'] = state }) ],
})

// XXX an alternative approach:
// 		- global status area
// 		- status bar for local status
// 			- as in gen3
// 			- add image status
//
// 		General item format:
// 			- minimal state		- only short version / icon is shown
// 								- when not active a disabled state/icon is shown
//
// 			- expanded state	- status bar sows expanded state (only?)
// 								- title/help shown above 
// 									- floating text, transparent bg
// 									- same align as item
//
// XXX Q: can title bar be used instead of global state indication???
// 		...especially if we are indicating only crop...
// XXX add styling:
// 		- element spacing
// 		- tip text
// 		- avoid multi-line
// XXX rename to status bar???
var ImageStateIndicator = 
module.ImageStateIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-image-state-indicator',
	depends: [
		'ui',
		'ui-single-image-view',
	],

	actions: ImageStateIndicatorActions,

	handlers: [
		['start',
			function(){
				if(this.config['global-state-indicator-mode']){
					this.toggleStateIndicator(this.config['global-state-indicator-mode'])
				}
			}],
		[[
			'focusImage',
			'toggleBookmark',
			'toggleMark',
		],
			function(){
				this.updateStateIndicators()
			}]
	],
})



//---------------------------------------------------------------------

// XXX
var GlobalStateIndicator = 
module.GlobalStateIndicator = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-global-state-indicator',
	depends: [
		'ui'
		//'ui-single-image-view',
	],
})



//---------------------------------------------------------------------
// XXX
// XXX might also be a good idea to use the similar mechanism for tips...

var StatusLogActions = actions.Actions({
	config: {
		// NOTE: if this is 0 then do not trim the log...
		'ui-status-log-size': 100,

		'ui-status-fade': 1000,
	},

	// XXX should this be here or in a separate feature???
	statusLog: ['Interface/Show status log',
		function(){
			// XXX use list
		}],
	clearStatusLog: ['Interface/Clear status log',
		function(){
			delete this.__status_log
		}],
	statusMessage: ['- Interface/',
		function(){
			var msg = args2array(arguments)
			if(msg.len == 0){
				return
			}
			var log = this.__status_log = this.__status_log || []
			
			// XXX should we convert here and how???
			log.push(msg.join(' '))

			// truncate the log...
			var s = this.config['ui-status-log-size']
			if(s != 0 && log.length > (s || 100)){
				log.splice(0, log.length - (s || 100))
			}

			// XXX show the message above the status bar (same style)...
			// XXX
		}],
})

var StatusLog = 
module.StatusLog = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-status-log',
	depends: [
		'ui'
	],

	actions: StatusLogActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
