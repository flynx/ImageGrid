/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')


/*********************************************************************/

var OverlayClassPrototype = {
	make: function(obj, client, options){
		var that = this
		var overlay = $('<div>')
			.addClass('overlay-widget modal-widget')
			.on(options.nonPropagatedEvents.join(' '), function(evt){
				evt = window.event || evt
				evt.stopPropagation()
			})
			.on('contextmenu', function(evt){
				evt = window.event || evt
				evt.preventDefault()
				evt.stopPropagation()
			})
			.append($('<div>')
				.addClass('content')
				.click(function(evt){
					evt = window.event || evt
					evt.stopPropagation()
				})
				.on('contextmenu', function(evt){
					evt = window.event || evt
					evt.preventDefault()
					evt.stopPropagation()
				})
				.append(client))

		if(options.focusable){
			overlay.attr('tabindex', 0)
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
	keybindings: {
		General: {
			//pattern: '.overlay-widget',
			pattern: '*',

			Esc: 'close: "reject"',
		},
	},

	__init__: function(parent, client, options){
		var that = this

		object.parent(OverlayPrototype.__init__, this).call(this, parent, client, options)

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
					that.close('reject')

				// don't make the user wait if they really want to close...
				} else {
					focused = true
				}
			})

		this.parent
			.addClass('blur')
			.append(this.dom)

		this
			// pass focus to the client if it is not focused already...
			.on('focus click', function(){
				client.focus && client.focus()
			})
			// close...
			.close(function(){
				that.dom.detach()
				if(that.parent.children('.overlay-widget').length == 0){
					that.parent.removeClass('blur')
				}
			})

		this.focus()

		return this
	},
}



var Overlay = 
module.Overlay = 
object.Constructor('Overlay', 
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
* vim:set ts=4 sw=4 :                               */ return module })
