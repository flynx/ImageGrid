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
var keyboard = require('lib/keyboard')

var data = require('imagegrid/data')
var images = require('imagegrid/images')
var ribbons = require('imagegrid/ribbons')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/

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
			'full',
		],
		'status-bar-items': [
			'index',
			'gid',
			'path',

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

		'status-bar-index': {
			'mode': 'normal',

			// NOTE: this would need to reconstruct the status bar for 
			// 		changes to take effect, i.e. call .resetStatusBar()
			// XXX might be a good idea to run an editor on click on
			// 		touch devices...
			'editable': true,

			'live-update-on-edit': false,
		},

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
					.append(!(this.config['status-bar-index'] || {})['editable'] ?
						// not-editable...
						$('<span>')
							.addClass('position')
							.attr('info', 'Image position (click to toggle ribbon/global)')
							// toggle index state...
							.click(function(){
								that.toggleStatusBarIndexMode()
								that.updateStatusBar()
							})
						// editable...
						: $('<span>')
							.addClass('position editable')
							.attr('info', 'Image position (click to edit image position)')
							.prop('contenteditable', true)
							.keydown(function(){
								// keep this from affecting the viewer...
								event.stopPropagation()

								var n = keyboard.toKeyName(event.keyCode)

								var i = parseInt($(this).text())
								i = i >= 1 ? i-1
									: i == null ? 'current'
									: i

								// lose focus and exit...
								if(n == 'Esc' || n == 'Enter'){
									event.preventDefault()

									// get image on enter...
									if(n == 'Enter'){
										that.focusImage(i, 
											item.hasClass('global') ? 'global' : undefined)
									}

									// clear selection....
									window.getSelection().removeAllRanges()
									$(this).blur()

									that.updateStatusBar()

									return false
								}
							})
							// update image position...
							// XXX this appears to be run in the node context...
							.keyup(function(){
								// XXX KeyboardEvent does not appear to have this...
								//event.stopPropagation()

								if((that.config['status-bar-index'] || {})['live-update-on-edit']){
									var i = parseInt($(this).text())
									i = i >= 1 ? i-1
										: i == null ? 'current'
										: i
									that.focusImage(i,
										item.hasClass('global') ? 'global' : undefined)
								}
							})
							.click(function(){
								$(this).selectText()
							})
							.blur(function(){
								that.updateStatusBar()
							}))
					.append($('<span>')
						.addClass('length')
						.attr('info', 'Image position (click to toggle ribbon/global)')
						// toggle index state...
						.click(function(){
							that.toggleStatusBarIndexMode()
							that.updateStatusBar()
						}))

			} else {
				var type = item.attr('type')
			}

			// update...
			// NOTE: using .toggleStatusBarIndexMode(..) here will fall
			// 		into an infinite recursion...
			var cls = (that.config['status-bar-index'] || {})['mode'] || 'normal'
			item
				.addClass(cls)
				.removeClass(cls != 'normal' ? 'normal' : 'global')

			// global index...
			if(cls == 'global'){
				item.find('.position:not(:focus)')
					.text(this.data ? this.data.getImageOrder(gid)+1 : 0)
				item.find('.length')
					.text('/'+ (this.data ? this.data.length : 0))

			// ribbon index...
			} else {
				item.find('.position:not(:focus)')
					.text(this.data ? this.data.getImageOrder('ribbon', gid)+1 : 0)
				item.find('.length')
					.text('/'+ (this.data ? this.data.getImages(gid).len : 0))
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
					.append($('<span class="hidden">')
						// select the text...
						// XXX should this also copy???
						.click(function(){
							$(this).selectText()
						}))

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
			// XXX use generic, platform independent path processing...
			} else if(type == 'path'){
				text = (img && ((img.base_path || '') +'/'+ img.path) || '---')
					// remove /./
					.replace(/[\\\/]\.[\\\/]/, '/')
				txt = img && ((img.name || '') + (img.ext || '')) || text.split(/[\\\/]/).pop()
			}

			item.find('.shown').text(txt)
			item.find('.hidden').text(text)

			return item
		},
		path: 'gid',

		// XXX show menu in the appropriate corner...
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
					// toggle action menu...
					// XXX show this in the appropriate corner...
					.on('contextmenu', function(){
						event.preventDefault()
						event.stopPropagation()

						that.browseActions('/'+ type.capitalize() +'/')
					})

			} else {
				var type = item.attr('type')
			}

			// NOTE: we are not using .toggleMark('?') and friends 
			// 		here to avoid recursion as we might be handling 
			// 		them here...
			// 		...this also simpler than handling '?' and other
			// 		special toggler args in the handler...
			var tags = this.data ? this.data.getTags(gid) : []
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
			// get/construct status bar...
			// XXX change class...
			function(){ 
				// no viewer yet...
				if(!this.ribbons || !this.ribbons.viewer){
					return $()
				}

				var bar = this.ribbons.viewer.find('.state-indicator-container.global-info') 
				if(bar.length == 0){
					bar = makeStateIndicator('global-info overlay-info statusbar') 
						.addClass(this.config['status-bar-mode'] || '')
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
	updateStatusBar: ['- Interface/Update satus bar',
		function(){ this.toggleStatusBar('!') }],

	resetStatusBar: ['Interface/Reset status bar',
		function(){
			var mode = this.toggleStatusBar('?')
			this.toggleStatusBar('none')
			this.toggleStatusBar(mode)
		}],

	// XXX should these be here???
	// XXX should this show a dialog???
	editStatusBarIndex: ['- Interface/',
		function(){
			if((this.config['status-bar-index'] || {} )['editable']){
				this.toggleStatusBar('?') == 'none' && this.toggleStatusBar()

				// XXX do this better...
				this.ribbons.viewer.find('.global-info .index .position').focus().click()
			}
		}],
	toggleStatusBarIndexMode: ['Interface/Status bar index mode',
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer.find('.global-info .index') },
			['normal', 'global'],
			function(state){
				this.toggleStatusBar('?') == 'none' && this.toggleStatusBar()

				// prepare for saving the config...
				this.config['status-bar-index'] = 
					JSON.parse(JSON.stringify(this.config['status-bar-index']))
				this.config['status-bar-index']['mode'] = state

				this.updateStatusBar()
			})],
})

var StatusBar = 
module.StatusBar = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-status-bar',
	depends: [
		'ui',

		// XXX this is here to enable context menu 
		// 		see: StatusBarActions.__statusbar_elements__.mark(..)
		'ui-browse-actions',
	],

	actions: StatusBarActions,

	handlers: [
		['start',
			function(){
				this.toggleStatusBar(this.config['status-bar-mode'])
			}],
		['focusImage clear',
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

		['ribbonPanning.post',
			function(_, gid){
				gid == this.data.getRibbon() && this.updateStatusBar()
			}],

		// Workspace...
		['saveWorkspace',
			core.makeWorkspaceConfigWriter(
				function(){ return Object.keys(StatusBar.config) })],
		['loadWorkspace',
			core.makeWorkspaceConfigLoader(
				function(){ return Object.keys(StatusBar.config) },
				function(workspace){
					// XXX not sure about this protocol yet...
					if(this.workspace == 'ui-chrome-hidden'){
						this.toggleStatusBar('none')
						return
					}

					'status-bar-mode' in workspace 
						&& this.toggleStatusBar(workspace['status-bar-mode'])
				})],
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
