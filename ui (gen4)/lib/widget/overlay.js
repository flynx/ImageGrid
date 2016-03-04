/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')


/*********************************************************************/

var OverlayClassPrototype = {
	make: function(obj, client, options){
		var that = this
		var overlay = $('<div>')
			.addClass('overlay-widget')
			.on(options.nonPropagatedEvents.join(' '), function(){
				event.stopPropagation()
			})
			.on('contextmenu', function(){
				event.preventDefault()
				event.stopPropagation()
			})
			.append($('<div>')
				.addClass('content')
				.click(function(){
					event.stopPropagation()
				})
				.on('contextmenu', function(){
					event.preventDefault()
					event.stopPropagation()
				})
				.append(client))

		if(options.focusable){
			overlay.attr('tabindex', 0)
		}

		// XXX make this part of the framework...
		if(obj){
			overlay.data('widget-controller', obj)
		}

		return overlay
	},
}


var OverlayPrototype = {
	dom: null,
	client: null,

	options: {
		focusable: false,

		nonPropagatedEvents: [
			'click',
			'keydown',
		],

		closeOnUnFocusedClick: false,
	},

	// XXX for some reason this does not work...
	keyboard: {
		General: {
			//pattern: '.overlay-widget',
			pattern: '*',

			Esc: 'close',
		},
	},

	// custom events...
	close: function(handler){
		// trigger the event...
		if(handler == null){
			this.dom.detach()
			if(this.parent.children('.overlay-widget').length == 0){
				this.parent.removeClass('blur')
			}
			this.trigger('close')

		// register a handler...
		} else {
			this.on('close', handler)
		}
		return this
	},

	__init__: function(parent, client, options){
		var that = this

		object.superMethod(Overlay, '__init__').call(this, parent, client, options)

		// Prevent closing the overlay if clicked while blurred...
		// i.e.
		// 	1'st click -- focus window
		// 	2'nd click -- close overlay
		//
		// XXX HACK: need a better way to do this...
		var focused = document.hasFocus()
		var unlock = function() { setTimeout(function(){ focused = true }, 200) }
		var lock = function() { focused = false }
		// blur-lock...
		$(window)
			.focus(unlock)
			.blur(lock)
		// cleanup...
		this.close(function(){
			$(window)
				.off('focus', unlock)
				.off('blur', lock)
		})

		this.dom
			.click(function(){
				if(that.options.closeOnUnFocusedClick || focused){
					that.close()

				// don't make the user wait if they really wants to close...
				} else {
					focused = true
				}
			})

		this.parent
			.addClass('blur')
			.append(this.dom)

		// pass focus to the client...
		this.on('focus click', function(){
			if(client.dom && client.focus){
				client.focus()
			}
		})

		this.focus()

		return this
	},
}



var Overlay = 
module.Overlay = 
object.makeConstructor('Overlay', 
		OverlayClassPrototype, 
		OverlayPrototype)


// inherit from widget...
Overlay.prototype.__proto__ = widget.Container.prototype



// XXX this should return a proxy with a set of extension API...
var getOverlay =
module.getOverlay = function(obj){
	var overlay = $(obj || 'body')
		.find('.overlay-widget')
		.last()

	if(overlay.length == 0){
		return null
	}

	// get the controller...
	return overlay.data('widget-controller')
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
