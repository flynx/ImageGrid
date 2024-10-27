/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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
		.addClass('state-indicator-container ' + type || '') }

// XXX do we need this???
var makeStateIndicatorItem = function(container, type, text){
	var item = $('<div>')
			.addClass('item '+ type || '')
			.attr('text', text)
	this.dom.find('.state-indicator-container.'+container)
		.append(item)
	return item }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// XXX revise how/where info is displayed...
var StatusBarActions = actions.Actions({
	config: {
		'status-bar': 'full',
		'status-bars': {
			hidden: [
				'---',
				'mark',
				'bookmark',
			],
			minimal: [
				'index',
				'ribbon',
				'changes',
				'---',
				'edit-mode',
				'mark',
				'bookmark',
			],
			full: [
				'index',
				'ribbon',
				'changes',
				'gid',
				'path',
				'---',
				'edit-mode',
				'mark',
				'bookmark',
			],
		},

		'status-bar-index': {
			'mode': 'normal',

			// NOTE: this would need to reconstruct the status bar for 
			// 		changes to take effect, i.e. call .resetStatusBar()
			// XXX might be a good idea to run an editor on click on
			// 		touch devices...
			'editable': true,

			'live-update-on-edit': false,
		},

		'status-bar-ribbon-count': true,

		'status-bar-changes-text': '*',

		'status-bar-edit-mode-indicator-update-interval': 1000,

		// workspace stuff...
		'status-bar-workspace-attrs': [
			'status-bar',
		],
		'status-bar-workspace-defaults': {
			'default': 'full',
			'single-image': 'minimal',
			'slideshow': 'hidden',
		},
	},


	get __statusbar_cache(){
		return this.cache('view-data', 'statusbar', 
			function(data){ 
				return data || {}}) },


	__statusbar_elements__: {
		/* item template...
		item: function(item){
			// cleanup...
			if(item == null){
				// XXX
				return
			}

			// setup the item DOM...
			if(typeof(item) == typeof('str')){
				var type = item
				item = $('<span>')
					.addClass('item-example')
					.attr('type', item)
					.text('example')

			// get stuff from the item...
			} else {
				var type = item.attr('type')
			}

			// update the item...
			// XXX

			return item
		},
		*/
		index: function(item, gid, img){
			// cleanup...
			if(item == null){
				return }

			var that = this
			gid = gid || this.current

			// make an element...
			if(typeof(item) == typeof('str')){
				var type = item
				var go = function(i){
					i = i >= 1 ? i-1
						: i == null ? 'current'
						: i
					that.focusImage(i,
						item.hasClass('global') ? 
							'global' 
						: item.hasClass('loaded') ? 
							'loaded'
						: undefined) }
				item = $('<span>')
					.addClass(type)
					.append(!(this.config['status-bar-index'] || {})['editable'] ?
						// not-editable...
						$('<span>')
							.addClass('position')
							.attr('info', 'Image number (click to toggle ribbon/global)')
							// toggle index state...
							.click(function(){
								that.toggleStatusBarIndexMode()
								that.updateStatusBar() })
						// editable...
						: $('<span>')
							.addClass('position editable')
							.attr('info', 'Image number (click to edit)')
							.makeEditable({
								propagate_unhandled_keys: false,
								reset_on_done: false,
							})
							// select image when done...
							.on('edit-commit', function(_, text){
								go(parseInt(text)) })
							// update image position...
							// XXX this appears to be run in the node context...
							.keyup(function(){
								// XXX KeyboardEvent does not appear to have this...
								//event.stopPropagation()

								(that.config['status-bar-index'] || {})['live-update-on-edit']
									&& go(parseInt($(this).text())) })
							.focus(function(){
								$(this).selectText() })
							.blur(function(){
								that.updateStatusBar() }))
					.append($('<span>')
						.addClass('length')
						.attr('info', 'Image count (click to toggle ribbon/global)')
						// toggle index state...
						.click(function(){
							that.toggleStatusBarIndexMode()
							that.updateStatusBar() }))

			} else {
				var type = item.attr('type') }

			// NOTE: using .toggleStatusBarIndexMode(..) here will fall
			// 		into an infinite recursion...
			var cls = (that.config['status-bar-index'] || {})['mode'] || 'normal'

			// get the cached length...
			var cache = this.__statusbar_cache.index_total
			cache = cache ? 
				(cache[0] == cls 
					&& cache[1])
				: null

			// empty view...
			if(!this.data){
				var i = -1
				var l = 0

			// global index...
			} else if(cls == 'global'){
				var i = this.data.getImageOrder(gid)
				var l = cache = 
					cache || this.data.length

			// loaded/crop index...
			} else if(cls == 'loaded'){
				var i = this.data.getImageOrder('loaded', gid)
				var l = cache = 
					cache || this.data.getImages('loaded').len

			// ribbon index...
			} else {
				var i = this.data.getImageOrder('ribbon', gid)
				var r = this.current_ribbon
				var l = cache 
					&& cache instanceof Array 
					&& cache[0] == r
					&& cache[1]
				l = l || this.data.getImages(gid).len
				cache = [r, l] }

			// save cache...
			this.__statusbar_cache.index_total = [cls, cache]

			// update...
			item
				.addClass(cls)
				.removeClass(cls != 'normal' ? 'normal' : 'global')
				.find('.position:not(:focus)')
					.text(i >= 0 ? i+1 : '-')
					.end()
				.find('.length')
					.text(l > 0 ? ('/' + l) : '')

			return item },
		ribbon: function(item, gid, img){
			// cleanup...
			if(item == null){
				return }

			var that = this

			// get ribbon number...
			var n = (this.data && this.data.ribbon_order.length > 0) ? 
				this.data.getRibbonOrder(gid || this.current) 
				: null
			var t = (this.config['status-bar-ribbon-count'] && this.data) ?
			   	this.data.ribbon_order.length 
				: null

			// make an element...
			if(typeof(item) == typeof('str')){
				item = $('<span>')
					.addClass('ribbon-index')
					.append($('<span>')
						.addClass('ribbon-number')
						.attr('info', 'Current ribbon (click to edit)')
						.makeEditable({
							propagate_unhandled_keys: false,
							reset_on_done: false,
						})
						.on('edit-commit', function(_, text){
							var i = parseInt(text)
							i = i >= 1 ? i-1
								: i == null ? 'current'
								: i
							that.focusRibbon(text == '*' ? that.base : i)
						})
						.focus(function(){
							$(this).selectText()
						})
						.blur(function(){
							that.updateStatusBar()
						}))
					.append($('<span>')
						.addClass('ribbon-count')
						.attr('info', 'Ribbon count')) }

			item
				.find('.ribbon-number')
					.html(n != null ? n+1 : '-') 
					.end()
				.find('.ribbon-count')
					.html(t || '') 

			// flag the base ribbon...
			// NOTE: for some reason can't get jQuery .prop(..)/.removeProp(..)
			// 		to work here...
			if(this.data && this.data.base 
					&& this.data.getRibbon(gid) == this.base){
				item[0].setAttribute('base', '')

			} else {
				item[0].removeAttribute('base') }

			return item },
		changes: function(item, gid, img){
			// cleanup...
			if(item == null){
				return }

			if(typeof(item) == typeof('str')){
				item = $('<span>')
					.addClass('changes')
					.attr('info', 'Unsaved changes') }

			//item.html(this.changes !== false ? 
			//	this.config['status-bar-changes-text'] || '*' 
			//	: '')
			// XXX not yet sure about .hasOwnProperty(..) here...
			item.html(this.hasOwnProperty('changes') && this.changes !== false ? 
				this.config['status-bar-changes-text'] || '*' 
				: '')

			return item },
		// XXX handle path correctly...
		gid: function(item, gid, img){
			// cleanup...
			if(item == null){
				return }

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
							$(this).selectText() }))

			} else {
				var type = item.attr('type') }

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
				// XXX revise this...
				text = (img && img.path && ((img.base_path || '') +'/'+ img.path) || '---')
					// remove /./
					.replace(/[\\\/]\.[\\\/]/, '/')
				txt = img 
					&& ((img.name || '') + (img.ext || '')) 
					|| text.split(/[\\\/]/).pop() }

			item.find('.shown').text(txt)
			item.find('.hidden').text(text)

			return item },
		path: 'gid',
		'edit-mode': function(item){
			// cleanup...
			if(item == null){
				this.__edit_mode_indicator_update
					&& this.off('keyPress', this.__edit_mode_indicator_update)
				delete this.__edit_mode_indicator_update
				return }

			var update = this.__edit_mode_indicator_update = 
				this.__edit_mode_indicator_update 
					|| (function(){
						var caps = this.keyboard.capslock
						caps = typeof(event) != 'undefined' && event.getModifierState ? 
							event.getModifierState('CapsLock')
							: caps
						item
							.attr('info', 'Edit mode ' 
								+ (caps ? 'on' : 'off')
								+ ' (Click to update / Press CapsLock to toggle)')
							[caps ? 'addClass' : 'removeClass']('on') }).bind(this)

			// cleanup interval handling...
			this.__edit_mode_indicator_update_interval
				&& clearInterval(this.__edit_mode_indicator_update_interval)


			// cleanup...
			if(item == null){
				this.off('keyPress', update)
				this.dom.off('focus', update)
				return }

			// setup...
			if(typeof(item) == typeof('str')){
				var type = item
				item = $('<span>')
					.addClass('capslock-state expanding-text')
					.append($('<span class="shown">')
						.text('E'))
					.append($('<span class="hidden">')
						.text('Edit mode'))
					.click(update)

				this.on('keyPress', update)
				this.dom.focus(update) }

			// update timer...
			// NOTE: this is needed so as to reflect changes to settings...
			var t = this.config['status-bar-edit-mode-indicator-update-interval']
			t = t == null ? 5000 : t
			if(t){
				this.__edit_mode_indicator_update_interval = setInterval(update, t) }

			// update state...
			update()

			return item },
		// XXX show menu in the appropriate corner...
		// XXX remove the type+ed class...
		mark: function(item, gid, img){
			// cleanup...
			if(item == null){
				return }

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
					.on('contextmenu', function(evt){
						evt = window.event || evt
						evt.preventDefault()
						evt.stopPropagation()

						that.browseActions('/'+ type.capitalize() +'/') })

			} else {
				var type = item.attr('type') }

			// NOTE: we are not using .toggleMark('?') and friends 
			// 		here to avoid recursion as we might be handling 
			// 		them here...
			// 		...this also simpler than handling '?' and other
			// 		special toggler args in the handler...
			var tags = this.data ? this.data.getTags(gid) : []
			var tag = type == 'mark' ? 'marked' : 'bookmark'
			var on = item.hasClass('on')
			item[tags.indexOf(tag) < 0 ?
					'removeClass' 
					: 'addClass']('on')

			return item },
		bookmark: 'mark', 
	},

	toggleStatusBar: ['Interface/Status bar mode',
		core.doc`

		NOTE: this will skip 'none' state if it is not present in 
			.config['status-bars'], but setting this to 'none' will clear
			the status bar completely before switching to the top state.
		`,
		toggler.CSSClassToggler(
			// get/construct status bar...
			function(){ 
				// no viewer yet...
				if(!this.ribbons || !this.dom){
					return $() }

				var bar = this.dom.find('.state-indicator-container.global-info') 
				if(bar.length == 0){
					bar = makeStateIndicator('global-info overlay-info statusbar') 
						.addClass(this.config['status-bar']
							|| Object.keys(this.config['status-bars'])[0] 
							|| '')
						.on('mouseover', function(evt){
							evt = window.event || evt
							var t = $(evt.target)
							
							var info = t.attr('info') 
								|| t.parents('.overlay-info, [info]').first().attr('info')

							if(info){
								bar.find('.info').text(info)
							}
						})
						.on('mouseout', function(){
							bar.find('.info').empty()
						})
						.appendTo(this.dom) }
				return bar }, 
			function(){ return Object.keys(this.config['status-bars']).concat(['none']) },
			// XXX check if we will be getting gid reliably...
			function(state, bar, gid){ 
				// do not do anything unless the status bar exists...
				if(bar.length == 0){
					return }
				var that = this
				this.config['status-bar'] = state 

				var _getHandler = function(key){
					var elems = that.__statusbar_elements__ || {}
					var base_elems = StatusBarActions.__statusbar_elements__ || {}

					var handler = elems[key] || base_elems[key]

					if(handler == null){
						return }

					// handle aliases...
					var seen = []
					while(typeof(handler) == typeof('str')){
						seen.push(handler)
						var handler = elems[handler] || base_elems[handler]
						// check for loops...
						if(seen.indexOf(handler) >= 0){
							console.error('state indicator alias loop detected at:', key)
							handler = null
							break } }

					return handler }

				// clear...
				if(state == 'none' || !bar.hasClass(state)){
					this.clearStatusBarCache()
					// notify items that they are removed...
					bar.children()
						.each(function(i, item){
							item = $(item)
							var type = item.attr('type') 

							if(type == null){
								return }

							var handler = _getHandler(type)

							if(handler != null){
								handler.call(that, null) }
						})
					bar.empty() }

				if(state == 'none'){
					!('none' in this.config['status-bars'])
						// XXX this feels like a hack...
						&& setTimeout(function(){ this.toggleStatusBar(0) }.bind(this), 0)
					//return Object.keys(this.config['status-bars'])[0]
					return }

				// build/update...
				gid = gid || this.current
				var img = this.images && this.images[gid]

				// build...
				if(bar.children().length <= 0){
					var items = this.config['status-bars'][state].slice()

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
								.attr('type', item) }

						bar.append(item) })

				// update...
				} else {
					var items = bar.children()
						.each(function(i, item){
							item = $(item)
							var type = item.attr('type') 

							if(type == null){
								return }

							var handler = _getHandler(type)

							if(handler != null){
								handler.call(that, item, gid, img) } }) } },
			null)],	
	updateStatusBar: ['- Interface/Update satus bar',
		{precall: actions.debounce()},
		'toggleStatusBar: "!"'],

	resetStatusBar: ['Interface/Reset status bar',
		function(){
			var mode = this.toggleStatusBar('?')
			this.toggleStatusBar('none')
			this.toggleStatusBar(mode) }],
	clearStatusBarCache: ['- Interface/Clear status bar cache',
		'clearCache: "*" "statusbar"'],


	// XXX should this blink the on state only???
	statusItemBlink: ['- Interface/',
		core.doc`
		
		NOTE: type is the same as in .__statusbar_elements__`,
		function(type){
			if(type == null){
				return }

			var gid = this.current
			var item = this.dom.find(`.state-indicator-container.global-info [type=${type}]`) 

			// blink the indicator...
			item
				.removeClass('blink')
				.addClass('blink')
				.on('animationend', function(){ item.removeClass('blink') }) }],

	// XXX should these be here???
	// XXX should this show a dialog???
	editStatusBarIndex: ['- Interface/Edit image focus position in statusbar',
		function(){
			if((this.config['status-bar-index'] || {} )['editable']){
				this.toggleStatusBar('?') == 'none' 
					&& this.toggleStatusBar()
				// XXX do this better...
				this.dom.find('.global-info .index .position').focus().click() } }],
	editStatusBarRibbon: ['- Interface/Edit ribbon focus position in statusbar',
		function(){
			this.toggleStatusBar('?') == 'none' 
				&& this.toggleStatusBar()
			// XXX do this better...
			this.dom.find('.global-info .ribbon-number').focus().click() }],
	toggleStatusBarIndexMode: ['Interface/Status bar index mode',
		toggler.CSSClassToggler(
			function(){ 
				return this.dom.find('.global-info .index') },
			['normal', 'loaded', 'global'],
			function(state){
				this.toggleStatusBar('?') == 'none' 
					&& this.toggleStatusBar()
				// prepare for saving the config...
				this.config['status-bar-index'] = 
					JSON.parse(JSON.stringify(this.config['status-bar-index']))
				this.config['status-bar-index']['mode'] = state
				this.updateStatusBar() })],

	// XXX revise...
	showStatusBarInfo: ['- Interface/',
		core.doc`
			Show info...
			.showStatusBarInfo(text)

			Show info for timeout then fadeout...
			.showStatusBarInfo(text, timeout)
			.showStatusBarInfo(text, timeout, fadeout)

			Hide info...
			.showStatusBarInfo()
			.showStatusBarInfo('')

			Fadeout info for timeout...
			.showStatusBarInfo(fadeout)


		`,
		function(text, timeout, fadeout){
			var that = this
			timeout = timeout === true ? 
				1000 
				: timeout
			fadeout = fadeout || 200

			// reset clear timeout...
			this.__statusbar_info_timeout
				&& clearTimeout(this.__statusbar_info_timeout)
			delete this.__statusbar_info_timeout

			var bar = this.dom.find('.state-indicator-container.global-info .info') 

			// update the element...
			// fadeout...
			typeof(text) == typeof(123) ?
				bar.fadeOut(text, function(){
					that.showStatusBarInfo() })
			// show/hide...
			: bar
				.text(text || '')
				.stop()
				.show()
				.css({opacity: ''})

			// clear after timeout...
			timeout 
				&& text && text.trim() != ''
				&& (this.__statusbar_info_timeout = 
					setTimeout(function(){
							delete this.__statusbar_info_timeout
							this.showStatusBarInfo(fadeout) }.bind(this), 
						timeout)) }],
})

