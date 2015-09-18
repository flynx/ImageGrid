/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> overlay')

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('../keyboard')
var object = require('../../object')
var widget = require('./widget')


/*********************************************************************/

var OverlayClassPrototype = {
	make: function(client, options){
		var that = this
		var overlay = $('<div>')
			.addClass('drawer-widget')
			.on(options.nonPropagatedEvents.join(' '), function(){
				event.stopPropagation()
			})
			.append($('<div>')
				.addClass('content')
				.click(function(){
					event.stopPropagation()
				})
				.append(client))

		return overlay
	},
}


var OverlayPrototype = {
	dom: null,
	client: null,

	options: {
		nonPropagatedEvents: [
			'click',
			'keydown',
		],
	},

	keyboard: {
		General: {
			pattern: '.browse-widget',

			Esc: 'close',
		},
	},

	// XXX triggering events from here and from jQuery/dom has a 
	// 		different effect...
	trigger: widget.triggerEventWithSource,

	// proxy event api...
	on: widget.proxyToDom('on'),
	one: widget.proxyToDom('one'),
	off: widget.proxyToDom('off'),
	bind: widget.proxyToDom('bind'),
	unbind: widget.proxyToDom('unbind'),
	deligate: widget.proxyToDom('deligate'),
	undeligate: widget.proxyToDom('undeligate'),

	// custom events...
	close: function(handler){
		// trigger the event...
		if(handler == null){
			var that = this
			this.dom.animate({
					scrollTop: 0,
					opacity: 0,
					filter: 'none',
				}, 
				120,
				function(){
					that.dom.detach()
					if(that.parent.children('.overlay-widget').length == 0){
						that.parent.removeClass('blur')
					}
					that.trigger('close')
				})

		// register a handler...
		} else {
			this.on('close', handler)
		}
	},

	__init__: function(parent, client, options){
		var that = this
		parent = this.parent = $(parent || 'body')
		options = options || {}

		this.client = client
		var client_dom = client.dom || client

		// merge options...
		var opts = Object.create(this.options)
		Object.keys(options).forEach(function(n){ opts[n] = options[n] })
		options = this.options = opts

		var dom = this.dom = this.constructor.make(client_dom, options)
			.click(function(){
				that.close()
			})

		parent
			.addClass('blur')
			.append(dom)

		// add keyboard handler...
		dom.keydown(
			keyboard.makeKeyboardHandler(
				this.keyboard,
				options.logKeys,
				this))
			.css({opacity: 0})
			.animate({
					scrollTop: Math.min(
						client_dom.outerHeight(), 
						// do not scroll more than the container height and
						// keep a bit on top...
						(parent.is('body') ? $(document) : parent).outerHeight()-100)+'px',
					opacity: 1,
				}, 
				120,
				function(){
					dom.scroll(function(){
						var st = $(this).scrollTop()
						var h = Math.min(100, client_dom.outerHeight())
						// start fading...
						if(st < h){
							dom.css({ opacity: Math.min(1, st/h) })
						} else if(dom.css('opacity') < 1){
							dom.css('opacity', 1)
						}
						// close drawer when scrolling to the top...
						if(st < 10){
							that.close()
						}
					})
				})

		// focus the client...
		if(client.focus){
			client.focus()
		}

		return this
	},
}


var Overlay = 
module.Overlay = 
object.makeConstructor('Drawer', 
		OverlayClassPrototype, 
		OverlayPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
