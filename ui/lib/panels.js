/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

function makePanel(title, open, editable_title){
	title = title == null ? '&nbsp;' : title

	// tool panel...
	var panel = $('<details/>')
		.prop('open', open == null ? true : open)
		.addClass('panel noScroll')
		.append($('<summary>'+title+'</summary>')
			.attr({
				contenteditable: editable_title == null ? 'false' : 'true',
			})
			// XXX add a '+' button to create a new panel...
			.append($('<span/>')
				.addClass('close-button')
				.click(function(){
					panel
						.trigger('panelClosing')
						.hide()
					return false
				})
				.html('&times;')))
		.draggable({
			containment: 'parent',
			scroll: false,
			// XXX this makes things quite a bit slower...
			stack: '.panel',
		})

	var _outside = false

	// wrapper for sub-panels...
	var content = $('<span class="panel-content">')
		.sortable({
			forcePlaceholderSize: true,
			opacity: 0.7,
			connectWith: '.panel-content',
			zIndex: 9999,

			start: function(e, ui){
				_outside = false
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			},
			// XXX this is not done...
			// create a new panel when dropping outside of curent panel...
			stop: function(e, ui){
				// do this only when dropping putside the panel...
				if(_outside){
					makePanel()
						// XXX adjust this to scale...
						.css(ui.position)
						.appendTo(panel.parent())
						.find('.panel-content')
							.append(ui.item)
				}
			},
			// XXX are these the correct events???
			over: function(e, ui){
				_outside = false
			},
			out: function(e, ui){
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
		.append($('<div class="sub-panel-content"/>'))

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
