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

var DrawerClassPrototype = {
	make: function(obj, client, options){
		var that = this
		var overlay = $('<div>')
			.addClass('drawer-widget modal-widget ' + (options.direction || 'bottom'))
			.append($('<div>')
				.addClass('content')
				.click(function(){
					event.stopPropagation()
				})
				.append(client))
		
		if(options.focusable){
			overlay.attr('tabindex', 0)
		}

		return overlay
	},
}


// XXX add a non-modal version...
var DrawerPrototype = {
	dom: null,
	client: null,

	options: {
		focusable: false,

		'close-at': 40,
		'fade-at': 100,
		'animate': 120,

		nonPropagatedEvents: [
			'click',
			'keydown',

			'close',
		],

		background: null,

		direction: 'bottom',
	},

	keyboard: {
		General: {
			//pattern: '.drawer-widget',
			pattern: '*',

			Esc: 'close',
		},
	},

	// custom events...
	close: function(handler){
		// trigger the event...
		if(handler == null){
			var that = this
			this.dom.animate({
					scrollTop: this.options.direction == 'top'? 
							this.dom.find('.content')[0].scrollHeight
						: 0, 
					opacity: 0,
					filter: 'none',
				}, 
				this.options['animate'],
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
		return this
	},

	__init__: function(parent, client, options){
		var that = this

		object.parent(DrawerPrototype.__init__, this).call(this, parent, client, options)

		var client_dom = client.dom || client
		var dom = this.dom
		options = this.options

		this.parent
			.addClass('blur')
			.append(dom)

		// add keyboard handler...
		dom
			.click(function(){
				that.close()
			})
			.css({ opacity: 0 })
			.scrollTop(options.direction == 'top' ?
					dom.find('.content')[0].scrollHeight
				: 0)
			.animate({
					scrollTop: 
						(options.direction == 'top' ?
							(dom.find('.content')[0].scrollHeight
							 	- dom.outerHeight()
								+ options['fade-at']) + 'px'
						: Math.min(
								client_dom.outerHeight(), 
								// do not scroll more than the container height and
								// keep a bit on top...
								(parent.is('body') ? $(document) : parent)
									.outerHeight()-options['fade-at']) + 'px'),
					opacity: 1,
				}, 
				options['animate'],
				function(){
					dom.scroll(function(){
						var st = $(this).scrollTop()

						// top drawer...
						if(options.direction == 'top'){
							var h = dom.find('.content')[0].scrollHeight

							// start fading...
							if(st > h - options['fade-at']){
								dom.css({ opacity: Math.min(1, (h - st)/options['fade-at']) })

							} else if(dom.css('opacity') < 1){
								dom.css('opacity', 1)
							}

							// close...
							if(st > h - options['close-at']){
								that.close()
							}

						// bottom drawer...
						} else if(options.direction == 'bottom'){
							var h = Math.min(options['fade-at'], client_dom.outerHeight())

							// start fading...
							if(st < h){
								dom.css({ opacity: Math.min(1, st/h) })

							} else if(dom.css('opacity') < 1){
								dom.css('opacity', 1)
							}

							// close drawer when scrolling to the top...
							if(st < options['close-at']){
								that.close()
							}
						}
					})
				})

		if(options.background){
			dom.find('.content').css('background', options.background)
		}

		// focus the client...
		if(client.dom && client.focus){
			client.focus()

		} else {
			this.focus()
		}

		return this
	},
}


var Drawer = 
module.Drawer = 
object.Constructor('Drawer', 
		DrawerClassPrototype, 
		DrawerPrototype)

// inherit from widget...
Drawer.prototype.__proto__ = widget.Container.prototype



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