var StatusBar = 
module.StatusBar = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-status-bar',
	depends: [
		'ui',
		//'ui-chrome',

		// XXX this is here to enable context menu 
		// 		see: StatusBarActions.__statusbar_elements__.mark(..)
		'ui-browse-actions',
	],

	actions: StatusBarActions,

	handlers: [
		['start',
			function(){
				this.toggleStatusBar(this.config['status-bar']) }],
		['focusImage clear markChanged refresh',
			function(){
				this.updateStatusBar() }],
		[[
			'tag',
			'untag',
		],
			function(res, tags, gids){
				// trigger only when current image is affected...
				if(gids instanceof Array 
						&& (gids.indexOf('current') >= 0 
							|| gids.indexOf(this.current) >= 0)
						|| this.data.getImage(gids) == this.current){
					this.updateStatusBar() } }],

		['ribbonPanning.post',
			function(_, gid){
				gid == this.data.getRibbon() 
					&& this.updateStatusBar() }],

		// blink status mark indicators on toggle...
		['toggleMark',
			function(){
				this.toggleStatusBar('?') == 'hidden'
					&& this.statusItemBlink('mark') }],
		['toggleBookmark',
			function(){
				this.toggleStatusBar('?') == 'hidden'
					&& this.statusItemBlink('bookmark') }],

		// Workspaces...
		['saveWorkspace',
			core.makeWorkspaceConfigWriter(
				function(){ return Object.keys(StatusBar.config) })],
		// workspace defaults...
		[[
			'loadWorkspace.pre', 
			'saveWorkspace.pre',
		],
			function(workspace){
				if(!workspace || workspace in this.workspaces){
					return }

				this.config['status-bar'] = 
					(this.config['status-bar-workspace-defaults'][workspace] 
						|| this.config['status-bar']) }],
		['loadWorkspace',
			core.makeWorkspaceConfigLoader(
				function(){ 
					return this.config['status-bar-workspace-attrs'] },
				function(workspace){
					if(this.workspace == 'ui-chrome-hidden'){
						this.toggleStatusBar('hidden')

					} else {
						'status-bar' in workspace ?
							this.toggleStatusBar(workspace['status-bar'])
							: this.toggleStatusBar(this.config['status-bar']) } })],
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
		{mode: 'advancedBrowseModeAction'},
		function(){
			// XXX use list
		}],
	clearStatusLog: ['Interface/Clear status log',
		{mode: 'advancedBrowseModeAction'},
		function(){
			delete this.__status_log }],
	statusMessage: ['- Interface/',
		function(){
			var msg = [...arguments]
			if(msg.len == 0){
				return }
			var log = this.__status_log = this.__status_log || []
			
			// XXX should we convert here and how???
			log.push(msg.join(' '))

			// truncate the log...
			var s = this.config['ui-status-log-size']
			if(s != 0 && log.length > (s || 100)){
				log.splice(0, log.length - (s || 100)) }

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
* vim:set ts=4 sw=4 :                               */ return module })
