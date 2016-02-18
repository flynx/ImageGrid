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


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// XXX revise how/where info is displayed...
var StatusBarActions = actions.Actions({
	config: {
		'status-bar-mode': 'minimal',
		'status-bar-modes': [
			'none',
			'minimal',
			'full'
		],
		'status-bar-items': [
			'index',
			'gid',
			//'path',

			// separates left/right aligned elements...
			'---',

			'mark',
			'bookmark',
		],

		// XXX not sure about this...
		'status-bar-full-only': [
			'gid',
			'path',
		],
	},

	__statusbar_elements__: {
		index: function(item, gid, img){
			var that = this
			gid = gid || this.current

			// make an element...
			if(typeof(item) == typeof('str')){
				var type = item
				item = $('<span>')
					.addClass(type)
					.append($('<span>')
						.addClass('position')
						.attr('info', 'Image position (click to edit image position)')
						.click(function(){
							// XXX enter edit mode -> select contents...
							// XXX might be a good idea to live select 
							// 		the indexed image... (???)
							//$(this)
							//	.prop('contenteditable', true)
							// XXX
						}))
					.append($('<span>')
						.addClass('length')
						.attr('info', 'Image position (click to toggle ribbon/global)')
						// toggle index state...
						.click(function(){
							$(this).parent()
								.toggleClass('global')
							that.updateStatusBar()
						}))

			} else {
				var type = item.attr('type')
			}

			// update...
			// global index...
			if(item.hasClass('global')){
				item.find('.position')
					.text(this.data.getImageOrder(gid)+1)
				item.find('.length')
					.text('/'+ this.data.length)

			// ribbon index...
			} else {
				item.find('.position')
					.text(this.data.getImageOrder('ribbon', gid)+1)
				item.find('.length')
					.text('/'+ this.data.getImages(gid).len)
			}

			return item
		},

		// XXX handle path correctly...
		gid: function(item, gid, img){
			var that = this
			gid = gid || this.current
			img = img || (this.images && gid in this.images && this.images[gid])

			// make an element...
			if(typeof(item) == typeof('str')){
				var type = item
				item = $('<span>')
					.addClass(type + ' expanding-text ')
					.attr('info', type == 'gid' ? 'Image GID'
							: type == 'path'? 'Image filename/path'
							: '')
					.append($('<span class="shown">'))
					.append($('<span class="hidden">'))

			} else {
				var type = item.attr('type')
			}

			// update...
			var txt = ''
			var text = ''

			// gid..
			if(type == 'gid'){
				txt = gid ? gid.slice(-6) : '-'
				text = gid || '-'

			// path...
			// XXX
			} else if(type == 'path'){
				text = img && img.path || '---'
				txt = text
			}

			item.find('.shown').text(txt)
			item.find('.hidden').text(text)

			return item
		},
		path: 'gid',

		mark: function(item, gid, img){
			gid = gid || this.current
			var that = this

			if(typeof(item) == typeof('str')){
				var type = item
				item = $('<span>')
					.addClass(type + 'ed')
					.attr('info', 'Image '
						+(type == 'mark' ? 'selection' : 'bookmark')
						+' status (click to toggle)')
					.click(function(){
						that['toggle'+type.capitalize()]()
					})

			} else {
				var type = item.attr('type')
			}

			// NOTE: we are not using .toggleMark('?') and friends 
			// 		here to avoid recursion as we might be handling 
			// 		them here...
			// 		...this also simpler than handling '?' and other
			// 		special toggler args in the handler...
			var tags = this.data.getTags(gid)
			var tag = type == 'mark' ? 'selected' : 'bookmark'
			item[tags.indexOf(tag) < 0 ?
					'removeClass' 
					: 'addClass']('on')

			return item
		},
		bookmark: 'mark', 
	},

	// NOTE: to reset the status bar cycle through 'none' mode to 
	// 		reconstruct all the items.
	toggleStatusBar: ['Interface/Toggle status bar modes',
		toggler.CSSClassToggler(
			// XXX change class...
			function(){ 
				var bar = this.ribbons.viewer.find('.state-indicator-container.global-info') 
				if(bar.length == 0){
					bar = makeStateIndicator('global-info overlay-info') 
						.on('mouseover', function(){
							var t = $(event.target)
							
							var info = t.attr('info') 
								|| t.parents('.overlay-info, [info]').first().attr('info')

							if(info){
								bar.find('.info').text(info)
							}
						})
						.on('mouseout', function(){
							bar.find('.info').empty()
						})
						.appendTo(this.ribbons.viewer)
				}
				return bar
			}, 
			function(){ return this.config['status-bar-modes'] },
			// XXX check if we will be getting gid reliably...
			function(state, bar, gid){ 
				var that = this
				this.config['status-bar-mode'] = state 

				// destroy...
				if(state == 'none'){
					bar.empty()

				// build/update...
				} else {
					gid = gid || this.current
					var img = this.images && this.images[gid]

					var _getHandler = function(key){
						var elems = that.__statusbar_elements__ || {}
						var base_elems = StatusBarActions.__statusbar_elements__ || {}

						var handler = elems[key] || base_elems[key]

						if(handler == null){
							return
						}

						// handle aliases...
						var seen = []
						while(typeof(handler) == typeof('str')){
							seen.push(handler)
							var handler = elems[handler] || base_elems[handler]
							// check for loops...
							if(seen.indexOf(handler) >= 0){
								console.error('state indicator alias loop detected at:', key)
								handler = null
								break
							}
						}

						return handler
					}

					// build...
					if(bar.children().length <= 0){
						var items = this.config['status-bar-items'].slice()

						// rearrange the tail section...
						// NOTE: this is here as we need to push the floated
						// 		right items in reverse order...
						var i = items.indexOf('---')
						items = i >= 0 ? 
							items.concat(items.splice(i+1, items.length).reverse())
							: items

						items.forEach(function(item){
							// spacer...
							if(item == '---'){
								//item = $('<span class="spacer">')
								item = $('<span class="spacer info">')

							// info items...
							} else {
								var handler = _getHandler(item)

								var type = item
								item = (handler ? 
										handler.call(that, item, gid, img) 
										: $('<span>'))
									.attr('type', item)

								if('status-bar-full-only' in that.config 
										&& that.config['status-bar-full-only'].indexOf(type) >= 0){
									item.addClass('full-only')
								}
							}

							bar.append(item)
						})

					// update...
					} else {
						var items = bar.children()
							.each(function(i, item){
								item = $(item)
								var type = item.attr('type') 

								if(type == null){
									return
								}

								var handler = _getHandler(type)

								if(handler != null){
									handler.call(that, item, gid, img) 
								}
							})
					}
				}
			})],	
	updateStatusBar: ['Interface/Update satus bar',
		function(){ this.toggleStatusBar('!') }]
})

var StatusBar = 
module.StatusBar = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-status-bar',
	depends: [
		'ui',
	],

	actions: StatusBarActions,

	handlers: [
		['start',
			function(){
				if(this.config['status-bar-mode']){
					this.toggleStatusBar(this.config['status-bar-mode'])
				}
			}],
		['focusImage',
			function(){
				this.updateStatusBar()
			}],
		[[
			'tag',
			'untag',
		],
			function(res, tags, gids){
				// trigger only when current image is affected...
				if(gids.constructor === Array 
						&& (gids.indexOf('current') >= 0 
							|| gids.indexOf(this.current) >= 0)
						|| this.data.getImage(gids) == this.current){
					this.updateStatusBar()
				}
			}],
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
