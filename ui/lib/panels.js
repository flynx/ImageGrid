/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

function makePanel(title, open, editable_title, remove_on_empty){
	title = title == null ? '&nbsp;' : title

	// tool panel...
	var panel = $('<details/>')
		.prop('open', open == null ? true : open)
		.addClass('panel noScroll')
		.append($('<summary>'+title+'</summary>')
			.attr({
				contenteditable: editable_title == null ? 'false' : 'true',
			})
			.append($('<span/>')
				.addClass('close-button')
				.click(function(){
					panel
						.trigger('panelClosing')
						.remove()
					return false
				})
				.html('&times;')))
		.draggable({
			containment: 'parent',
			scroll: false,
			// XXX this makes things quite a bit slower...
			stack: '.panel',
			//snap: ".panel", 
			//snapMode: "outer",
		})
		.css({
			// for some reason this is overwritten by jquery-ui to 'relative'...
			//position: '',
			position: 'absolute',
		})

	var _outside = false

	// wrapper for sub-panels...
	var content = $('<span class="panel-content content">')
		.sortable({
			forcePlaceholderSize: true,
			opacity: 0.7,
			connectWith: '.panel-content',
			zIndex: 9999,

			start: function(e, ui){
				console.log('start (outside: '+_outside+')')
				_outside = false
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			},
			// XXX this is not done...
			// create a new panel when dropping outside of curent panel...
			stop: function(e, ui){
				console.log('stop (outside: '+_outside+')')
				// do this only when dropping outside the panel...
				if(_outside){
					var new_panel = makePanel()
						// XXX adjust this to scale...
						// XXX adjust this to parent offset...
						.css(ui.offset)
						.appendTo(panel.parent())
					new_panel.find('.panel-content')
							.append(ui.item)
					_outside = false
					panel.trigger('newPanel', [new_panel])
				}

				// remove the panel when it runs out of sub-panels...
				if(remove_on_empty && panel.find('.sub-panel').length == 0){
					panel
						.trigger('panelClosing')
						.remove()
				}
			},
			// XXX are these the correct events???
			over: function(e, ui){
				console.log('over')
				_outside = false
			},
			out: function(e, ui){
				console.log('out')
				_outside = true
			},
		})
		.appendTo(panel)
	return panel
}


function makeSubPanel(title, open, parent){
	title = title == null ? '&nbsp;' : title

	var sub_panel = $('<details/>')
		.addClass('sub-panel noScroll')
		.prop('open', open == null ? true : open)
		.append($('<summary>'+title+'</summary>'))
		.append($('<div class="sub-panel-content content"/>'))

	if(parent != null){
		if(parent.hasClass('panel-content')){
			sub_panel.appendTo(parent)
		} else {
			sub_panel.appendTo(parent.find('.panel-content'))
		}
	}

	return sub_panel
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
